-- 14 Leadership 360 (spec §2.6, §3.4, Appendix D 360 tests). Plan: docs/SCHEMA_PLAN_72H.md, approved 11 Oct 2026.
--   * person_of_record.display_name (optional): a leader has to be named on a 360 form and in results. Read rules unchanged.
--   * public.rater_nomination: who rates which leader and as what (the plan, never the answers).
--   * capture.invitation_360: 360 links live apart from survey links, so a 360 token can never submit a culture survey and the
--     reverse. Only the token hash is kept; person_id is nulled at submission in the same transaction.
--   * capture.response_360 / response_360_item: one form per submission with the leader assignment and the rater group,
--     no person and no token. 360 open text is not collected in this slice.
--   * capture.frozen_360_set: after freeze, self and rater ratings per leader assignment, with no ids that join to people.
--     Same exposure as frozen_response_set (service_role can execute it; the dedicated scoring login is still open, AC-3.6).
--   * public.leader_result: the engine's scoreLeaders result per leader, stored with the score version it came from.
--     Read: assigned PAC Consultant; Client Admin and Executive only once a report on that score version is released.

alter table public.person_of_record add column display_name text check (display_name is null or length(btrim(display_name)) between 1 and 120);

-- ---------------------------------------------------------------- nominations

create table public.rater_nomination (
  nomination_id   text primary key default app.new_id('nom'),
  tenant_id       text not null references public.tenant(tenant_id),
  assessment_id   text not null,
  assignment_id   text not null references public.leader_assignment(assignment_id),
  rater_person_id text not null,
  rater_group     text not null check (rater_group in ('SUPERIOR', 'PEER', 'DIRECT_REPORT', 'OTHER')),
  status          text not null default 'NOMINATED' check (status in ('NOMINATED', 'INVITED')),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (assessment_id, assignment_id, rater_person_id),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id),
  foreign key (rater_person_id, tenant_id) references public.person_of_record(person_id, tenant_id)
);
create index rater_nomination_asm_idx on public.rater_nomination (assessment_id);
create trigger rater_nomination_touch before insert or update on public.rater_nomination for each row execute function app.touch();

-- ---------------------------------------------------------------- capture side

create table capture.invitation_360 (
  invitation_id            text primary key default app.new_id('i36'),
  tenant_id                text not null,
  assessment_id            text not null,
  assignment_id            text not null,
  kind                     text not null check (kind in ('SELF', 'RATER')),
  rater_group              text check (rater_group in ('SUPERIOR', 'PEER', 'DIRECT_REPORT', 'OTHER')),
  token_hash               bytea not null unique,
  person_id                text,                      -- nulled at submission
  expires_at               timestamptz not null,
  submitted_at             timestamptz,
  person_link_destroyed_at timestamptz,
  created_at               timestamptz not null default now(),
  check ((kind = 'SELF') = (rater_group is null)),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create index invitation_360_asm_idx on capture.invitation_360 (assessment_id);
create unique index invitation_360_one_self on capture.invitation_360 (assessment_id, assignment_id) where kind = 'SELF';

create table capture.response_360 (
  response_id   text primary key default app.new_id('r36'),
  tenant_id     text not null,
  assessment_id text not null,
  assignment_id text not null,
  kind          text not null check (kind in ('SELF', 'RATER')),
  rater_group   text,
  submitted_at  timestamptz not null default now(),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create index response_360_asm_idx on capture.response_360 (assessment_id, assignment_id);
create table capture.response_360_item (
  response_id text not null references capture.response_360(response_id) on delete cascade,
  idx         int  not null check (idx between 1 and 60),
  value       int  not null check (value between 1 and 5),     -- NOT OBSERVED is stored as no row
  primary key (response_id, idx)
);

alter table capture.invitation_360    enable row level security;
alter table capture.response_360      enable row level security;
alter table capture.response_360_item enable row level security;
revoke all on capture.invitation_360, capture.response_360, capture.response_360_item from public, anon, authenticated, service_role;

-- p_items: [{ assignment_id, person_id, kind: SELF|RATER, rater_group }]. Returns each token once.
create function capture.issue_360_invitations(p_assessment_id text, p_items jsonb, p_expires_at timestamptz default null)
returns table (person_id text, assignment_id text, kind text, token text)
language plpgsql security definer set search_path = ''
as $$
declare a record; x record; tok text;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 5000 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'items must be 1..5000';
  end if;
  select * into a from public.assessment where assessment_id = p_assessment_id for update;
  if not found or a.status <> 'LAUNCHED' then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  for x in select * from jsonb_to_recordset(p_items) as r(assignment_id text, person_id text, kind text, rater_group text) loop
    if not exists (select 1 from public.leader_assignment la where la.assignment_id = x.assignment_id and la.tenant_id = a.tenant_id)
       or not exists (select 1 from public.person_of_record p where p.person_id = x.person_id and p.tenant_id = a.tenant_id and p.employment_status = 'ACTIVE') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown leader or person';
    end if;
    if x.kind = 'SELF' and not exists (select 1 from public.leader_assignment la where la.assignment_id = x.assignment_id and la.person_id = x.person_id) then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a self form goes to the leader';
    end if;
    tok := encode(extensions.gen_random_bytes(16), 'hex');
    begin
      insert into capture.invitation_360 (tenant_id, assessment_id, assignment_id, kind, rater_group, token_hash, person_id, expires_at)
      values (a.tenant_id, a.assessment_id, x.assignment_id, x.kind, case when x.kind = 'SELF' then null else x.rater_group end,
              extensions.digest(tok, 'sha256'), x.person_id, coalesce(p_expires_at, a.window_close, now() + interval '30 days'));
    exception when unique_violation then raise exception 'ALREADY_INVITED' using errcode = 'P0001';
    end;
    if x.kind = 'RATER' then
      update public.rater_nomination n set status = 'INVITED'
      where n.assessment_id = a.assessment_id and n.assignment_id = x.assignment_id and n.rater_person_id = x.person_id;
    end if;
    person_id := x.person_id; assignment_id := x.assignment_id; kind := x.kind; token := tok;
    return next;
  end loop;
end $$;

-- What the form needs to show: the kind and the leader's display name. Neutral failure for any bad token.
create function capture.status_360(p_token text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare inv record; a record; nm text;
begin
  select * into inv from capture.invitation_360 where token_hash = extensions.digest(p_token, 'sha256');
  if not found or inv.expires_at <= now() or inv.submitted_at is not null then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  select * into a from public.assessment where assessment_id = inv.assessment_id;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  select coalesce(p.display_name, 'your leader') into nm from public.leader_assignment la join public.person_of_record p on p.person_id = la.person_id
  where la.assignment_id = inv.assignment_id;
  return jsonb_build_object('kind', inv.kind, 'leader', nm, 'closes_at', inv.expires_at);
end $$;

-- p_ratings: 60 values, each 1..5 or null (NOT OBSERVED, raters only). Unlinks the person in the same transaction.
create function capture.submit_360(p_token text, p_ratings jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare inv record; a record; rid text; i int; v jsonb;
begin
  select * into inv from capture.invitation_360 where token_hash = extensions.digest(p_token, 'sha256') for update;
  if not found or inv.expires_at <= now() then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  if inv.submitted_at is not null then raise exception 'ALREADY_SUBMITTED' using errcode = 'P0001'; end if;
  select * into a from public.assessment where assessment_id = inv.assessment_id;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null then raise exception 'TOKEN_INVALID' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_ratings) <> 'array' or jsonb_array_length(p_ratings) <> 60 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a 360 form has exactly 60 items';
  end if;
  insert into capture.response_360 (tenant_id, assessment_id, assignment_id, kind, rater_group)
  values (inv.tenant_id, inv.assessment_id, inv.assignment_id, inv.kind, inv.rater_group) returning response_id into rid;
  for i in 0 .. 59 loop
    v := p_ratings -> i;
    if v is null or jsonb_typeof(v) = 'null' then
      if inv.kind = 'SELF' then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'all 60 self items are required'; end if;
      continue;
    end if;
    if jsonb_typeof(v) <> 'number' or (v #>> '{}') !~ '^[1-5]$' then raise exception 'SCALE_OUT_OF_RANGE' using errcode = 'P0001', detail = '360'; end if;
    insert into capture.response_360_item (response_id, idx, value) values (rid, i + 1, (v #>> '{}')::int);
  end loop;
  update capture.invitation_360 set submitted_at = now(), person_id = null, person_link_destroyed_at = now() where invitation_id = inv.invitation_id;
end $$;

-- After freeze: [{ assignment_id, self: [60] | null, raters: [{ group, ratings: [60] }] }]. No person, response or token ids.
create function capture.frozen_360_set(p_assessment_id text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.assessment where assessment_id = p_assessment_id and frozen_at is not null) then
    raise exception 'DATA_NOT_FROZEN' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'assignment_id', l.assignment_id,
      'self', (select (select jsonb_agg((select it.value from capture.response_360_item it where it.response_id = r.response_id and it.idx = s) order by s)
                       from generate_series(1, 60) s)
               from capture.response_360 r where r.assessment_id = p_assessment_id and r.assignment_id = l.assignment_id and r.kind = 'SELF' limit 1),
      'raters', coalesce((select jsonb_agg(jsonb_build_object('group', r.rater_group,
                 'ratings', (select jsonb_agg((select it.value from capture.response_360_item it where it.response_id = r.response_id and it.idx = s) order by s)
                             from generate_series(1, 60) s)) order by r.rater_group, r.response_id)
                 from capture.response_360 r where r.assessment_id = p_assessment_id and r.assignment_id = l.assignment_id and r.kind = 'RATER'), '[]'::jsonb)
    ) order by l.assignment_id)
    from (select distinct assignment_id from capture.response_360 where assessment_id = p_assessment_id) l), '[]'::jsonb);
end $$;

-- Counts only: invited and submitted per leader and kind. No rater identities.
create function capture.counts_360(p_assessment_id text) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('assignment_id', assignment_id, 'kind', kind, 'invited', invited, 'submitted', submitted)), '[]'::jsonb)
  from (select assignment_id, kind, count(*) as invited, count(submitted_at) as submitted
        from capture.invitation_360 where assessment_id = p_assessment_id group by assignment_id, kind) t
$$;

-- ---------------------------------------------------------------- leader results

create table public.leader_result (
  assessment_id text not null,
  tenant_id     text not null,
  score_version int  not null,
  assignment_id text not null,
  payload_json  jsonb not null,
  created_at    timestamptz not null default now(), created_by uuid,
  primary key (assessment_id, score_version, assignment_id),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create trigger leader_result_immutable before update or delete on public.leader_result for each row execute function app.deny_mutation();

alter table public.rater_nomination enable row level security;
alter table public.leader_result    enable row level security;
revoke all on public.rater_nomination, public.leader_result from public, anon, authenticated, service_role;
grant select on public.rater_nomination, public.leader_result to authenticated, service_role;
grant insert on public.leader_result to service_role;

-- nominations name people: assigned PAC Consultant and the tenant's Client Admin
create policy rater_nomination_read on public.rater_nomination for select to authenticated using (
  tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
create policy leader_result_read on public.leader_result for select to authenticated using (
  tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')
      and (select app.score_released(assessment_id, score_version))));

-- ---------------------------------------------------------------- nomination write (consultant or Client Admin, before freeze)

-- p_noms: [{ assignment_id, person_id, rater_group }] replaces the NOMINATED rows for that leader; INVITED rows are kept.
create function public.rpc_nominations_replace(p_actor uuid, p_assessment text, p_assignment text, p_noms jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a record; n int;
begin
  select * into a from public.assessment where assessment_id = p_assessment for update;
  if not found or a.frozen_at is not null then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001'; end if;
  if p_actor is null or not coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true)
     or not (exists (select 1 from app.engagement_assignment g where g.user_id = p_actor and g.engagement_id = a.engagement_id and now() >= g.valid_from and now() < g.valid_to)
             or exists (select 1 from app.membership m where m.user_id = p_actor and m.tenant_id = a.tenant_id and m.role = 'CLIENT_ADMIN')) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.leader_assignment la where la.assignment_id = p_assignment and la.tenant_id = a.tenant_id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown leader';
  end if;
  if jsonb_typeof(p_noms) <> 'array' or jsonb_array_length(p_noms) > 40 then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'at most 40 raters per leader';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_noms) as x(person_id text) join public.leader_assignment la on la.assignment_id = p_assignment and la.person_id = x.person_id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a leader cannot rate themselves as a rater';
  end if;
  delete from public.rater_nomination where assessment_id = p_assessment and assignment_id = p_assignment and status = 'NOMINATED';
  insert into public.rater_nomination (tenant_id, assessment_id, assignment_id, rater_person_id, rater_group, created_by)
  select a.tenant_id, p_assessment, p_assignment, x.person_id, x.rater_group, p_actor
  from jsonb_to_recordset(p_noms) as x(person_id text, rater_group text)
  on conflict (assessment_id, assignment_id, rater_person_id) do nothing;
  get diagnostics n = row_count;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (a.tenant_id, p_actor, 'l360.nominations_replaced', 'leader_assignment', p_assignment);
  return jsonb_build_object('nominated', n);
exception when foreign_key_violation or check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown person or relationship';
end $$;

-- ---------------------------------------------------------------- wrappers: service_role only

grant usage on schema capture to service_role;
revoke execute on function capture.issue_360_invitations(text, jsonb, timestamptz), capture.status_360(text), capture.submit_360(text, jsonb),
                           capture.frozen_360_set(text), capture.counts_360(text) from public, anon, authenticated;
grant  execute on function capture.issue_360_invitations(text, jsonb, timestamptz), capture.status_360(text), capture.submit_360(text, jsonb),
                           capture.frozen_360_set(text), capture.counts_360(text) to service_role;

create function public.rpc_issue_360_invitations(p_assessment_id text, p_items jsonb, p_expires_at timestamptz default null)
returns table (person_id text, assignment_id text, kind text, token text) language sql security invoker set search_path = ''
as $$ select * from capture.issue_360_invitations(p_assessment_id, p_items, p_expires_at) $$;
create function public.rpc_status_360(p_token text) returns jsonb language sql security invoker set search_path = ''
as $$ select capture.status_360(p_token) $$;
create function public.rpc_submit_360(p_token text, p_ratings jsonb) returns void language sql security invoker set search_path = ''
as $$ select capture.submit_360(p_token, p_ratings) $$;
create function public.rpc_frozen_360_set(p_assessment_id text) returns jsonb language sql security invoker set search_path = ''
as $$ select capture.frozen_360_set(p_assessment_id) $$;
create function public.rpc_counts_360(p_assessment_id text) returns jsonb language sql security invoker set search_path = ''
as $$ select capture.counts_360(p_assessment_id) $$;

revoke execute on function public.rpc_issue_360_invitations(text, jsonb, timestamptz), public.rpc_status_360(text), public.rpc_submit_360(text, jsonb),
                           public.rpc_frozen_360_set(text), public.rpc_counts_360(text), public.rpc_nominations_replace(uuid, text, text, jsonb)
  from public, anon, authenticated;
grant  execute on function public.rpc_issue_360_invitations(text, jsonb, timestamptz), public.rpc_status_360(text), public.rpc_submit_360(text, jsonb),
                           public.rpc_frozen_360_set(text), public.rpc_counts_360(text), public.rpc_nominations_replace(uuid, text, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------- the roster import now carries display_name

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

  insert into public.person_of_record (tenant_id, employee_ref, email, unit_id, grade_id, location_id, employment_status, start_date, display_name)
  select tid, btrim(x.employee_ref), btrim(x.email), u.unit_id, g.grade_id, l.location_id, x.employment_status, x.start_date, nullif(btrim(x.display_name), '')
  from jsonb_to_recordset(p_graph -> 'people') as x(employee_ref text, email text, unit_key text, grade text, location text, employment_status text, start_date date, display_name text)
  left join public.org_unit u on u.tenant_id = tid and u.unit_key = btrim(x.unit_key)
  left join public.grade_band g on g.tenant_id = tid and g.name = btrim(x.grade)
  left join public.location l on l.tenant_id = tid and l.name = btrim(x.location)
  on conflict (tenant_id, employee_ref) do update set email = excluded.email, unit_id = excluded.unit_id, grade_id = excluded.grade_id,
    location_id = excluded.location_id, employment_status = excluded.employment_status, start_date = excluded.start_date, display_name = excluded.display_name;

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
