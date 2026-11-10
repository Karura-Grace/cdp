-- 22 Measure stage, step D: cycle rollover (spec §6.6.2, Table 104, screen S6-05). Approved 15 Oct 2026.
--   * rollover: the record that the next cycle was created from a previous one, with what was carried. One per previous engagement. Insert only.
--   * carried_action: the open actions of the previous cycle, as a snapshot (status, plan fields, history). They wait here with disposition
--     PENDING; linking them to the next cycle's findings, or retiring them as superseded, happens at the next plan generation, not here.
--   * rpc_rollover_create makes the next engagement (cycle_no + 1, state SETUP, previous_engagement_id set), copies the agreed setup sections as
--     DRAFT (to be re-agreed, with dates and participants cleared), and writes the two records above, all in one transaction.
--   * Nothing of the previous cycle is changed: not its engagement state, scores, responses, actions, plan or the organisation roster.

create table public.rollover (
  rollover_id            text primary key default app.new_id('rlv'),
  tenant_id              text not null,
  previous_engagement_id text not null unique references public.engagement(engagement_id),
  new_engagement_id      text not null unique references public.engagement(engagement_id),
  setup_sections         int  not null,
  actions_carried        int  not null,
  carry_json             jsonb not null,                     -- backlog and the workshop G5 entries that travel with section G
  created_at timestamptz not null default now(), created_by uuid
);
create trigger rollover_append_only before update or delete on public.rollover for each row execute function app.deny_mutation();

create table public.carried_action (
  carried_id            text primary key default app.new_id('car'),
  tenant_id             text not null,
  rollover_id           text not null references public.rollover(rollover_id),
  new_engagement_id     text not null references public.engagement(engagement_id),
  source_action_id      text not null references public.action(action_id),
  status_at_carry       text not null,
  snapshot_json         jsonb not null,
  disposition           text not null default 'PENDING' check (disposition = 'PENDING'),
  created_at timestamptz not null default now(),
  unique (rollover_id, source_action_id)
);
create index carried_action_eng_idx on public.carried_action (new_engagement_id);
create trigger carried_action_append_only before update or delete on public.carried_action for each row execute function app.deny_mutation();

-- p_actions: the open actions the engine kept (rolloverPlan); the database re-checks they belong to the previous cycle and are still open.
create function public.rpc_rollover_create(p_actor uuid, p_previous text, p_actions text[], p_carry jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare e record; base record; newe text; rid text; n_sec int; n_act int;
begin
  select * into e from public.engagement where engagement_id = p_previous;
  if not found or not app.consultant_on_engagement(p_actor, p_previous) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into base from public.assessment where engagement_id = p_previous and status = 'FROZEN' order by created_at desc limit 1;
  if not found or not exists (select 1 from public.plan p where p.assessment_id = base.assessment_id) then
    raise exception 'DATA_NOT_FROZEN' using errcode = 'P0001', detail = 'the baseline must be frozen and have a plan';
  end if;
  if exists (select 1 from public.rollover r where r.previous_engagement_id = p_previous)
     or exists (select 1 from public.engagement x where x.previous_engagement_id = p_previous) then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'the next cycle already exists';
  end if;
  if exists (select 1 from public.action a
             where a.action_id = any (coalesce(p_actions, '{}')) and (a.assessment_id <> base.assessment_id or a.status in ('CLOSED', 'RETIRED', 'DISCARDED')))
     or (select count(*) from public.action a where a.action_id = any (coalesce(p_actions, '{}'))) <> cardinality(coalesce(p_actions, '{}')) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'only open actions of the previous cycle can be carried';
  end if;

  insert into public.engagement (tenant_id, cycle_no, previous_engagement_id, created_by)
  values (e.tenant_id, e.cycle_no + 1, p_previous, p_actor) returning engagement_id into newe;
  -- the acting consultant keeps access to the new cycle, time boxed like every PAC grant
  insert into app.engagement_assignment (user_id, engagement_id, valid_to) values (p_actor, newe, now() + interval '90 days');

  insert into public.setup_record (tenant_id, engagement_id, section, perspective, payload_json, status, created_by)
  select s.tenant_id, newe, s.section, 'AGREED', s.payload_json, 'DRAFT', p_actor
  from public.setup_record s where s.engagement_id = p_previous and s.perspective = 'AGREED' and s.status = 'AGREED';
  get diagnostics n_sec = row_count;

  insert into public.rollover (tenant_id, previous_engagement_id, new_engagement_id, setup_sections, actions_carried, carry_json, created_by)
  values (e.tenant_id, p_previous, newe, n_sec, cardinality(coalesce(p_actions, '{}')), coalesce(p_carry, '{}'::jsonb), p_actor) returning rollover_id into rid;

  insert into public.carried_action (tenant_id, rollover_id, new_engagement_id, source_action_id, status_at_carry, snapshot_json)
  select a.tenant_id, rid, newe, a.action_id, a.status,
         jsonb_build_object('engine_ref', a.engine_ref, 'level', a.level, 'orientation', a.orientation, 'objective', a.objective, 'intervention', a.intervention,
           'horizon', a.horizon, 'owner', a.owner, 'sponsor', a.sponsor, 'kpi', a.kpi, 'baseline_value', a.baseline_value, 'target_value', a.target_value,
           'end_date', a.end_date,
           'history', coalesce((select jsonb_agg(jsonb_build_object('from', v.from_status, 'to', v.to_status, 'reason', v.reason, 'at', v.at) order by v.at)
                                from public.action_event v where v.action_id = a.action_id), '[]'::jsonb))
  from public.action a where a.action_id = any (coalesce(p_actions, '{}'));

  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id)
  values (e.tenant_id, p_actor, 'rollover.created:' || n_sec || ' sections, ' || cardinality(coalesce(p_actions, '{}')) || ' actions', 'engagement', newe);
  return jsonb_build_object('rollover_id', rid, 'engagement_id', newe, 'cycle_no', e.cycle_no + 1, 'setup_sections', n_sec, 'actions_carried', cardinality(coalesce(p_actions, '{}')));
end $$;
revoke execute on function public.rpc_rollover_create(uuid, text, text[], jsonb) from public, anon, authenticated;
grant execute on function public.rpc_rollover_create(uuid, text, text[], jsonb) to service_role;

-- ---------------------------------------------------------------- reads (RLS)
alter table public.rollover enable row level security;
alter table public.carried_action enable row level security;
revoke all on public.rollover, public.carried_action from public, anon, authenticated, service_role;
grant select on public.rollover, public.carried_action to authenticated, service_role;

create policy rollover_read on public.rollover for select to authenticated using (
  new_engagement_id in (select app.pac_engagement_ids())
  or previous_engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
create policy carried_action_read on public.carried_action for select to authenticated using (
  new_engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
