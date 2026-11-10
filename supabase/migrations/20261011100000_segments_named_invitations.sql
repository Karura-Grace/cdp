-- 13 Segments and named invitations (AC-1.7, AC-2.7, AC-3.5; spec §1.4.3, §3.5). Plan: docs/SCHEMA_PLAN_72H.md, approved 11 Oct 2026.
--   * person_of_record.start_date (optional) feeds tenure. public.tenure_band holds the bands per tenant (data, not code).
--   * capture.issue_person_invitations: one single-use link per rostered person. Stores only the token hash, the person id
--     (nulled at submission, as before) and a snapshot of department, grade, tenure band and the executive flag. The
--     tokens go back to the server only, so it can email each link and then forget it.
--   * public.invitation_roster records that a person was invited, never whether they answered. It blocks a second link
--     for the same person. No column points at a response or a token.
--   * public.segment_query_log: insert only, readable by Super Admin and the assigned PAC Consultant.
--   * Nothing here changes capture.response, capture.submit_response or the rule that no role can read a response.

alter table public.person_of_record add column start_date date;

-- ---------------------------------------------------------------- tenure bands

create table public.tenure_band (
  band_id    text primary key default app.new_id('tnb'),
  tenant_id  text not null references public.tenant(tenant_id),
  name       text not null check (length(btrim(name)) between 1 and 60),
  min_months int  not null check (min_months >= 0),
  max_months int,                                   -- exclusive upper bound; null = open ended
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (tenant_id, name),
  unique (tenant_id, min_months),
  check (max_months is null or max_months > min_months)
);
create trigger tenure_band_touch before insert or update on public.tenure_band
  for each row execute function app.touch();

create function app.seed_tenure_bands(p_tenant text) returns void
language sql security definer set search_path = ''
as $$
  insert into public.tenure_band (tenant_id, name, min_months, max_months)
  select p_tenant, x.name, x.mn, x.mx
  from (values ('Under 1 year', 0, 12), ('1 to 3 years', 12, 36), ('3 to 5 years', 36, 60), ('5 to 10 years', 60, 120), ('Over 10 years', 120, null::int))
       as x(name, mn, mx)
  on conflict do nothing
$$;
revoke execute on function app.seed_tenure_bands(text) from public, anon, authenticated;

create function app.tenant_seed_tenure() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin perform app.seed_tenure_bands(new.tenant_id); return new; end $$;
create trigger tenant_seed_tenure after insert on public.tenant
  for each row execute function app.tenant_seed_tenure();

select app.seed_tenure_bands(t.tenant_id) from public.tenant t
where not exists (select 1 from public.tenure_band b where b.tenant_id = t.tenant_id);

-- ---------------------------------------------------------------- invitation roster and query log

create table public.invitation_roster (
  assessment_id text not null,
  tenant_id     text not null,
  person_id     text not null,
  invited_at    timestamptz not null default now(),
  primary key (assessment_id, person_id),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);   -- no foreign key to the person: history must survive a later roster re-import
create index invitation_roster_tenant_idx on public.invitation_roster (tenant_id);

create table public.segment_query_log (
  query_id      text primary key default app.new_id('seg'),
  tenant_id     text not null references public.tenant(tenant_id),
  assessment_id text not null,
  actor_id      uuid,
  axis          text not null check (length(axis) <= 40),
  predicates    jsonb not null default '{}'::jsonb,
  outcome       text not null check (outcome in ('ALLOWED', 'SUPPRESSED')),
  at            timestamptz not null default now(),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create index segment_query_log_asm_idx on public.segment_query_log (assessment_id, at desc);
create trigger segment_query_log_append_only before update or delete on public.segment_query_log
  for each row execute function app.deny_mutation();
create trigger segment_query_log_no_truncate before truncate on public.segment_query_log
  for each statement execute function app.deny_mutation();

-- ---------------------------------------------------------------- privileges and RLS (reads only)

alter table public.tenure_band       enable row level security;
alter table public.invitation_roster enable row level security;
alter table public.segment_query_log enable row level security;
revoke all on public.tenure_band, public.invitation_roster, public.segment_query_log from public, anon, authenticated, service_role;
grant select on public.tenure_band, public.invitation_roster, public.segment_query_log to authenticated, service_role;

create policy tenure_band_read on public.tenure_band for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
-- who was invited (not who answered): assigned PAC Consultant and the tenant's Client Admin
create policy invitation_roster_read on public.invitation_roster for select to authenticated using (
  tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
create policy segment_query_log_read on public.segment_query_log for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids()));

-- ---------------------------------------------------------------- the roster import now carries start_date

create or replace function public.rpc_org_graph_replace(p_actor uuid, p_engagement text, p_graph jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare tid text; k text; v int; np int; nu int;
begin
  foreach k in array array['grades', 'locations', 'units', 'people', 'leaders'] loop
    if jsonb_typeof(p_graph -> k) <> 'array' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = k || ' must be a list';
    end if;
  end loop;
  tid := app.graph_guard(p_actor, p_engagement, false);

  insert into public.grade_band (tenant_id, name, rank_order, is_executive)
  select tid, btrim(x.name), x.rank_order, coalesce(x.is_executive, false)
  from jsonb_to_recordset(p_graph -> 'grades') as x(name text, rank_order int, is_executive boolean)
  on conflict (tenant_id, name) do update set rank_order = excluded.rank_order, is_executive = excluded.is_executive;

  insert into public.location (tenant_id, name)
  select tid, btrim(x.name) from jsonb_to_recordset(p_graph -> 'locations') as x(name text)
  on conflict (tenant_id, name) do nothing;

  insert into public.org_unit (tenant_id, unit_key, name, type, rollup_to_parent)
  select tid, btrim(x.unit_key), x.name, x.type, coalesce(x.rollup_to_parent, false)
  from jsonb_to_recordset(p_graph -> 'units') as x(unit_key text, name text, type text, rollup_to_parent boolean)
  on conflict (tenant_id, unit_key) do update set name = excluded.name, type = excluded.type, rollup_to_parent = excluded.rollup_to_parent;
  update public.org_unit u set parent_unit_id = pu.unit_id
  from jsonb_to_recordset(p_graph -> 'units') as x(unit_key text, parent_key text)
  left join public.org_unit pu on pu.tenant_id = tid and pu.unit_key = btrim(x.parent_key)
  where u.tenant_id = tid and u.unit_key = btrim(x.unit_key);

  insert into public.person_of_record (tenant_id, employee_ref, email, unit_id, grade_id, location_id, employment_status, start_date)
  select tid, btrim(x.employee_ref), btrim(x.email), u.unit_id, g.grade_id, l.location_id, x.employment_status, x.start_date
  from jsonb_to_recordset(p_graph -> 'people') as x(employee_ref text, email text, unit_key text, grade text, location text, employment_status text, start_date date)
  left join public.org_unit u on u.tenant_id = tid and u.unit_key = btrim(x.unit_key)
  left join public.grade_band g on g.tenant_id = tid and g.name = btrim(x.grade)
  left join public.location l on l.tenant_id = tid and l.name = btrim(x.location)
  on conflict (tenant_id, employee_ref) do update set email = excluded.email, unit_id = excluded.unit_id, grade_id = excluded.grade_id,
    location_id = excluded.location_id, employment_status = excluded.employment_status, start_date = excluded.start_date;

  perform app.leaders_apply(tid, p_graph -> 'leaders');

  delete from public.person_of_record p where p.tenant_id = tid and not exists (
    select 1 from jsonb_to_recordset(p_graph -> 'people') as x(employee_ref text) where btrim(x.employee_ref) = p.employee_ref);
  delete from public.org_unit u where u.tenant_id = tid and not exists (
    select 1 from jsonb_to_recordset(p_graph -> 'units') as x(unit_key text) where btrim(x.unit_key) = u.unit_key);
  delete from public.grade_band g where g.tenant_id = tid and not exists (
    select 1 from jsonb_to_recordset(p_graph -> 'grades') as x(name text) where btrim(x.name) = g.name);
  delete from public.location l where l.tenant_id = tid and not exists (
    select 1 from jsonb_to_recordset(p_graph -> 'locations') as x(name text) where btrim(x.name) = l.name);

  set constraints public.grade_rank_unique immediate;
  v := app.graph_bump(tid, p_actor, 'org_graph.replaced', tid);
  select count(*) into np from public.person_of_record where tenant_id = tid;
  select count(*) into nu from public.org_unit where tenant_id = tid;
  return jsonb_build_object('graph_version', v, 'people', np, 'units', nu);
exception when foreign_key_violation then
  raise exception 'GRAPH_REFERENCE' using errcode = 'P0001', detail = 'a row is still referenced by another';
end $$;

-- A consultant or the tenant's Client Admin replaces the tenure bands while the engagement is in SETUP.
-- Rules: first band starts at 0, each band starts where the previous one ends, the last one is open ended.
create function public.rpc_tenure_bands_replace(p_actor uuid, p_engagement text, p_bands jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare tid text; n int; i int; prev_max int; b jsonb; mn int; mx int; v int;
begin
  if jsonb_typeof(p_bands) <> 'array' or jsonb_array_length(p_bands) not between 1 and 12 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'bands must be a list of 1 to 12';
  end if;
  tid := app.graph_guard(p_actor, p_engagement, false);
  n := jsonb_array_length(p_bands);
  prev_max := 0;
  for i in 0 .. n - 1 loop
    b := p_bands -> i;
    mn := (b ->> 'min_months')::int;
    mx := case when jsonb_typeof(b -> 'max_months') = 'number' then (b ->> 'max_months')::int else null end;
    if mn is distinct from prev_max then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'bands must start at 0 and follow on without gaps';
    end if;
    if (i = n - 1) <> (mx is null) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'only the last band is open ended';
    end if;
    prev_max := mx;
  end loop;
  delete from public.tenure_band where tenant_id = tid;
  insert into public.tenure_band (tenant_id, name, min_months, max_months)
  select tid, btrim(x.name), x.min_months, x.max_months
  from jsonb_to_recordset(p_bands) as x(name text, min_months int, max_months int);
  v := app.graph_bump(tid, p_actor, 'tenure_bands.replaced', tid);
  return jsonb_build_object('graph_version', v, 'bands', n);
end $$;

-- ---------------------------------------------------------------- named invitations

-- p_people: person ids of this assessment's tenant. Returns (person_id, token) once; only the token hash is stored.
-- The snapshot is taken from the roster now and is emptied at submission, with the person link, by the existing rule.
create function capture.issue_person_invitations(p_assessment_id text, p_people text[], p_expires_at timestamptz default null)
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
                            (select up.name from up where up.d = 0))) as department
      into rec
      from public.person_of_record p
      left join public.grade_band g on g.grade_id = p.grade_id and g.tenant_id = p.tenant_id
      where p.person_id = pid and p.tenant_id = a.tenant_id;
    if rec.person_id is null or rec.employment_status <> 'ACTIVE' then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a person is unknown, not active, or in another organisation';
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

-- ---------------------------------------------------------------- wrappers: service_role only

revoke execute on function capture.issue_person_invitations(text, text[], timestamptz) from public, anon, authenticated;
grant  execute on function capture.issue_person_invitations(text, text[], timestamptz) to service_role;

create function public.rpc_issue_person_invitations(p_assessment_id text, p_people text[], p_expires_at timestamptz default null)
returns table (person_id text, token text) language sql security invoker set search_path = ''
as $$ select * from capture.issue_person_invitations(p_assessment_id, p_people, p_expires_at) $$;

create function public.rpc_log_segment_query(p_actor uuid, p_assessment_id text, p_axis text, p_predicates jsonb, p_outcome text)
returns void language plpgsql security definer set search_path = ''
as $$
declare tid text;
begin
  select a.tenant_id into tid from public.assessment a where a.assessment_id = p_assessment_id;
  if tid is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  insert into public.segment_query_log (tenant_id, assessment_id, actor_id, axis, predicates, outcome)
  values (tid, p_assessment_id, p_actor, left(p_axis, 40), coalesce(p_predicates, '{}'::jsonb), p_outcome);
end $$;

revoke execute on function public.rpc_tenure_bands_replace(uuid, text, jsonb),
                           public.rpc_org_graph_replace(uuid, text, jsonb),
                           public.rpc_issue_person_invitations(text, text[], timestamptz),
                           public.rpc_log_segment_query(uuid, text, text, jsonb, text) from public, anon, authenticated;
grant  execute on function public.rpc_tenure_bands_replace(uuid, text, jsonb),
                           public.rpc_org_graph_replace(uuid, text, jsonb),
                           public.rpc_issue_person_invitations(text, text[], timestamptz),
                           public.rpc_log_segment_query(uuid, text, text, jsonb, text) to service_role;
