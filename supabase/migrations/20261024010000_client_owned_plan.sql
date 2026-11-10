-- Client owned action plan (design docs/designs/J4b-client-owned-plan.md; owner rulings Q-AP1 to Q-AP8, 22 to 24 Oct 2026; Erick Ngala comment 67).
--   * Rules version 2.2 (engine TRANSITIONS_2_2): at report release the system proposes every action (Draft to In review to In co design), and the
--     client accepts, defers, ranks and publishes. This migration is the schema and the writers. Rules 2.2 is published in a later migration, once the
--     whole flow works, so no assessment can pin it before then. Plans on 2.0 and 2.1 are untouched.
--   * public.action gains the client's own marks: client_horizon (NOW, NEXT, LATER), client_decision (ACCEPTED, DEFERRED) with who and when, and unit_id
--     (the unit an action belongs to, null for an organisation wide action). A People Leader acts only on actions of the teams they lead and the units under them.
--   * public.plan_client_order: the client's order of priorities, insert only, newest row wins. The engine's sequence is never changed.
--   * Writers are security definer functions for the service role. Nothing changes a client mark except these functions (no UPDATE grant exists).

alter table public.action
  add column client_horizon  text check (client_horizon in ('NOW', 'NEXT', 'LATER')),
  add column client_decision text check (client_decision in ('ACCEPTED', 'DEFERRED')),
  add column decided_by      uuid,
  add column decided_at      timestamptz,
  add column unit_id         text;
alter table public.action add foreign key (unit_id, tenant_id) references public.org_unit (unit_id, tenant_id);

create table public.plan_client_order (
  order_id      text primary key default app.new_id('pco'),
  tenant_id     text not null,
  assessment_id text not null,
  score_version int  not null,
  ranking       text[] not null check (cardinality(ranking) between 1 and 200),   -- priority ids, first is most important
  set_by        uuid not null,
  set_at        timestamptz not null default now(),
  foreign key (assessment_id, score_version) references public.plan (assessment_id, score_version)
);
create index plan_client_order_idx on public.plan_client_order (assessment_id, score_version, set_at desc);
create trigger plan_client_order_append_only before update or delete on public.plan_client_order for each row execute function app.deny_mutation();
alter table public.plan_client_order enable row level security;
revoke all on public.plan_client_order from public, anon, authenticated, service_role;
grant select on public.plan_client_order to authenticated, service_role;
create policy plan_client_order_read on public.plan_client_order for select to authenticated using ((select app.plan_visible(tenant_id, assessment_id, score_version)));

-- ---------------------------------------------------------------- helpers

-- Blocking findings of a priority that no completed P0 item covers (the same test the action guard applies at publish).
create function app.priority_open_gates(p_assessment text, p_version int, p_priority text) returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(f), '{}') from (
    select unnest(p.blocked_by) as f from public.priority p
    where p.assessment_id = p_assessment and p.score_version = p_version and p.priority_id = p_priority) b
  where not exists (select 1 from public.priority_zero_item z
                    where z.assessment_id = p_assessment and z.score_version = p_version and z.completed_at is not null and b.f = any (z.finding_ids))
$$;
revoke execute on function app.priority_open_gates(text, int, text) from public, anon, authenticated;

-- Teams a person leads today, with every unit under them.
create function app.led_units(p_person text, p_tenant text) returns setof text
language sql stable security definer set search_path = ''
as $$
  with recursive u as (
    select la.team_id as unit_id from public.leader_assignment la
    where la.person_id = p_person and la.tenant_id = p_tenant and la.effect_from <= current_date and (la.effect_to is null or la.effect_to >= current_date)
    union
    select c.unit_id from public.org_unit c join u on c.parent_unit_id = u.unit_id where c.tenant_id = p_tenant)
  select unit_id from u
$$;
revoke execute on function app.led_units(text, text) from public, anon, authenticated;

-- May this client login act on this action? Client Admin and Executive: every action of their tenant. People Leader: actions of a unit they lead (or under it).
-- Always only once a report on the action's score version is released, and never for a deactivated user.
create function app.client_acts_on(p_actor uuid, p_action text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true) and exists (
    select 1 from public.action x join app.membership m on m.user_id = p_actor and m.tenant_id = x.tenant_id
    where x.action_id = p_action and app.score_released(x.assessment_id, x.score_version)
      and (m.role in ('CLIENT_ADMIN', 'EXECUTIVE')
           or (m.role = 'PEOPLE_LEADER' and x.unit_id is not null and m.person_id is not null
               and x.unit_id in (select app.led_units(m.person_id, x.tenant_id)))))
$$;
revoke execute on function app.client_acts_on(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- field edits (shared by the consultant function and the client function)

create function app.action_fields_apply(p_actor uuid, p_action text, p_fields jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record; k text;
begin
  select * into r from public.action where action_id = p_action for update;
  for k in select jsonb_object_keys(p_fields) loop
    if k not in ('owner', 'sponsor', 'kpi', 'baseline_value', 'target_value', 'budget_amount', 'start_date', 'end_date') then
      raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown field ' || k;
    end if;
  end loop;
  update public.action set
    owner          = case when p_fields ? 'owner' then nullif(btrim(p_fields ->> 'owner'), '') else owner end,
    sponsor        = case when p_fields ? 'sponsor' then nullif(btrim(p_fields ->> 'sponsor'), '') else sponsor end,
    kpi            = case when p_fields ? 'kpi' then nullif(btrim(p_fields ->> 'kpi'), '') else kpi end,
    baseline_value = case when p_fields ? 'baseline_value' then nullif(p_fields ->> 'baseline_value', '') else baseline_value end,
    target_value   = case when p_fields ? 'target_value' then nullif(p_fields ->> 'target_value', '') else target_value end,
    budget_amount  = case when p_fields ? 'budget_amount' then nullif(p_fields ->> 'budget_amount', '')::numeric else budget_amount end,
    start_date     = case when p_fields ? 'start_date' then (p_fields ->> 'start_date')::date else start_date end,
    end_date       = case when p_fields ? 'end_date' then (p_fields ->> 'end_date')::date else end_date end,
    updated_by     = p_actor
  where action_id = p_action;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (r.tenant_id, p_actor, 'action.updated', 'action', p_action);
exception when check_violation or invalid_datetime_format or invalid_text_representation or datetime_field_overflow then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a field is not valid';
end $$;
revoke execute on function app.action_fields_apply(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.rpc_action_update(p_actor uuid, p_action text, p_fields jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  select * into r from public.action where action_id = p_action;
  if not found or not exists (select 1 from public.assessment a join app.engagement_assignment g on g.engagement_id = a.engagement_id
                              where a.assessment_id = r.assessment_id and g.user_id = p_actor and now() >= g.valid_from and now() < g.valid_to) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  perform app.action_fields_apply(p_actor, p_action, p_fields);
end $$;

-- The client fills or corrects the plan fields of an action it may act on, while the action is still being co designed (the guard locks them after).
create function public.rpc_action_client_fields(p_actor uuid, p_action text, p_fields jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  select * into r from public.action where action_id = p_action;
  if not found or not app.client_acts_on(p_actor, p_action) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  perform app.action_fields_apply(p_actor, p_action, p_fields);
end $$;

-- ---------------------------------------------------------------- the client's marks on an action

-- p_set may carry horizon (NOW, NEXT, LATER or null) and decision (DEFERRED or null while In co design; ACCEPTED only once the action is Approved).
-- Accepting is the move to Approved (rpc_action_transition); this records the decision beside it. Each change is one action_event row.
create function public.rpc_action_client_set(p_actor uuid, p_action text, p_set jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record; k text; h text; d text; note text := '';
begin
  select * into r from public.action where action_id = p_action for update;
  if not found or not app.client_acts_on(p_actor, p_action) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  for k in select jsonb_object_keys(p_set) loop
    if k not in ('horizon', 'decision') then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown field ' || k; end if;
  end loop;
  if r.status not in ('IN_CO_DESIGN', 'APPROVED') then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'the plan is only marked while an action is proposed or approved';
  end if;
  h := case when p_set ? 'horizon' then nullif(p_set ->> 'horizon', '') else r.client_horizon end;
  d := case when p_set ? 'decision' then nullif(p_set ->> 'decision', '') else r.client_decision end;
  if h is not null and h not in ('NOW', 'NEXT', 'LATER') then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'horizon'; end if;
  if d is not null and d not in ('ACCEPTED', 'DEFERRED') then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'decision'; end if;
  if d = 'ACCEPTED' and r.status <> 'APPROVED' then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'accept moves the action to Approved'; end if;
  if d is distinct from 'ACCEPTED' and r.status = 'APPROVED' and p_set ? 'decision' then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'an accepted action stays accepted'; end if;
  if h is distinct from r.client_horizon then note := 'horizon ' || coalesce(h, 'none'); end if;
  if d is distinct from r.client_decision then note := concat_ws(', ', nullif(note, ''), 'decision ' || coalesce(d, 'none')); end if;
  if note = '' then return; end if;
  update public.action set client_horizon = h, client_decision = d, decided_by = p_actor, decided_at = now(), updated_by = p_actor where action_id = p_action;
  insert into public.action_event (tenant_id, action_id, from_status, to_status, actor_id, reason) values (r.tenant_id, p_action, r.status, r.status, p_actor, 'CLIENT: ' || note);
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (r.tenant_id, p_actor, 'action.client_marked', 'action', p_action);
end $$;

-- ---------------------------------------------------------------- the client's order of priorities

-- p_ranking lists every priority of the plan exactly once. A priority held by an open gate cannot be ranked above one that is not held.
-- Client Admin and Executive only (a People Leader acts on their unit's actions, not on the order), once a report on the score version is released.
create function public.rpc_plan_order_set(p_actor uuid, p_assessment text, p_version int, p_ranking text[]) returns void
language plpgsql security definer set search_path = ''
as $$
declare a record; ids text[]; seen_held boolean := false; pid text;
begin
  select * into a from public.assessment where assessment_id = p_assessment;
  if not found or not app.score_released(p_assessment, p_version)
     or not exists (select 1 from app.membership m where m.user_id = p_actor and m.tenant_id = a.tenant_id and m.role in ('CLIENT_ADMIN', 'EXECUTIVE'))
     or not coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select array_agg(priority_id order by priority_id) into ids from public.priority where assessment_id = p_assessment and score_version = p_version;
  if ids is null or (select array_agg(x order by x) from unnest(p_ranking) x) is distinct from ids then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'rank every priority exactly once';
  end if;
  foreach pid in array p_ranking loop
    if cardinality(app.priority_open_gates(p_assessment, p_version, pid)) > 0 then seen_held := true;
    elsif seen_held then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a priority held by an open gate cannot rank above one that is not held';
    end if;
  end loop;
  insert into public.plan_client_order (tenant_id, assessment_id, score_version, ranking, set_by) values (a.tenant_id, p_assessment, p_version, p_ranking, p_actor);
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (a.tenant_id, p_actor, 'plan.client_ranked', 'assessment', p_assessment);
end $$;

-- ---------------------------------------------------------------- the system proposes (rules 2.2, at release)

-- Moves every DRAFT action of a released plan to In co design (Draft to In review to In co design, both by the system), and defaults an empty owner to the
-- priority's owner role so the client does not start empty. Idempotent: nothing changes when no action is in DRAFT. Does nothing on rules 2.0 or 2.1.
create function public.rpc_plan_propose(p_assessment text, p_version int) returns int
language plpgsql security definer set search_path = ''
as $$
declare a record; x record; n int := 0;
begin
  select * into a from public.assessment where assessment_id = p_assessment;
  if not found or not app.score_released(p_assessment, p_version)
     or not exists (select 1 from public.rules_version v where v.version_id = a.rules_version_id and v.semver = '2.2') then
    return 0;
  end if;
  for x in select * from public.action where assessment_id = p_assessment and score_version = p_version and status = 'DRAFT' order by action_id for update loop
    update public.action ac set owner = coalesce(ac.owner, (select p.owner_role from public.priority p
                                                             where p.assessment_id = ac.assessment_id and p.score_version = ac.score_version and p.priority_id = ac.priority_id))
    where ac.action_id = x.action_id;
    perform set_config('cdp.action_transition', x.action_id, true);
    update public.action set status = 'IN_REVIEW' where action_id = x.action_id;
    update public.action set status = 'IN_CO_DESIGN' where action_id = x.action_id;
    perform set_config('cdp.action_transition', '', true);
    insert into public.action_event (tenant_id, action_id, from_status, to_status, actor_id, reason) values
      (x.tenant_id, x.action_id, 'DRAFT', 'IN_REVIEW', null, 'proposed at release'),
      (x.tenant_id, x.action_id, 'IN_REVIEW', 'IN_CO_DESIGN', null, 'proposed at release');
    n := n + 1;
  end loop;
  if n > 0 then
    insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (a.tenant_id, null, 'plan.proposed', 'assessment', p_assessment);
  end if;
  return n;
end $$;

revoke execute on function public.rpc_action_update(uuid, text, jsonb), public.rpc_action_client_fields(uuid, text, jsonb), public.rpc_action_client_set(uuid, text, jsonb),
                           public.rpc_plan_order_set(uuid, text, int, text[]), public.rpc_plan_propose(text, int) from public, anon, authenticated;
grant  execute on function public.rpc_action_update(uuid, text, jsonb), public.rpc_action_client_fields(uuid, text, jsonb), public.rpc_action_client_set(uuid, text, jsonb),
                           public.rpc_plan_order_set(uuid, text, int, text[]), public.rpc_plan_propose(text, int) to service_role;
