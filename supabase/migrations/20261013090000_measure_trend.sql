-- 19 Measure stage, step A: trend comparison and re-assessment triggers (spec chapter 6, S6-03 and S6-04). Approved 13 Oct 2026.
--   * A re-assessment is the next cycle's engagement (engagement.cycle_no, previous_engagement_id already exist) with its own assessment.
--   * org_change: a recorded material change in the organisation. Insert only.
--   * reassessment_trigger: something that opens a consultant review. Raised by the platform or the consultant, decided once
--     (ACCEPTED or DISMISSED with a reason) by the assigned PAC consultant only.
--   * comparison: before and after deltas between two frozen assessments of one tenant, computed by the engine on the server and stored.
--     Insert only. A client role reads it only after the current report is released.

create function app.consultant_on_engagement(p_actor uuid, p_engagement text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true) and exists (
    select 1 from app.engagement_assignment g
    where g.engagement_id = p_engagement and g.user_id = p_actor and now() >= g.valid_from and now() < g.valid_to)
$$;
revoke execute on function app.consultant_on_engagement(uuid, text) from public, anon, authenticated;

create function app.client_admin_of(p_actor uuid, p_tenant text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from app.membership m join app.user_profile p using (user_id)
                 where m.user_id = p_actor and m.tenant_id = p_tenant and m.role = 'CLIENT_ADMIN' and p.active)
$$;
revoke execute on function app.client_admin_of(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- tables
create table public.org_change (
  org_change_id  text primary key default app.new_id('och'),
  tenant_id      text not null,
  engagement_id  text not null references public.engagement(engagement_id),
  type           text not null check (type in ('RESTRUCTURE', 'MERGER', 'NEW_CEO', 'MODEL_TRANSITION_LIVE', 'OTHER')),
  effective_date date not null,
  description    text not null check (length(btrim(description)) between 1 and 500),
  created_at timestamptz not null default now(), created_by uuid
);
create index org_change_eng_idx on public.org_change (engagement_id);

create table public.reassessment_trigger (
  trigger_id    text primary key default app.new_id('trg'),
  tenant_id     text not null,
  engagement_id text not null references public.engagement(engagement_id),
  type          text not null check (type in ('PULSE_MOVEMENT', 'STRUCTURAL_COMPLETE', 'ORG_CHANGE', 'BOARD_REQUEST', 'ANNUAL')),
  source_ref    text not null check (length(source_ref) between 1 and 120),
  raised_at     timestamptz not null default now(), raised_by uuid,
  decision      text check (decision in ('ACCEPTED', 'DISMISSED')),
  decided_by    uuid, decided_at timestamptz,
  reason        text check (reason is null or length(reason) <= 500),
  unique (engagement_id, type, source_ref),
  check ((decision is null) = (decided_at is null)),
  check (decision is distinct from 'DISMISSED' or length(btrim(coalesce(reason, ''))) > 0)
);

-- a trigger is decided once and nothing else about it changes
create function app.trigger_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then raise exception 'APPEND_ONLY' using errcode = 'P0001', detail = tg_table_name; end if;
  if old.decision is not null then raise exception 'ALREADY_DECIDED' using errcode = 'P0001'; end if;
  if (new.trigger_id, new.tenant_id, new.engagement_id, new.type, new.source_ref, new.raised_at)
     is distinct from (old.trigger_id, old.tenant_id, old.engagement_id, old.type, old.source_ref, old.raised_at) then
    raise exception 'APPEND_ONLY' using errcode = 'P0001', detail = tg_table_name;
  end if;
  return new;
end $$;
create trigger reassessment_trigger_guard before update or delete on public.reassessment_trigger for each row execute function app.trigger_guard();

create table public.comparison (
  comparison_id          text primary key default app.new_id('cmp'),
  tenant_id              text not null,
  engagement_id          text not null references public.engagement(engagement_id),     -- the current cycle
  baseline_assessment_id text not null references public.assessment(assessment_id),
  baseline_score_version int  not null,
  current_assessment_id  text not null references public.assessment(assessment_id),
  current_score_version  int  not null,
  version_relation       text not null check (version_relation in ('SAME', 'MINOR')),    -- MAJOR is refused, never stored
  deltas_json            jsonb not null,
  deltas_hash            text not null,
  created_at timestamptz not null default now(), created_by uuid,
  unique (baseline_assessment_id, baseline_score_version, current_assessment_id, current_score_version)
);
create index comparison_eng_idx on public.comparison (engagement_id);

create trigger org_change_append_only  before update or delete on public.org_change  for each row execute function app.deny_mutation();
create trigger comparison_append_only  before update or delete on public.comparison  for each row execute function app.deny_mutation();

-- ---------------------------------------------------------------- writes (service role only)
create function public.rpc_org_change_add(p_actor uuid, p_engagement text, p_type text, p_effective date, p_description text) returns text
language plpgsql security definer set search_path = ''
as $$
declare e record; id text;
begin
  select * into e from public.engagement where engagement_id = p_engagement;
  if not found or not (app.consultant_on_engagement(p_actor, p_engagement) or app.client_admin_of(p_actor, e.tenant_id)) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  insert into public.org_change (tenant_id, engagement_id, type, effective_date, description, created_by)
  values (e.tenant_id, p_engagement, p_type, p_effective, btrim(p_description), p_actor) returning org_change_id into id;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (e.tenant_id, p_actor, 'org_change.recorded', 'org_change', id);
  return id;
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'org change';
end $$;

-- raised by the platform on behalf of the assigned consultant, or by the consultant (for example a board request); the same trigger is never raised twice
create function public.rpc_trigger_raise(p_actor uuid, p_engagement text, p_type text, p_ref text) returns text
language plpgsql security definer set search_path = ''
as $$
declare e record; id text;
begin
  select * into e from public.engagement where engagement_id = p_engagement;
  if not found or not app.consultant_on_engagement(p_actor, p_engagement) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  insert into public.reassessment_trigger (tenant_id, engagement_id, type, source_ref, raised_by) values (e.tenant_id, p_engagement, p_type, p_ref, p_actor)
  on conflict (engagement_id, type, source_ref) do nothing returning trigger_id into id;
  if id is not null then
    insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (e.tenant_id, p_actor, 'trigger.raised', 'reassessment_trigger', id);
  end if;
  return id;
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'trigger';
end $$;

create function public.rpc_trigger_decide(p_actor uuid, p_trigger text, p_decision text, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare t record;
begin
  select * into t from public.reassessment_trigger where trigger_id = p_trigger;
  if not found or not app.consultant_on_engagement(p_actor, t.engagement_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if t.decision is not null then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'this trigger is already decided'; end if;
  update public.reassessment_trigger set decision = p_decision, reason = nullif(btrim(p_reason), ''), decided_by = p_actor, decided_at = now() where trigger_id = p_trigger;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (t.tenant_id, p_actor, 'trigger.' || lower(p_decision), 'reassessment_trigger', p_trigger);
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a reason is required to dismiss a trigger';
end $$;

-- the engine decided SAME or MINOR and computed the deltas; the database checks the two assessments belong together
create function public.rpc_comparison_store(p_actor uuid, p_baseline text, p_baseline_version int, p_current text, p_current_version int, p_relation text, p_deltas jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare b record; c record; id text;
begin
  select * into b from public.assessment where assessment_id = p_baseline;
  select * into c from public.assessment where assessment_id = p_current;
  if b.assessment_id is null or c.assessment_id is null or not app.consultant_on_engagement(p_actor, c.engagement_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if b.tenant_id <> c.tenant_id or b.status <> 'FROZEN' or c.status <> 'FROZEN'
     or not exists (select 1 from public.engagement e where e.engagement_id = c.engagement_id and e.previous_engagement_id = b.engagement_id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'the baseline must be the previous cycle of the same organisation, and both must be frozen';
  end if;
  insert into public.comparison (tenant_id, engagement_id, baseline_assessment_id, baseline_score_version, current_assessment_id, current_score_version,
                                 version_relation, deltas_json, deltas_hash, created_by)
  values (c.tenant_id, c.engagement_id, p_baseline, p_baseline_version, p_current, p_current_version, p_relation, p_deltas,
          'sha256:' || encode(extensions.digest(p_deltas::text, 'sha256'), 'hex'), p_actor)
  on conflict (baseline_assessment_id, baseline_score_version, current_assessment_id, current_score_version) do nothing returning comparison_id into id;
  if id is not null then
    insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (c.tenant_id, p_actor, 'comparison.stored', 'comparison', id);
  end if;
  return id;
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'comparison';
end $$;

revoke execute on function public.rpc_org_change_add(uuid, text, text, date, text), public.rpc_trigger_raise(uuid, text, text, text),
                           public.rpc_trigger_decide(uuid, text, text, text), public.rpc_comparison_store(uuid, text, int, text, int, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.rpc_org_change_add(uuid, text, text, date, text), public.rpc_trigger_raise(uuid, text, text, text),
                          public.rpc_trigger_decide(uuid, text, text, text), public.rpc_comparison_store(uuid, text, int, text, int, text, jsonb)
  to service_role;

-- ---------------------------------------------------------------- reads (RLS)
alter table public.org_change enable row level security;
alter table public.reassessment_trigger enable row level security;
alter table public.comparison enable row level security;
revoke all on public.org_change, public.reassessment_trigger, public.comparison from public, anon, authenticated, service_role;
grant select on public.org_change, public.reassessment_trigger, public.comparison to authenticated, service_role;

create policy org_change_read on public.org_change for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
create policy trigger_read on public.reassessment_trigger for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
create policy comparison_read on public.comparison for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE', 'PEOPLE_LEADER')
      and (select app.score_released(current_assessment_id, current_score_version))));
