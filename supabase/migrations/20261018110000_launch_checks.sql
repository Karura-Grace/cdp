-- Journey 1, launch slice (j1-launch).
--   1. platform_setting: platform wide switches. The first is the owner's approval of the DRAFT staff message templates (launch is blocked
--      while a template is in use and not approved). Only a Super Admin can write it (through the API); nobody else can read or write it
--      from a user token.
--   2. rater proposals: a leader proposes raters, the line manager or the Client Admin approves (spec 1.4.6, D-09).
--   3. rpc_assessment_new_version made usable end to end: it now also carries over the consent text and nominations, returns the engagement to
--      SETUP so the new draft can be launched, clears the launch approval, and removes the launch snapshot so the next launch can write its own.
--   4. assessment.completion_estimate_text: the completion time statement the Client Admin may update after launch (spec 2.5, D-11). A text
--      only change that does not touch the locked setup rows.
--   5. rpc_completion_stats: count and median completion time of the submitted responses, as numbers only (never one response).

-- ---------------------------------------------------------------- 1 platform settings
create table public.platform_setting (
  key        text primary key check (key ~ '^[a-z_]{3,60}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.platform_setting enable row level security;
revoke all on public.platform_setting from anon, authenticated;
grant select on public.platform_setting to authenticated;
grant all on public.platform_setting to service_role;
create policy platform_setting_read on public.platform_setting for select to authenticated using ((select app.is_super_admin()));
insert into public.platform_setting (key, value) values ('staff_templates_approved', '{"approved_version": null}'::jsonb);

-- ---------------------------------------------------------------- 2 rater proposals
create function public.rpc_nominations_propose(p_actor uuid, p_assessment text, p_assignment text, p_noms jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a record; la record; mem record; has_mem boolean; who text; n int; peers int;
begin
  select * into a from public.assessment where assessment_id = p_assessment for update;
  if not found or a.frozen_at is not null or a.status not in ('DRAFT', 'LAUNCHED') then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001'; end if;
  select * into la from public.leader_assignment where assignment_id = p_assignment and tenant_id = a.tenant_id;
  if not found then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown leader'; end if;
  select * into mem from app.membership where user_id = p_actor;
  has_mem := found;
  if p_actor is null or not coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if has_mem and mem.tenant_id = a.tenant_id and mem.role = 'PEOPLE_LEADER' and mem.person_id = la.person_id then who := la.person_id;                 -- the leader themselves
  elsif has_mem and mem.tenant_id = a.tenant_id and mem.role = 'CLIENT_ADMIN' then who := 'user:' || p_actor::text;                                       -- on the leader's behalf
  elsif exists (select 1 from app.engagement_assignment g where g.user_id = p_actor and g.engagement_id = a.engagement_id and now() >= g.valid_from and now() < g.valid_to) then who := 'user:' || p_actor::text;
  else raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_noms) <> 'array' or jsonb_array_length(p_noms) > 40 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'at most 40 raters per leader'; end if;
  if exists (select 1 from jsonb_to_recordset(p_noms) as x(person_id text) where x.person_id = la.person_id) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a leader cannot rate themselves as a rater';
  end if;
  select count(*) into peers from (
    select x.person_id from jsonb_to_recordset(p_noms) as x(person_id text, rater_group text) where x.rater_group = 'PEER'
    union
    select r.rater_person_id from public.rater_nomination r where r.assessment_id = p_assessment and r.assignment_id = p_assignment and r.rater_group = 'PEER' and r.status <> 'PROPOSED') t;
  if peers > 8 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'at most 8 peers'; end if;
  delete from public.rater_nomination where assessment_id = p_assessment and assignment_id = p_assignment and status = 'PROPOSED';
  insert into public.rater_nomination (tenant_id, assessment_id, assignment_id, rater_person_id, rater_group, status, proposed_by, created_by)
  select a.tenant_id, p_assessment, p_assignment, x.person_id, x.rater_group, 'PROPOSED', who, p_actor
  from jsonb_to_recordset(p_noms) as x(person_id text, rater_group text)
  on conflict (assessment_id, assignment_id, rater_person_id) do nothing;
  get diagnostics n = row_count;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (a.tenant_id, p_actor, 'l360.raters_proposed', 'leader_assignment', p_assignment);
  return jsonb_build_object('proposed', n);
exception when foreign_key_violation or check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown person or relationship';
end $$;

create function public.rpc_nominations_decide(p_actor uuid, p_assessment text, p_assignment text, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a record; la record; mem record; has_mem boolean; mgr text; d date; n int; peers int;
begin
  select * into a from public.assessment where assessment_id = p_assessment for update;
  if not found or a.frozen_at is not null or a.status not in ('DRAFT', 'LAUNCHED') then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001'; end if;
  select * into la from public.leader_assignment where assignment_id = p_assignment and tenant_id = a.tenant_id;
  if not found then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown leader'; end if;
  if p_actor is null or not coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into mem from app.membership where user_id = p_actor;
  has_mem := found;
  if not (has_mem and mem.tenant_id = a.tenant_id and mem.role = 'CLIENT_ADMIN') then
    -- the line manager: whoever leads the team the leader sits in, on the window start date
    d := coalesce((a.window_open at time zone 'UTC')::date, current_date);
    select l2.person_id into mgr from public.person_of_record p
      join public.leader_assignment l2 on l2.team_id = p.unit_id and l2.tenant_id = p.tenant_id and l2.effect_from <= d and (l2.effect_to is null or l2.effect_to >= d)
      where p.person_id = la.person_id and l2.person_id <> la.person_id limit 1;
    if not (has_mem and mem.tenant_id = a.tenant_id and mem.role = 'PEOPLE_LEADER' and mgr is not null and mem.person_id = mgr) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
  end if;
  if not exists (select 1 from public.rater_nomination where assessment_id = p_assessment and assignment_id = p_assignment and status = 'PROPOSED') then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'nothing is waiting for approval';
  end if;
  if p_approve then
    select count(*) into peers from public.rater_nomination where assessment_id = p_assessment and assignment_id = p_assignment and rater_group = 'PEER';
    if peers not between 3 and 8 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'peers must be 3 to 8'; end if;
    update public.rater_nomination set status = 'NOMINATED', approved_by = p_actor, approved_at = now()
      where assessment_id = p_assessment and assignment_id = p_assignment and status = 'PROPOSED';
  else
    delete from public.rater_nomination where assessment_id = p_assessment and assignment_id = p_assignment and status = 'PROPOSED';
  end if;
  get diagnostics n = row_count;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id)
  values (a.tenant_id, p_actor, case when p_approve then 'l360.raters_approved' else 'l360.raters_rejected' end, 'leader_assignment', p_assignment);
  return jsonb_build_object('decided', n, 'approved', p_approve);
end $$;

revoke execute on function public.rpc_nominations_propose(uuid, text, text, jsonb), public.rpc_nominations_decide(uuid, text, text, boolean) from public, anon, authenticated;
grant  execute on function public.rpc_nominations_propose(uuid, text, text, jsonb), public.rpc_nominations_decide(uuid, text, text, boolean) to service_role;

-- ---------------------------------------------------------------- 3 assessment versions, usable end to end
create function app.snapshot_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.setup_unlock', true), '') = 'on' then return old; end if;
  raise exception 'APPEND_ONLY' using errcode = 'P0001', detail = tg_table_name;
end $$;
drop trigger org_graph_snapshot_immutable on public.org_graph_snapshot;
create trigger org_graph_snapshot_immutable before update or delete on public.org_graph_snapshot for each row execute function app.snapshot_guard();

create or replace function public.rpc_assessment_new_version(p_assessment text, p_reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare a public.assessment; nid text;
begin
  select * into a from public.assessment where assessment_id = p_assessment for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if a.status <> 'LAUNCHED' then raise exception 'ASSESSMENT_NOT_LAUNCHED' using errcode = 'P0001'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 1 and 500 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a reason is required'; end if;
  if exists (select 1 from capture.response r where r.assessment_id = p_assessment)
     or exists (select 1 from capture.invitation i where i.assessment_id = p_assessment and i.submitted_at is not null) then
    raise exception 'RESPONSES_EXIST' using errcode = 'P0001', detail = 'a new version cannot replace an assessment that already has responses';
  end if;
  perform set_config('app.setup_unlock', 'on', true);
  update public.setup_record set locked_at = null, status = case when status = 'AGREED' then 'SUBMITTED' else status end where engagement_id = a.engagement_id;
  update public.assessment set status = 'SUPERSEDED' where assessment_id = p_assessment;
  delete from public.org_graph_snapshot where engagement_id = a.engagement_id;
  update public.engagement set setup_version = setup_version + 1, setup_snapshot = null, state = 'SETUP', launch_approved_by = null, launch_approved_at = null
    where engagement_id = a.engagement_id;
  insert into public.assessment (tenant_id, engagement_id, instrument_version_id, rules_version_id, window_open, window_close, status, consent_text_id, supersedes_assessment_id, version_reason)
    values (a.tenant_id, a.engagement_id, a.instrument_version_id, a.rules_version_id, a.window_open, a.window_close, 'DRAFT', a.consent_text_id, p_assessment, btrim(p_reason))
    returning assessment_id into nid;
  insert into public.rater_nomination (tenant_id, assessment_id, assignment_id, rater_person_id, rater_group, status, proposed_by, approved_by, approved_at, created_by)
    select tenant_id, nid, assignment_id, rater_person_id, rater_group, case when status = 'INVITED' then 'NOMINATED' else status end, proposed_by, approved_by, approved_at, created_by
    from public.rater_nomination where assessment_id = p_assessment;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (a.tenant_id, null, 'assessment.new_version', 'assessment', nid);
  return nid;
end $$;

-- ---------------------------------------------------------------- 4 completion time statement after launch
alter table public.assessment add column completion_estimate_text text check (completion_estimate_text is null or length(btrim(completion_estimate_text)) between 1 and 60);

-- ---------------------------------------------------------------- 5 completion statistics, numbers only
-- The median is returned only when at least p_min responses carry a duration, so a handful of answers never shows through it.
create function public.rpc_completion_stats(p_assessment text, p_min int) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('complete', count(*),
    'median_seconds', case when count(duration_seconds) >= greatest(p_min, 1) then (percentile_cont(0.5) within group (order by duration_seconds))::int end)
  from capture.response where assessment_id = p_assessment and voided_reason is null
$$;
revoke execute on function public.rpc_completion_stats(text, int) from public, anon, authenticated;
grant  execute on function public.rpc_completion_stats(text, int) to service_role;
