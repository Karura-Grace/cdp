-- 15 Action plan and tracking (spec §5.5, §5.6, AC-5.x). Plan: docs/SCHEMA_PLAN_72H.md, approved 11 Oct 2026.
--   * public.plan: the engine's buildPlan output for one frozen score version, canonical and hashed. Never changes.
--   * public.priority, public.priority_zero_item, public.action: the plan as rows. Priorities are fixed; P0 items record their
--     completion; actions carry the editable fields and their workflow status.
--   * The engine decides who may move an action where (transition, in the route). The database is the second lock:
--       - status changes only through rpc_action_transition, from the status the caller saw (no lost updates);
--       - PUBLISHED is refused while a blocking finding of the action's priority is not covered by a completed P0 item;
--       - CLOSED is refused without evidence;
--       - plan fields change only while the action is DRAFT, IN_REVIEW or IN_CO_DESIGN.
--   * action_event, kpi_reading, action_evidence are insert only. Evidence is a described record with an optional link;
--     file upload to Storage is not built yet.
--   * Reads: the assigned PAC Consultant sees everything. Client Admin, Executive and People Leader see the plan only once a
--     report on its score version is released, and never actions still in DRAFT, IN_REVIEW or DISCARDED. Coaches see nothing.

create table public.plan (
  assessment_id text not null,
  tenant_id     text not null,
  score_version int  not null,
  start_date    date not null,
  payload_json  jsonb not null,
  payload_hash  text not null,
  created_at    timestamptz not null default now(), created_by uuid,
  primary key (assessment_id, score_version),
  foreign key (assessment_id, score_version) references public.evaluation(assessment_id, score_version),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create trigger plan_immutable before update or delete on public.plan for each row execute function app.deny_mutation();

create table public.priority (
  assessment_id  text not null,
  tenant_id      text not null,
  score_version  int  not null,
  priority_id    text not null,                -- engine id: pri_01, pri_02 ...
  sequence       int  not null,
  orientation    text not null,
  classification text not null,
  gap            text not null,                -- canonical decimal string
  urgency_tier   text not null,
  owner_role     text not null,
  due            date not null,
  trade_off_orientation text,
  linked_findings text[] not null default '{}',
  blocked_by     text[] not null default '{}', -- finding ids that block publishing this priority's actions
  primary key (assessment_id, score_version, priority_id),
  foreign key (assessment_id, score_version) references public.plan(assessment_id, score_version)
);
create trigger priority_immutable before update or delete on public.priority for each row execute function app.deny_mutation();

create table public.priority_zero_item (
  assessment_id text not null,
  tenant_id     text not null,
  score_version int  not null,
  item_id       text not null,                 -- engine id: p0_01 ...
  gate          text not null,
  item          text not null,
  finding_ids   text[] not null default '{}',
  completed_at  timestamptz,
  completed_by  uuid,
  completion_note text check (completion_note is null or length(completion_note) <= 1000),
  primary key (assessment_id, score_version, item_id),
  foreign key (assessment_id, score_version) references public.plan(assessment_id, score_version)
);

create table public.action (
  action_id      text primary key default app.new_id('act'),
  tenant_id      text not null,
  assessment_id  text not null,
  score_version  int  not null,
  priority_id    text not null,
  engine_ref     text not null,                -- the engine's own id (act_101 ...)
  level          text not null check (level in ('ORGANISATION', 'UNIT', 'LEADER')),
  orientation    text not null,
  objective      text not null,
  intervention   text not null,
  horizon        text not null check (horizon in ('QUICK_WIN_0_3M', 'MEDIUM_3_12M', 'STRUCTURAL_12M_PLUS')),
  is_visible_signal boolean not null default false,
  system_lever   text,
  generated_by   text not null,
  impact         text not null,
  urgency        int  not null,
  effort         int  not null,
  priority_score text not null,
  review_points  text[] not null default '{}',
  status         text not null default 'DRAFT' check (status in ('DRAFT', 'IN_REVIEW', 'IN_CO_DESIGN', 'APPROVED', 'PUBLISHED', 'IN_PROGRESS', 'UNDER_REVIEW', 'CLOSED', 'RETIRED', 'DISCARDED')),
  owner          text check (owner is null or length(btrim(owner)) between 1 and 120),
  sponsor        text check (sponsor is null or length(btrim(sponsor)) between 1 and 120),
  kpi            text check (kpi is null or length(btrim(kpi)) between 1 and 200),
  baseline_value text check (baseline_value is null or baseline_value ~ '^-?\d{1,12}(\.\d{1,6})?$'),
  target_value   text check (target_value is null or target_value ~ '^-?\d{1,12}(\.\d{1,6})?$'),
  budget_amount  numeric(14, 2) check (budget_amount is null or budget_amount >= 0),
  start_date     date not null,
  end_date       date not null check (end_date >= start_date),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (assessment_id, score_version, engine_ref),
  foreign key (assessment_id, score_version, priority_id) references public.priority(assessment_id, score_version, priority_id)
);
create index action_asm_idx on public.action (assessment_id, score_version);
create trigger action_touch before insert or update on public.action for each row execute function app.touch();

create table public.action_event (
  event_id    text primary key default app.new_id('ace'),
  tenant_id   text not null,
  action_id   text not null references public.action(action_id),
  from_status text,
  to_status   text not null,
  actor_id    uuid,
  reason      text check (reason is null or length(reason) <= 1000),
  at          timestamptz not null default now()
);
create index action_event_action_idx on public.action_event (action_id, at);

create table public.kpi_reading (
  reading_id text primary key default app.new_id('kpr'),
  tenant_id  text not null,
  action_id  text not null references public.action(action_id),
  value      text not null check (value ~ '^-?\d{1,12}(\.\d{1,6})?$'),
  read_on    date not null check (read_on <= current_date + 1),
  note       text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(), created_by uuid
);
create index kpi_reading_action_idx on public.kpi_reading (action_id, read_on);

create table public.action_evidence (
  evidence_id text primary key default app.new_id('evd'),
  tenant_id   text not null,
  action_id   text not null references public.action(action_id),
  kind        text not null check (kind in ('DOCUMENT', 'MINUTES', 'KPI_REPORT')),
  description text not null check (length(btrim(description)) between 3 and 1000),
  link        text check (link is null or (length(link) <= 500 and link ~ '^https://')),
  created_at  timestamptz not null default now(), created_by uuid
);

do $$
declare t text;
begin
  foreach t in array array['action_event', 'kpi_reading', 'action_evidence'] loop
    execute format('create trigger %I before update or delete on public.%I for each row execute function app.deny_mutation()', t || '_append_only', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- the database's own checks on actions

create function app.action_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare open_gates text[];
begin
  if new.status is distinct from old.status then
    if coalesce(current_setting('cdp.action_transition', true), '') <> new.action_id then
      raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'status changes go through rpc_action_transition';
    end if;
    if new.status = 'PUBLISHED' then
      select array_agg(f) into open_gates
      from (select unnest(p.blocked_by) as f from public.priority p
            where p.assessment_id = new.assessment_id and p.score_version = new.score_version and p.priority_id = new.priority_id) b
      where not exists (select 1 from public.priority_zero_item z
                        where z.assessment_id = new.assessment_id and z.score_version = new.score_version
                          and z.completed_at is not null and b.f = any (z.finding_ids));
      if open_gates is not null then
        raise exception 'BLOCKING_GATE_OPEN' using errcode = 'P0001', detail = array_to_string(open_gates, ',');
      end if;
    end if;
    if new.status = 'CLOSED' and not exists (select 1 from public.action_evidence e where e.action_id = new.action_id) then
      raise exception 'EVIDENCE_REQUIRED' using errcode = 'P0001';
    end if;
  end if;
  if (new.owner, new.sponsor, new.kpi, new.baseline_value, new.target_value, new.budget_amount, new.start_date, new.end_date)
       is distinct from (old.owner, old.sponsor, old.kpi, old.baseline_value, old.target_value, old.budget_amount, old.start_date, old.end_date)
     and old.status not in ('DRAFT', 'IN_REVIEW', 'IN_CO_DESIGN') then
    raise exception 'ACTION_LOCKED' using errcode = 'P0001';
  end if;
  if (new.action_id, new.tenant_id, new.assessment_id, new.score_version, new.priority_id, new.engine_ref, new.objective, new.intervention, new.horizon)
       is distinct from (old.action_id, old.tenant_id, old.assessment_id, old.score_version, old.priority_id, old.engine_ref, old.objective, old.intervention, old.horizon) then
    raise exception 'ACTION_LOCKED' using errcode = 'P0001', detail = 'generated fields do not change';
  end if;
  return new;
end $$;
create trigger action_guard before update on public.action for each row execute function app.action_guard();
create trigger action_no_delete before delete on public.action for each row execute function app.deny_mutation();

-- the actor holds a role on the action's engagement (assigned consultant, or a client member of the tenant)
create function app.on_engagement(p_actor uuid, p_assessment text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true) and exists (
    select 1 from public.assessment a
    where a.assessment_id = p_assessment
      and (exists (select 1 from app.engagement_assignment g where g.user_id = p_actor and g.engagement_id = a.engagement_id and now() >= g.valid_from and now() < g.valid_to)
           or exists (select 1 from app.membership m where m.user_id = p_actor and m.tenant_id = a.tenant_id
                      and m.role in ('CLIENT_ADMIN', 'EXECUTIVE', 'PEOPLE_LEADER')
                      and app.score_released(a.assessment_id, (select max(x.version) from public.score_object x where x.assessment_id = a.assessment_id)))))
$$;
revoke execute on function app.on_engagement(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- writes: service_role wrappers

-- Stores one engine plan with its rows, once per score version. The route has run buildPlan on the frozen score.
create function public.rpc_plan_store(p_actor uuid, p_assessment text, p_version int, p_start date, p_plan jsonb, p_hash text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a record; p jsonb; x jsonb; n int := 0;
begin
  select * into a from public.assessment where assessment_id = p_assessment;
  if not found or not exists (select 1 from app.engagement_assignment g where g.user_id = p_actor and g.engagement_id = a.engagement_id and now() >= g.valid_from and now() < g.valid_to) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.plan where assessment_id = p_assessment and score_version = p_version) then
    return jsonb_build_object('created', false);
  end if;
  insert into public.plan (assessment_id, tenant_id, score_version, start_date, payload_json, payload_hash, created_by)
  values (p_assessment, a.tenant_id, p_version, p_start, p_plan, p_hash, p_actor);
  if jsonb_typeof(p_plan -> 'priority_zero') = 'object' then
    insert into public.priority_zero_item (assessment_id, tenant_id, score_version, item_id, gate, item, finding_ids)
    select p_assessment, a.tenant_id, p_version, z ->> 'item_id', z ->> 'gate', z ->> 'item',
           array(select jsonb_array_elements_text(z -> 'finding_ids'))
    from jsonb_array_elements(p_plan -> 'priority_zero' -> 'items') z;
  end if;
  for p in select * from jsonb_array_elements(p_plan -> 'priorities') loop
    insert into public.priority (assessment_id, tenant_id, score_version, priority_id, sequence, orientation, classification, gap, urgency_tier,
                                 owner_role, due, trade_off_orientation, linked_findings, blocked_by)
    values (p_assessment, a.tenant_id, p_version, p ->> 'priority_id', (p ->> 'sequence')::int, p ->> 'orientation', p ->> 'classification',
            p ->> 'gap', p ->> 'urgency_tier', p ->> 'owner_role', (p ->> 'due')::date, p ->> 'trade_off_orientation',
            array(select jsonb_array_elements_text(p -> 'linked_findings')), array(select jsonb_array_elements_text(p -> 'blocked_by')));
    for x in select * from jsonb_array_elements(p -> 'actions') loop
      insert into public.action (tenant_id, assessment_id, score_version, priority_id, engine_ref, level, orientation, objective, intervention, horizon,
                                 is_visible_signal, system_lever, generated_by, impact, urgency, effort, priority_score, review_points,
                                 kpi, baseline_value, target_value, start_date, end_date, created_by)
      values (a.tenant_id, p_assessment, p_version, p ->> 'priority_id', x ->> 'action_id', x ->> 'level', x ->> 'orientation', x ->> 'objective',
              x ->> 'intervention', x ->> 'horizon', (x ->> 'is_visible_signal')::boolean, x ->> 'system_lever', x ->> 'generated_by',
              x ->> 'impact', (x ->> 'urgency')::int, (x ->> 'effort')::int, x ->> 'priority_score',
              array(select jsonb_array_elements_text(x -> 'review_points')), x ->> 'kpi', x ->> 'baseline_value', x ->> 'target_value',
              (x ->> 'start_date')::date, (x ->> 'end_date')::date, p_actor);
      n := n + 1;
    end loop;
  end loop;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id, payload_hash)
  values (a.tenant_id, p_actor, 'plan.created', 'assessment', p_assessment, p_hash);
  return jsonb_build_object('created', true, 'actions', n);
end $$;

-- p_fields: any of owner, sponsor, kpi, baseline_value, target_value, budget_amount, start_date, end_date (null clears).
create function public.rpc_action_update(p_actor uuid, p_action text, p_fields jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record; k text;
begin
  select * into r from public.action where action_id = p_action for update;
  if not found or not exists (select 1 from public.assessment a join app.engagement_assignment g on g.engagement_id = a.engagement_id
                              where a.assessment_id = r.assessment_id and g.user_id = p_actor and now() >= g.valid_from and now() < g.valid_to) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
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

-- Moves an action from the status the caller saw (p_from) to p_to. The route has already run the engine's transition rule.
create function public.rpc_action_transition(p_actor uuid, p_action text, p_from text, p_to text, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  select * into r from public.action where action_id = p_action for update;
  if not found or not app.on_engagement(p_actor, r.assessment_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if r.status <> p_from then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'the action changed; reload'; end if;
  perform set_config('cdp.action_transition', p_action, true);
  update public.action set status = p_to, updated_by = p_actor where action_id = p_action;
  perform set_config('cdp.action_transition', '', true);
  insert into public.action_event (tenant_id, action_id, from_status, to_status, actor_id, reason) values (r.tenant_id, p_action, p_from, p_to, p_actor, nullif(btrim(p_reason), ''));
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (r.tenant_id, p_actor, 'action.' || lower(p_to), 'action', p_action);
end $$;

create function public.rpc_kpi_reading_add(p_actor uuid, p_action text, p_value text, p_read_on date, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  select * into r from public.action where action_id = p_action;
  if not found or not app.on_engagement(p_actor, r.assessment_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if r.status not in ('PUBLISHED', 'IN_PROGRESS', 'UNDER_REVIEW') then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'readings are recorded once the action is published'; end if;
  insert into public.kpi_reading (tenant_id, action_id, value, read_on, note, created_by) values (r.tenant_id, p_action, p_value, p_read_on, nullif(btrim(p_note), ''), p_actor);
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'reading';
end $$;

create function public.rpc_evidence_add(p_actor uuid, p_action text, p_kind text, p_description text, p_link text) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  select * into r from public.action where action_id = p_action;
  if not found or not app.on_engagement(p_actor, r.assessment_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if r.status not in ('PUBLISHED', 'IN_PROGRESS', 'UNDER_REVIEW') then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'evidence is added once the action is published'; end if;
  insert into public.action_evidence (tenant_id, action_id, kind, description, link, created_by)
  values (r.tenant_id, p_action, p_kind, btrim(p_description), nullif(btrim(p_link), ''), p_actor);
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'evidence';
end $$;

-- A P0 item is recorded as done by the assigned consultant or the tenant's Executive (the CEO and CHRO own it).
create function public.rpc_p0_complete(p_actor uuid, p_assessment text, p_version int, p_item text, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare a record;
begin
  select * into a from public.assessment where assessment_id = p_assessment;
  if not found or not (
       exists (select 1 from app.engagement_assignment g where g.user_id = p_actor and g.engagement_id = a.engagement_id and now() >= g.valid_from and now() < g.valid_to)
       or (exists (select 1 from app.membership m where m.user_id = p_actor and m.tenant_id = a.tenant_id and m.role = 'EXECUTIVE')
           and app.score_released(p_assessment, p_version))) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 3 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'say what was done'; end if;
  update public.priority_zero_item set completed_at = now(), completed_by = p_actor, completion_note = btrim(p_note)
  where assessment_id = p_assessment and score_version = p_version and item_id = p_item and completed_at is null;
  if not found then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'unknown or already completed'; end if;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (a.tenant_id, p_actor, 'p0.completed:' || p_item, 'assessment', p_assessment);
end $$;

-- ---------------------------------------------------------------- privileges and RLS (reads only)

alter table public.plan               enable row level security;
alter table public.priority           enable row level security;
alter table public.priority_zero_item enable row level security;
alter table public.action             enable row level security;
alter table public.action_event       enable row level security;
alter table public.kpi_reading        enable row level security;
alter table public.action_evidence    enable row level security;
revoke all on public.plan, public.priority, public.priority_zero_item, public.action, public.action_event, public.kpi_reading, public.action_evidence
  from public, anon, authenticated, service_role;
grant select on public.plan, public.priority, public.priority_zero_item, public.action, public.action_event, public.kpi_reading, public.action_evidence
  to authenticated, service_role;

-- assigned consultant, or a client lead role once a report on this score version is released
create function app.plan_visible(p_tenant text, p_assessment text, p_version int) returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_assessment in (select a.assessment_id from public.assessment a where a.engagement_id in (select app.pac_engagement_ids()))
      or (p_tenant = app.client_tenant_id() and app.client_role() in ('CLIENT_ADMIN', 'EXECUTIVE', 'PEOPLE_LEADER')
          and app.score_released(p_assessment, p_version))
$$;
revoke execute on function app.plan_visible(text, text, int) from public, anon;
grant execute on function app.plan_visible(text, text, int) to authenticated;

create policy plan_read on public.plan for select to authenticated using ((select app.plan_visible(tenant_id, assessment_id, score_version)));
create policy priority_read on public.priority for select to authenticated using ((select app.plan_visible(tenant_id, assessment_id, score_version)));
create policy p0_read on public.priority_zero_item for select to authenticated using ((select app.plan_visible(tenant_id, assessment_id, score_version)));
create policy action_read on public.action for select to authenticated using (
  (select app.plan_visible(tenant_id, assessment_id, score_version))
  and (status not in ('DRAFT', 'IN_REVIEW', 'DISCARDED')
       or assessment_id in (select a.assessment_id from public.assessment a where a.engagement_id in (select app.pac_engagement_ids()))));
create policy action_event_read on public.action_event for select to authenticated using (exists (select 1 from public.action x where x.action_id = action_event.action_id));
create policy kpi_reading_read on public.kpi_reading for select to authenticated using (exists (select 1 from public.action x where x.action_id = kpi_reading.action_id));
create policy action_evidence_read on public.action_evidence for select to authenticated using (exists (select 1 from public.action x where x.action_id = action_evidence.action_id));

revoke execute on function public.rpc_plan_store(uuid, text, int, date, jsonb, text), public.rpc_action_update(uuid, text, jsonb),
                           public.rpc_action_transition(uuid, text, text, text, text), public.rpc_kpi_reading_add(uuid, text, text, date, text),
                           public.rpc_evidence_add(uuid, text, text, text, text), public.rpc_p0_complete(uuid, text, int, text, text)
  from public, anon, authenticated;
grant  execute on function public.rpc_plan_store(uuid, text, int, date, jsonb, text), public.rpc_action_update(uuid, text, jsonb),
                           public.rpc_action_transition(uuid, text, text, text, text), public.rpc_kpi_reading_add(uuid, text, text, date, text),
                           public.rpc_evidence_add(uuid, text, text, text, text), public.rpc_p0_complete(uuid, text, int, text, text)
  to service_role;
