-- Block 31: retention schedule, notices and destruction (spec 1.4.5, 6.6.3). Destruction removes response level data 24 months after
-- window close and writes a certificate in the same transaction. Score objects, reports and plans are untouched.
create table public.retention_schedule (
  engagement_id text primary key,
  tenant_id     text not null,
  assessment_id text not null,
  close_date    date not null,
  destroy_on    date not null,
  notice_90_on  date not null,
  notice_30_on  date not null,
  notice_90_sent_at timestamptz,
  notice_30_sent_at timestamptz,
  destroyed_at  timestamptz,
  foreign key (engagement_id, tenant_id) references public.engagement(engagement_id, tenant_id),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create table public.destruction_certificate (
  cert_id       text primary key default app.new_id('dcr'),
  engagement_id text not null,
  tenant_id     text not null,
  destroyed_at  timestamptz not null default now(),
  row_counts    jsonb not null,
  cert_hash     text not null,
  foreign key (engagement_id, tenant_id) references public.engagement(engagement_id, tenant_id)
);
create function app.cert_immutable() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'CERTIFICATE_IMMUTABLE' using errcode = 'P0001'; end $$;
create trigger destruction_certificate_guard before update or delete on public.destruction_certificate for each row execute function app.cert_immutable();

-- Response level destruction. Callable only by service_role (the scheduled job). Refuses before destroy_on and a second time.
create function public.rpc_destroy_responses(p_engagement text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare s public.retention_schedule; c jsonb := '{}'::jsonb; n int; ids text[]; cert public.destruction_certificate;
begin
  select * into s from public.retention_schedule where engagement_id = p_engagement for update;
  if not found then raise exception 'RETENTION_NOT_SCHEDULED' using errcode = 'P0001'; end if;
  if s.destroyed_at is not null then raise exception 'ALREADY_DESTROYED' using errcode = 'P0001'; end if;
  if s.destroy_on > current_date then raise exception 'RETENTION_NOT_DUE' using errcode = 'P0001', detail = s.destroy_on::text; end if;
  select array_agg(assessment_id) into ids from public.assessment where engagement_id = p_engagement;
  delete from capture.response where assessment_id = any (ids);            get diagnostics n = row_count; c := c || jsonb_build_object('response', n);
  delete from capture.response_360 where assessment_id = any (ids);        get diagnostics n = row_count; c := c || jsonb_build_object('response_360', n);
  delete from capture.pulse_response where pulse_id in (select pulse_id from public.pulse where engagement_id = p_engagement);
                                                                           get diagnostics n = row_count; c := c || jsonb_build_object('pulse_response', n);
  delete from capture.invitation where assessment_id = any (ids);          get diagnostics n = row_count; c := c || jsonb_build_object('invitation', n);
  delete from capture.invitation_360 where assessment_id = any (ids);      get diagnostics n = row_count; c := c || jsonb_build_object('invitation_360', n);
  delete from capture.pulse_invitation where pulse_id in (select pulse_id from public.pulse where engagement_id = p_engagement);
                                                                           get diagnostics n = row_count; c := c || jsonb_build_object('pulse_invitation', n);
  update public.retention_schedule set destroyed_at = now() where engagement_id = p_engagement;
  insert into public.destruction_certificate (engagement_id, tenant_id, row_counts, cert_hash)
    values (p_engagement, s.tenant_id, c, encode(sha256(convert_to(p_engagement || c::text || now()::text, 'UTF8')), 'hex'))
    returning * into cert;
  return jsonb_build_object('cert_id', cert.cert_id, 'row_counts', c, 'cert_hash', cert.cert_hash);
end $$;
revoke all on function public.rpc_destroy_responses(text) from public, anon, authenticated;
grant execute on function public.rpc_destroy_responses(text) to service_role;

alter table public.retention_schedule enable row level security;
alter table public.destruction_certificate enable row level security;
revoke all on public.retention_schedule, public.destruction_certificate from anon, authenticated;
grant select on public.retention_schedule, public.destruction_certificate to authenticated;
grant all on public.retention_schedule, public.destruction_certificate to service_role;
create policy retention_read on public.retention_schedule for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
create policy certificate_read on public.destruction_certificate for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
