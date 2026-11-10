-- Journey 1, privacy and scorecard slice (j1b-privacy-scorecard). Owner decisions of 18 October 2026.
--   1. Scorecard: external_ref on objectives and KPIs (unique per engagement when set), KPI readings, and the link from an action to a KPI (spec Table 77).
--   2. Objection: invitation issuing skips a person with an OPEN or DONE OBJECT request; consultant_task holds the visible follow up.
--   3. Survey About you screen (S2-04): rpc_set_invitation_attributes writes the respondent's answers into the invitation's demographic snapshot only.
--   4. ODPC registration reference and confirmed date on the tenant.
--   5. A data subject request without a due date gets one 30 days after it was opened (still editable).
--   6. Breach contact as a platform setting.

-- ---------------------------------------------------------------- 1 scorecard
alter table public.objective add column external_ref text check (external_ref is null or length(btrim(external_ref)) between 1 and 100);
alter table public.scorecard_kpi add column external_ref text check (external_ref is null or length(btrim(external_ref)) between 1 and 100);
create unique index objective_external_ref_uq on public.objective (engagement_id, external_ref) where external_ref is not null;
create unique index scorecard_kpi_external_ref_uq on public.scorecard_kpi (engagement_id, external_ref) where external_ref is not null;

-- A reading is a value of the KPI on a day. One per KPI per day, so importing the same file twice changes nothing. Readings are not locked with the
-- scorecard: they arrive after launch.
create table public.scorecard_kpi_reading (
  reading_id    text primary key default app.new_id('skr'),
  tenant_id     text not null,
  engagement_id text not null,
  kpi_id        text not null references public.scorecard_kpi(kpi_id) on delete cascade,
  read_on       date not null check (read_on <= current_date + 1),
  value         numeric not null check (abs(value) <= 1e12),
  note          text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(), created_by uuid,
  unique (kpi_id, read_on),
  foreign key (engagement_id, tenant_id) references public.engagement(engagement_id, tenant_id)
);
create index scorecard_kpi_reading_kpi_idx on public.scorecard_kpi_reading (kpi_id, read_on);
alter table public.scorecard_kpi_reading enable row level security;
revoke all on public.scorecard_kpi_reading from anon, authenticated;
grant select on public.scorecard_kpi_reading to authenticated;
grant all on public.scorecard_kpi_reading to service_role;
create policy scorecard_kpi_reading_read on public.scorecard_kpi_reading for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));

alter table public.action add column scorecard_kpi_id text references public.scorecard_kpi(kpi_id) on delete set null;
create index action_scorecard_kpi_idx on public.action (scorecard_kpi_id) where scorecard_kpi_id is not null;

-- ---------------------------------------------------------------- 2 objection
create table public.consultant_task (
  task_id    text primary key default app.new_id('tsk'),
  tenant_id  text not null references public.tenant(tenant_id),
  kind       text not null check (kind in ('OBJECTION')),
  title      text not null check (length(btrim(title)) between 1 and 200),
  detail     text check (detail is null or length(detail) <= 2000),
  source_ref text,                                        -- the data_subject_request that raised it
  status     text not null default 'OPEN' check (status in ('OPEN', 'DONE')),
  created_at timestamptz not null default now(),
  done_at    timestamptz, done_by uuid
);
create index consultant_task_tenant_idx on public.consultant_task (tenant_id, status);
alter table public.consultant_task enable row level security;
revoke all on public.consultant_task from anon, authenticated;
grant select on public.consultant_task to authenticated;
grant all on public.consultant_task to service_role;
create policy consultant_task_read on public.consultant_task for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids()));

create or replace function capture.issue_person_invitations(p_assessment_id text, p_people text[], p_expires_at timestamptz default null)
returns table (person_id text, token text)
language plpgsql security definer set search_path = ''
as $$
declare
  a record; pid text; tok text; snap jsonb; rec record; months int; band text;
begin
  if p_people is null or coalesce(array_length(p_people, 1), 0) not between 1 and 5000 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'people must be 1..5000';
  end if;
  select * into a from public.assessment where assessment_id = p_assessment_id for update;
  if not found or a.status <> 'LAUNCHED' then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  foreach pid in array p_people loop
    select p.person_id, p.employment_status, p.start_date, g.name as grade, g.is_executive,
           (with recursive up as (
              select u0.unit_id, u0.parent_unit_id, u0.type, u0.name, 0 as d from public.org_unit u0 where u0.unit_id = p.unit_id
              union all
              select u1.unit_id, u1.parent_unit_id, u1.type, u1.name, up.d + 1
              from public.org_unit u1 join up on u1.unit_id = up.parent_unit_id where up.d < 10)
            select coalesce((select up.name from up where up.type = 'DEPARTMENT' order by up.d limit 1),
                            (select up.name from up where up.d = 0))) as department,
           (with recursive up as (
              select u0.unit_id, u0.parent_unit_id, u0.type, u0.name, 0 as d from public.org_unit u0 where u0.unit_id = p.unit_id
              union all
              select u1.unit_id, u1.parent_unit_id, u1.type, u1.name, up.d + 1
              from public.org_unit u1 join up on u1.unit_id = up.parent_unit_id where up.d < 10)
            select coalesce((select up.name from up where up.type = 'TEAM' order by up.d limit 1), (select up.name from up where up.d = 0))) as team
      into rec
      from public.person_of_record p
      left join public.grade_band g on g.grade_id = p.grade_id and g.tenant_id = p.tenant_id
      where p.person_id = pid and p.tenant_id = a.tenant_id;
    if rec.person_id is null or rec.employment_status <> 'ACTIVE' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a person is unknown, not active, or in another organisation';
    end if;
    -- Decision of 18 October 2026: an objection blocks further links to that person (open or done). The person is skipped, not refused, so a roster run goes on for everyone else.
    if exists (select 1 from public.data_subject_request r join public.person_of_record q on q.employee_ref = r.subject_ref and q.tenant_id = r.tenant_id
               where q.person_id = pid and r.tenant_id = a.tenant_id and r.kind = 'OBJECT' and r.status in ('OPEN', 'DONE')) then
      continue;
    end if;
    begin
      insert into public.invitation_roster (assessment_id, tenant_id, person_id) values (a.assessment_id, a.tenant_id, pid);
    exception when unique_violation then
      raise exception 'ALREADY_INVITED' using errcode = 'P0001';
    end;
    band := null;
    if rec.start_date is not null then
      months := (extract(year from age(coalesce(a.window_open, now())::date, rec.start_date)) * 12
               + extract(month from age(coalesce(a.window_open, now())::date, rec.start_date)))::int;
      select tb.name into band from public.tenure_band tb
        where tb.tenant_id = a.tenant_id and months >= tb.min_months and (tb.max_months is null or months < tb.max_months);
    end if;
    snap := jsonb_build_object(
      'department', coalesce(rec.department, 'UNKNOWN'),
      'team', coalesce(rec.team, 'UNKNOWN'),
      'grade', coalesce(rec.grade, 'UNKNOWN'),
      'tenure_band', coalesce(band, 'UNKNOWN'),
      'is_executive', coalesce(rec.is_executive, false));
    tok := encode(extensions.gen_random_bytes(16), 'hex');                       -- 128 bits
    insert into capture.invitation (tenant_id, assessment_id, kind, token_hash, person_id, demographic_snapshot_json, sent_at, expires_at)
    values (a.tenant_id, a.assessment_id, 'SURVEY', extensions.digest(tok, 'sha256'), pid, snap, now(),
            coalesce(p_expires_at, a.window_close, now() + interval '30 days'));
    person_id := pid; token := tok;
    return next;
  end loop;
end $$;

-- Pulse links follow the same rule: an objecting person is skipped.
create or replace function capture.pulse_issue(p_pulse text, p_people text[]) returns table (person_id text, token text)
language plpgsql security definer set search_path = ''
as $$
declare p record; pid text; tok text;
begin
  select * into p from public.pulse where pulse_id = p_pulse;
  if not found or p.status <> 'OPEN' or p.closes_at is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  foreach pid in array p_people loop
    if exists (select 1 from public.data_subject_request r join public.person_of_record q on q.employee_ref = r.subject_ref and q.tenant_id = r.tenant_id
               where q.person_id = pid and r.tenant_id = p.tenant_id and r.kind = 'OBJECT' and r.status in ('OPEN', 'DONE')) then
      continue;
    end if;
    tok := encode(extensions.gen_random_bytes(16), 'hex');                -- 128 bits
    insert into capture.pulse_invitation (tenant_id, pulse_id, token_hash, person_id, sent_at, expires_at)
    values (p.tenant_id, p.pulse_id, extensions.digest(tok, 'sha256'), pid, now(), p.closes_at);
    person_id := pid; token := tok; return next;
  end loop;
end $$;

-- ---------------------------------------------------------------- 3 About you (S2-04)
-- The respondent's answers go into the invitation's demographic snapshot under "attributes" ({attr_id: value}). The snapshot is copied to the response
-- and emptied on the invitation at submission by the existing rule; nothing here touches a response row or joins one to a person. Each value must be
-- in the attribute's closed list (or "Prefer not to say"), and each attribute must belong to the invitation's own organisation.
create function public.rpc_set_invitation_attributes(p_token text, p_attrs jsonb) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare inv record; k text; v text; clean jsonb := '{}'::jsonb; a record;
begin
  select * into inv from capture.invitation where token_hash = extensions.digest(p_token, 'sha256') and kind = 'SURVEY';
  if not found or inv.expires_at <= now() or inv.submitted_at is not null then return false; end if;
  if jsonb_typeof(p_attrs) <> 'object' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'attributes must be an object'; end if;
  for k, v in select key, value #>> '{}' from jsonb_each(p_attrs) loop
    select * into a from public.demographic_attribute where attr_id = k and tenant_id = inv.tenant_id;
    if not found then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown attribute'; end if;
    if jsonb_typeof(p_attrs -> k) <> 'string' or not (v = 'Prefer not to say' or v = any (a.values_list)) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'value not allowed';
    end if;
    clean := clean || jsonb_build_object(k, v);
  end loop;
  update capture.invitation set demographic_snapshot_json = demographic_snapshot_json || jsonb_build_object('attributes', clean) where invitation_id = inv.invitation_id;
  return true;
end $$;
revoke all on function public.rpc_set_invitation_attributes(text, jsonb) from public, anon, authenticated;
grant execute on function public.rpc_set_invitation_attributes(text, jsonb) to service_role;

-- What the invitation already says about the respondent's own place in the organisation (S2-04 shows grade and unit, not editable). Read by token, only while
-- the link is valid and unused; the answer carries no id and touches no response.
create function public.rpc_invitation_prefill(p_token text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare inv record;
begin
  select * into inv from capture.invitation where token_hash = extensions.digest(p_token, 'sha256') and kind = 'SURVEY';
  if not found or inv.expires_at <= now() or inv.submitted_at is not null then return '{}'::jsonb; end if;
  return coalesce((select jsonb_object_agg(e.key, e.value) from jsonb_each(inv.demographic_snapshot_json) e
                   where e.key in ('department', 'team', 'grade') and e.value <> '"UNKNOWN"'::jsonb), '{}'::jsonb);
end $$;
revoke all on function public.rpc_invitation_prefill(text) from public, anon, authenticated;
grant execute on function public.rpc_invitation_prefill(text) to service_role;

-- ---------------------------------------------------------------- 4 ODPC registration
alter table public.tenant add column odpc_registration_ref text check (odpc_registration_ref is null or length(btrim(odpc_registration_ref)) between 1 and 100);
alter table public.tenant add column odpc_confirmed_on date;
alter table public.tenant add check ((odpc_registration_ref is null) = (odpc_confirmed_on is null));

-- ---------------------------------------------------------------- 5 data subject request due date
create function app.dsr_default_due() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.due_on is null then new.due_on := (coalesce(new.opened_at, now()))::date + 30; end if;
  return new;
end $$;
create trigger dsr_default_due before insert on public.data_subject_request for each row execute function app.dsr_default_due();
update public.data_subject_request set due_on = opened_at::date + 30 where due_on is null;

-- ---------------------------------------------------------------- 6 breach contact
insert into public.platform_setting (key, value) values ('breach_contact', '{"name": "Imran Issa", "email": "cdp@pac.africa"}'::jsonb)
on conflict (key) do nothing;
