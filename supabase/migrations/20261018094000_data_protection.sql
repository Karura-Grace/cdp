-- Block 30: data protection records (spec 1.4.5): DPIA, processing register, sub processors, breach incidents with the 72 hour
-- clock, data subject requests. Read: Super Admin, assigned consultant, Client Admin of the tenant. Writes: route handlers.
create table public.dpia_record (
  dpia_id        text primary key default app.new_id('dpi'),
  tenant_id      text not null references public.tenant(tenant_id),
  reference      text not null check (length(btrim(reference)) between 1 and 200),
  transfer_basis text not null check (length(btrim(transfer_basis)) between 1 and 500),
  recorded_at    timestamptz not null default now(),
  recorded_by    uuid
);
create function app.dpia_sets_tenant() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tenant set dpia_recorded_at = new.recorded_at where tenant_id = new.tenant_id;
  return new;
end $$;
create trigger dpia_sets_tenant after insert on public.dpia_record for each row execute function app.dpia_sets_tenant();

create table public.processing_register (
  entry_id    text primary key default app.new_id('prc'),
  tenant_id   text references public.tenant(tenant_id),     -- null = platform wide entry kept by PAC
  activity    text not null check (length(btrim(activity)) between 1 and 200),
  purpose     text not null check (length(btrim(purpose)) between 1 and 500),
  data_categories text not null check (length(btrim(data_categories)) between 1 and 500),
  legal_basis text not null check (length(btrim(legal_basis)) between 1 and 200),
  retention   text not null check (length(btrim(retention)) between 1 and 200),
  recorded_at timestamptz not null default now(), recorded_by uuid
);
create table public.sub_processor (
  processor_id text primary key default app.new_id('spr'),
  name         text not null unique check (length(btrim(name)) between 1 and 120),
  purpose      text not null check (length(btrim(purpose)) between 1 and 300),
  region       text not null check (length(btrim(region)) between 1 and 80),
  transfer_basis text not null check (length(btrim(transfer_basis)) between 1 and 300),
  added_at     timestamptz not null default now(), added_by uuid
);
create table public.breach_incident (
  incident_id text primary key default app.new_id('brc'),
  tenant_id   text references public.tenant(tenant_id),
  summary     text not null check (length(btrim(summary)) between 1 and 2000),
  opened_at   timestamptz not null default now(),
  notify_by   timestamptz not null,
  notified_at timestamptz,
  regulator_ref text,
  opened_by   uuid,
  check (notify_by = opened_at + interval '72 hours')
);
create table public.data_subject_request (
  request_id text primary key default app.new_id('dsr'),
  tenant_id  text not null references public.tenant(tenant_id),
  kind       text not null check (kind in ('ACCESS', 'RECTIFY', 'OBJECT', 'ERASE')),
  subject_ref text not null check (length(btrim(subject_ref)) between 1 and 120),    -- employee reference, never a response
  detail     text check (detail is null or length(btrim(detail)) <= 2000),
  status     text not null default 'OPEN' check (status in ('OPEN', 'DONE', 'REFUSED')),
  opened_at  timestamptz not null default now(),
  due_on     date not null,
  closed_at  timestamptz,
  closed_note text
);
do $$ declare t text; begin
  foreach t in array array['dpia_record', 'processing_register', 'sub_processor', 'breach_incident', 'data_subject_request'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
create policy dpia_read on public.dpia_record for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
create policy processing_read on public.processing_register for select to authenticated using (
  (select app.is_super_admin()) or tenant_id is null or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
create policy sub_processor_read on public.sub_processor for select to authenticated using (true);
create policy breach_read on public.breach_incident for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
create policy dsr_read on public.data_subject_request for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
