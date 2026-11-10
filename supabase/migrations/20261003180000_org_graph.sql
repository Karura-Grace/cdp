-- 12 Org graph and leader mapping (spec §1.4.1 Table 15, §1.6.1 Table 24, Appendix A, Table 7 row "Org graph and leader mapping").
--   * Tenant-level tables: location, grade_band, org_unit, person_of_record, leader_assignment. Stable import keys:
--     unit_key (org_unit), employee_ref (person), name (grade, location). Ids are kept across re-imports.
--   * leader_assignment has an exclusion constraint: at most one accountable leader per team on any date (effect_to is
--     inclusive). It is deferred, so a re-import can move dates around inside one transaction, and checked at the end.
--   * person_of_record holds work emails: readable only by PAC Consultants on the tenant and its Client Admin. It never
--     joins to a response (no response column points here). Units, grades, locations and leader mapping follow Table 7:
--     Super Admin R, PAC Consultant R, Client Admin R, Executive R. People Leader "R own team" is NOT built: it needs a link
--     from a login to a person, which does not exist yet, so People Leaders get nothing.
--   * No role gets INSERT/UPDATE/DELETE on these tables. Every write goes through a definer function that is executable by
--     service_role only, re-checks the actor, locks the tenant and engagement, and only works while the engagement is in SETUP.
--   * org_override: a consultant's recorded reason for overriding a blocking rule V1 to V4, V6, V7 on an engagement.
--   * org_graph_snapshot: taken at launch inside the launch transaction. It holds the leaders in scope (headcount_led per
--     leader, no names), the defects and the overrides, and never changes. Scoring reads it, so later edits to the live graph
--     cannot change a score.
--   * tenant.org_graph_version is bumped by every graph, leader or override change. Launch must present the version it
--     validated; if the graph changed in between, launch is refused (GRAPH_CHANGED).

create extension if not exists btree_gist with schema extensions;

alter table public.tenant add column org_graph_version int not null default 0;

-- ---------------------------------------------------------------- tables

create table public.location (
  location_id text primary key default app.new_id('loc'),
  tenant_id   text not null references public.tenant(tenant_id),
  name        text not null check (length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (tenant_id, name),
  unique (location_id, tenant_id)
);
create table public.grade_band (
  grade_id     text primary key default app.new_id('grd'),
  tenant_id    text not null references public.tenant(tenant_id),
  name         text not null check (length(btrim(name)) between 1 and 120),
  rank_order   int  not null check (rank_order between 1 and 1000),
  is_executive boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (tenant_id, name),
  constraint grade_rank_unique unique (tenant_id, rank_order) deferrable initially deferred,   -- deferred so a re-import can swap ranks
  unique (grade_id, tenant_id)
);
create table public.org_unit (
  unit_id          text primary key default app.new_id('unt'),
  tenant_id        text not null references public.tenant(tenant_id),
  unit_key         text not null check (length(btrim(unit_key)) between 1 and 60),
  parent_unit_id   text,
  type             text not null check (type in ('DIVISION', 'DEPARTMENT', 'TEAM')),
  name             text not null check (length(btrim(name)) between 1 and 200),
  rollup_to_parent boolean not null default false,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (tenant_id, unit_key),
  unique (unit_id, tenant_id),
  foreign key (parent_unit_id, tenant_id) references public.org_unit (unit_id, tenant_id),
  check (parent_unit_id is distinct from unit_id)
);
create table public.person_of_record (
  person_id         text primary key default app.new_id('per'),
  tenant_id         text not null references public.tenant(tenant_id),
  employee_ref      text not null check (length(btrim(employee_ref)) between 1 and 60),
  email             text not null check (length(email) <= 254),                  -- V7 reports duplicates and bad forms; not a constraint
  unit_id           text,
  grade_id          text,
  location_id       text,
  employment_status text not null check (employment_status in ('ACTIVE', 'ON_LEAVE', 'EXITED')),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (tenant_id, employee_ref),
  unique (person_id, tenant_id),
  foreign key (unit_id, tenant_id)     references public.org_unit   (unit_id, tenant_id),
  foreign key (grade_id, tenant_id)    references public.grade_band (grade_id, tenant_id),
  foreign key (location_id, tenant_id) references public.location   (location_id, tenant_id)
);
create index person_unit_idx on public.person_of_record (unit_id);
create table public.leader_assignment (
  assignment_id text primary key default app.new_id('lea'),
  tenant_id     text not null references public.tenant(tenant_id),
  person_id     text not null,
  team_id       text not null,
  effect_from   date not null,
  effect_to     date,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  check (effect_to is null or effect_to >= effect_from),
  unique (tenant_id, person_id, team_id, effect_from),
  foreign key (person_id, tenant_id) references public.person_of_record (person_id, tenant_id),
  foreign key (team_id, tenant_id)   references public.org_unit (unit_id, tenant_id),
  constraint leader_assignment_one_per_team
    exclude using gist (team_id extensions.gist_text_ops with =, daterange(effect_from, effect_to, '[]') with &&)
    deferrable initially deferred
);
create index leader_assignment_tenant_idx on public.leader_assignment (tenant_id);

create function app.leader_team_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if not exists (select 1 from public.org_unit u where u.unit_id = new.team_id and u.type = 'TEAM') then
    raise exception 'LEADER_NOT_TEAM' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger leader_assignment_team before insert or update on public.leader_assignment
  for each row execute function app.leader_team_guard();

create table public.org_override (
  engagement_id text not null references public.engagement(engagement_id),
  tenant_id     text not null references public.tenant(tenant_id),
  rule          text not null check (rule in ('V1', 'V2', 'V3', 'V4', 'V6', 'V7')),
  reason        text not null check (length(btrim(reason)) between 3 and 500),
  set_by        uuid not null,
  set_at        timestamptz not null default now(),
  primary key (engagement_id, rule)
);

create table public.org_graph_snapshot (
  engagement_id text primary key references public.engagement(engagement_id),
  tenant_id     text not null references public.tenant(tenant_id),
  taken_at      timestamptz not null default now(),
  taken_by      uuid not null,
  graph_version int  not null,
  window_start  date not null,
  scope_json    jsonb not null,       -- [{ assignment_id, team_key, headcount_led }]: no names, no emails
  defects_json  jsonb not null,       -- engine defects after overrides, as they stood at launch
  overrides_json jsonb not null       -- { rule: reason }
);
create trigger org_graph_snapshot_immutable before update or delete on public.org_graph_snapshot
  for each row execute function app.deny_mutation();

do $$
declare t text;
begin
  foreach t in array array['location', 'grade_band', 'org_unit', 'person_of_record', 'leader_assignment'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function app.touch()', t || '_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- privileges and RLS (reads only)

alter table public.location          enable row level security;
alter table public.grade_band        enable row level security;
alter table public.org_unit          enable row level security;
alter table public.person_of_record  enable row level security;
alter table public.leader_assignment enable row level security;
alter table public.org_override      enable row level security;
alter table public.org_graph_snapshot enable row level security;

revoke all on public.location, public.grade_band, public.org_unit, public.person_of_record, public.leader_assignment,
              public.org_override, public.org_graph_snapshot from public, anon, authenticated, service_role;
grant select on public.location, public.grade_band, public.org_unit, public.person_of_record, public.leader_assignment,
                public.org_override, public.org_graph_snapshot to authenticated, service_role;

-- structure and leader mapping: Super Admin, assigned PAC Consultant, Client Admin and Executive of the tenant
create policy location_read on public.location for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
create policy grade_band_read on public.grade_band for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
create policy org_unit_read on public.org_unit for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
create policy leader_assignment_read on public.leader_assignment for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
-- work emails, overrides and the launch snapshot: assigned PAC Consultant and the tenant's Client Admin only
create policy person_read on public.person_of_record for select to authenticated using (
  tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
create policy org_override_read on public.org_override for select to authenticated using (
  tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
create policy org_snapshot_read on public.org_graph_snapshot for select to authenticated using (
  tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));

-- ---------------------------------------------------------------- write guard

-- Locks the tenant then the engagement (always in this order), checks the actor and the state, returns the tenant id.
-- p_consultant_only: overrides are a consultant's call (Table 13); everything else is also open to the tenant's Client Admin.
create function app.graph_guard(p_actor uuid, p_engagement text, p_consultant_only boolean) returns text
language plpgsql security definer set search_path = ''
as $$
declare tid text; st public.engagement_state; consultant boolean; client_admin boolean;
begin
  select e.tenant_id into tid from public.engagement e where e.engagement_id = p_engagement;
  if tid is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  perform 1 from public.tenant t where t.tenant_id = tid for update;
  select e.state into st from public.engagement e where e.engagement_id = p_engagement for update;

  if p_actor is null or not coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  consultant := exists (select 1 from app.engagement_assignment g
                        where g.user_id = p_actor and g.engagement_id = p_engagement and now() >= g.valid_from and now() < g.valid_to);
  client_admin := exists (select 1 from app.membership m where m.user_id = p_actor and m.tenant_id = tid and m.role = 'CLIENT_ADMIN');
  if not (consultant or (client_admin and not p_consultant_only)) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if st <> 'SETUP' then raise exception 'SETUP_LOCKED' using errcode = 'P0001'; end if;
  -- the graph is shared by every engagement of the tenant: no edits while another one is collecting responses
  if exists (select 1 from public.engagement e where e.tenant_id = tid and e.state = 'FIELDING') then
    raise exception 'SETUP_LOCKED' using errcode = 'P0001', detail = 'another engagement of this tenant is fielding';
  end if;
  return tid;
end $$;

create function app.graph_bump(p_tenant text, p_actor uuid, p_action text, p_object text) returns int
language plpgsql security definer set search_path = ''
as $$
declare v int;
begin
  update public.tenant set org_graph_version = org_graph_version + 1 where tenant_id = p_tenant returning org_graph_version into v;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (p_tenant, p_actor, p_action, 'tenant', p_object);
  return v;
end $$;

-- Replace the leader assignments of a tenant. Matched by (person, team, effect_from); rows not sent are removed.
create function app.leaders_apply(p_tenant text, p_leaders jsonb) returns int
language plpgsql security definer set search_path = ''
as $$
declare n int; want int;
begin
  if jsonb_typeof(p_leaders) <> 'array' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'leaders must be a list'; end if;
  delete from public.leader_assignment la where la.tenant_id = p_tenant and not exists (
    select 1 from jsonb_to_recordset(p_leaders) as x(employee_ref text, team_key text, effect_from date, effect_to date)
    join public.person_of_record p on p.tenant_id = p_tenant and p.employee_ref = x.employee_ref
    join public.org_unit t on t.tenant_id = p_tenant and t.unit_key = x.team_key
    where p.person_id = la.person_id and t.unit_id = la.team_id and x.effect_from = la.effect_from);
  insert into public.leader_assignment (tenant_id, person_id, team_id, effect_from, effect_to)
  select p_tenant, p.person_id, t.unit_id, x.effect_from, x.effect_to
  from jsonb_to_recordset(p_leaders) as x(employee_ref text, team_key text, effect_from date, effect_to date)
  join public.person_of_record p on p.tenant_id = p_tenant and p.employee_ref = x.employee_ref
  join public.org_unit t on t.tenant_id = p_tenant and t.unit_key = x.team_key
  on conflict (tenant_id, person_id, team_id, effect_from) do update set effect_to = excluded.effect_to;
  get diagnostics n = row_count;
  want := jsonb_array_length(p_leaders);
  if n <> want then raise exception 'GRAPH_REFERENCE' using errcode = 'P0001', detail = 'a leader row names an unknown person or team, or repeats'; end if;
  set constraints public.leader_assignment_one_per_team immediate;      -- surface an overlap here, not at commit
  set constraints public.leader_assignment_one_per_team deferred;
  return n;
end $$;

-- ---------------------------------------------------------------- bulk replace of the whole graph

-- p_graph = { grades: [{name, rank_order, is_executive}], locations: [{name}],
--             units: [{unit_key, name, type, parent_key, rollup_to_parent}],
--             people: [{employee_ref, email, unit_key, grade, location, employment_status}],
--             leaders: [{employee_ref, team_key, effect_from, effect_to}] }
-- Rows are matched by their stable key and keep their ids; rows not sent are deleted. A person whose unit, grade or
-- location key is not found is stored with that reference empty, and validation rule V4 reports them.
create function public.rpc_org_graph_replace(p_actor uuid, p_engagement text, p_graph jsonb) returns jsonb
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

  insert into public.person_of_record (tenant_id, employee_ref, email, unit_id, grade_id, location_id, employment_status)
  select tid, btrim(x.employee_ref), btrim(x.email), u.unit_id, g.grade_id, l.location_id, x.employment_status
  from jsonb_to_recordset(p_graph -> 'people') as x(employee_ref text, email text, unit_key text, grade text, location text, employment_status text)
  left join public.org_unit u on u.tenant_id = tid and u.unit_key = btrim(x.unit_key)
  left join public.grade_band g on g.tenant_id = tid and g.name = btrim(x.grade)
  left join public.location l on l.tenant_id = tid and l.name = btrim(x.location)
  on conflict (tenant_id, employee_ref) do update set email = excluded.email, unit_id = excluded.unit_id, grade_id = excluded.grade_id,
    location_id = excluded.location_id, employment_status = excluded.employment_status;

  perform app.leaders_apply(tid, p_graph -> 'leaders');

  -- remove what was not sent: people, then units (children first is not needed: parents were re-pointed above), grades, locations
  delete from public.person_of_record p where p.tenant_id = tid and not exists (
    select 1 from jsonb_to_recordset(p_graph -> 'people') as x(employee_ref text) where btrim(x.employee_ref) = p.employee_ref);
  delete from public.org_unit u where u.tenant_id = tid and not exists (
    select 1 from jsonb_to_recordset(p_graph -> 'units') as x(unit_key text) where btrim(x.unit_key) = u.unit_key);
  delete from public.grade_band g where g.tenant_id = tid and not exists (
    select 1 from jsonb_to_recordset(p_graph -> 'grades') as x(name text) where btrim(x.name) = g.name);
  delete from public.location l where l.tenant_id = tid and not exists (
    select 1 from jsonb_to_recordset(p_graph -> 'locations') as x(name text) where btrim(x.name) = l.name);

  set constraints public.grade_rank_unique immediate;                    -- surface a duplicate rank here, not at commit
  v := app.graph_bump(tid, p_actor, 'org_graph.replaced', tid);
  select count(*) into np from public.person_of_record where tenant_id = tid;
  select count(*) into nu from public.org_unit where tenant_id = tid;
  return jsonb_build_object('graph_version', v, 'people', np, 'units', nu);
exception when foreign_key_violation then
  raise exception 'GRAPH_REFERENCE' using errcode = 'P0001', detail = 'a row is still referenced by another';
end $$;

create function public.rpc_leaders_replace(p_actor uuid, p_engagement text, p_leaders jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare tid text; n int; v int;
begin
  tid := app.graph_guard(p_actor, p_engagement, false);
  n := app.leaders_apply(tid, p_leaders);
  v := app.graph_bump(tid, p_actor, 'leaders.replaced', tid);
  return jsonb_build_object('graph_version', v, 'leaders', n);
end $$;

-- A consultant records, or removes (p_reason null), the reason for overriding a blocking rule on this engagement.
create function public.rpc_org_override_set(p_actor uuid, p_engagement text, p_rule text, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare tid text; v int;
begin
  tid := app.graph_guard(p_actor, p_engagement, true);
  if p_rule not in ('V1', 'V2', 'V3', 'V4', 'V6', 'V7') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'only a blocking rule can be overridden';
  end if;
  if p_reason is null then
    delete from public.org_override where engagement_id = p_engagement and rule = p_rule;
  else
    if length(btrim(p_reason)) < 3 or length(btrim(p_reason)) > 500 then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a reason of 3 to 500 characters is required';
    end if;
    insert into public.org_override (engagement_id, tenant_id, rule, reason, set_by) values (p_engagement, tid, p_rule, btrim(p_reason), p_actor)
    on conflict (engagement_id, rule) do update set reason = excluded.reason, set_by = excluded.set_by, set_at = now();
  end if;
  v := app.graph_bump(tid, p_actor, case when p_reason is null then 'org_override.removed:' else 'org_override.set:' end || p_rule, p_engagement);
  return jsonb_build_object('graph_version', v);
end $$;

-- ---------------------------------------------------------------- launch now takes the org graph snapshot in the same transaction

drop function public.rpc_launch_assessment(uuid, text);
create function public.rpc_launch_assessment(
  p_actor uuid, p_assessment text, p_graph_version int, p_window_start date, p_scope jsonb, p_defects jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a record; eng record; tid text; aeng text; locked int; ver int;
begin
  select a0.tenant_id, a0.engagement_id into tid, aeng from public.assessment a0 where a0.assessment_id = p_assessment;
  if tid is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  perform 1 from public.tenant t where t.tenant_id = tid for update;                 -- same lock order as the graph writes
  select * into a from public.assessment where assessment_id = p_assessment for update;
  if not coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true)
     or not exists (select 1 from app.engagement_assignment g
                    where g.user_id = p_actor and g.engagement_id = a.engagement_id
                      and now() >= g.valid_from and now() < g.valid_to) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into eng from public.engagement where engagement_id = a.engagement_id for update;
  if a.status <> 'DRAFT' or eng.state <> 'SETUP' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;

  -- what was validated must be what is launched
  select t.org_graph_version into ver from public.tenant t where t.tenant_id = tid;
  if ver is distinct from p_graph_version or p_window_start is distinct from (a.window_open at time zone 'UTC')::date then
    raise exception 'GRAPH_CHANGED' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_scope) <> 'array' or jsonb_typeof(p_defects) <> 'array' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001';
  end if;

  insert into public.org_graph_snapshot (engagement_id, tenant_id, taken_by, graph_version, window_start, scope_json, defects_json, overrides_json)
  values (a.engagement_id, tid, p_actor, ver, p_window_start, p_scope, p_defects,
          coalesce((select jsonb_object_agg(o.rule, o.reason) from public.org_override o where o.engagement_id = a.engagement_id), '{}'::jsonb));

  update public.setup_record set locked_at = now() where engagement_id = a.engagement_id and locked_at is null;
  get diagnostics locked = row_count;
  update public.assessment set status = 'LAUNCHED' where assessment_id = a.assessment_id;      -- guard: approved consent text
  update public.engagement set state = 'FIELDING' where engagement_id = a.engagement_id;

  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id)
  values (tid, p_actor, 'assessment.launched', 'assessment', a.assessment_id);
  return jsonb_build_object('assessment_id', a.assessment_id, 'status', 'LAUNCHED', 'sections_locked', locked, 'leaders_in_scope', jsonb_array_length(p_scope));
end $$;

-- ---------------------------------------------------------------- execute rights

revoke execute on function app.graph_guard(uuid, text, boolean), app.graph_bump(text, uuid, text, text), app.leaders_apply(text, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.rpc_org_graph_replace(uuid, text, jsonb), public.rpc_leaders_replace(uuid, text, jsonb),
                           public.rpc_org_override_set(uuid, text, text, text),
                           public.rpc_launch_assessment(uuid, text, int, date, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.rpc_org_graph_replace(uuid, text, jsonb), public.rpc_leaders_replace(uuid, text, jsonb),
                          public.rpc_org_override_set(uuid, text, text, text),
                          public.rpc_launch_assessment(uuid, text, int, date, jsonb, jsonb) to service_role;
