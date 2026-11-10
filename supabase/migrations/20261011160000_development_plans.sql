-- 16 Leader development plans (spec §5.5.8, engine draftDevelopmentPlan). Approved with the batch plan, 11 Oct 2026.
--   * One row per development item: the engine drafts up to three per leader with a valid 360 result (growth orientation,
--     leadership target orientation, one blind-spot section). The consultant completes start/stop/keep, the behaviour and the
--     visible change in 30 days, then agrees the plan; agreed items no longer change.
--   * Reads: the assigned PAC Consultant; the tenant's Coach once a report on that score version is released (coaches deliver
--     the development support). Leaders themselves cannot read it yet: logins are not linked to people (People Leader view).
--     Client Admin and Executive do not see individual development plans.
--   * Writes only through the service-role wrappers below, which re-check the consultant's assignment.

create table public.development_item (
  item_id        text primary key default app.new_id('ldp'),
  tenant_id      text not null,
  assessment_id  text not null,
  score_version  int  not null,
  assignment_id  text not null references public.leader_assignment(assignment_id),
  seq            int  not null check (seq between 1 and 3),
  basis          text not null check (basis in ('GROWTH', 'TARGET', 'BLIND_SPOT')),
  orientation    text,
  section        text,
  support        text not null,
  start_stop_keep text check (start_stop_keep is null or start_stop_keep in ('START', 'STOP', 'KEEP')),
  behaviour      text check (behaviour is null or length(btrim(behaviour)) between 3 and 500),
  visible_change_30d text check (visible_change_30d is null or length(btrim(visible_change_30d)) between 3 and 500),
  agreed_at      timestamptz,
  agreed_by      uuid,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (assessment_id, score_version, assignment_id, seq),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create trigger development_item_touch before insert or update on public.development_item for each row execute function app.touch();

create function app.development_item_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.agreed_at is not null then raise exception 'PLAN_AGREED' using errcode = 'P0001'; end if;
  if (new.item_id, new.tenant_id, new.assessment_id, new.score_version, new.assignment_id, new.seq, new.basis, new.orientation, new.section, new.support)
       is distinct from (old.item_id, old.tenant_id, old.assessment_id, old.score_version, old.assignment_id, old.seq, old.basis, old.orientation, old.section, old.support) then
    raise exception 'PLAN_AGREED' using errcode = 'P0001', detail = 'drafted fields do not change';
  end if;
  return new;
end $$;
create trigger development_item_guard before update on public.development_item for each row execute function app.development_item_guard();
create trigger development_item_no_delete before delete on public.development_item for each row execute function app.deny_mutation();

alter table public.development_item enable row level security;
revoke all on public.development_item from public, anon, authenticated, service_role;
grant select on public.development_item to authenticated, service_role;
create policy development_item_read on public.development_item for select to authenticated using (
  assessment_id in (select a.assessment_id from public.assessment a where a.engagement_id in (select app.pac_engagement_ids()))
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'COACH' and (select app.score_released(assessment_id, score_version))));

create function app.consultant_on(p_actor uuid, p_assessment text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true) and exists (
    select 1 from public.assessment a join app.engagement_assignment g on g.engagement_id = a.engagement_id
    where a.assessment_id = p_assessment and g.user_id = p_actor and now() >= g.valid_from and now() < g.valid_to)
$$;
revoke execute on function app.consultant_on(uuid, text) from public, anon, authenticated;

-- p_items: [{ assignment_id, seq, basis, orientation, section, support }] from the engine. Inserts what is missing only.
create function public.rpc_development_store(p_actor uuid, p_assessment text, p_version int, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare tid text; n int;
begin
  if not app.consultant_on(p_actor, p_assessment) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select tenant_id into tid from public.assessment where assessment_id = p_assessment;
  insert into public.development_item (tenant_id, assessment_id, score_version, assignment_id, seq, basis, orientation, section, support, created_by)
  select tid, p_assessment, p_version, x.assignment_id, x.seq, x.basis, x.orientation, x.section, x.support, p_actor
  from jsonb_to_recordset(p_items) as x(assignment_id text, seq int, basis text, orientation text, section text, support text)
  on conflict (assessment_id, score_version, assignment_id, seq) do nothing;
  get diagnostics n = row_count;
  if n > 0 then insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (tid, p_actor, 'ldp.drafted:' || n, 'assessment', p_assessment); end if;
  return jsonb_build_object('drafted', n);
exception when check_violation or foreign_key_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'development item';
end $$;

-- p_fields: start_stop_keep, behaviour, visible_change_30d (null clears).
create function public.rpc_development_update(p_actor uuid, p_item text, p_fields jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record; k text;
begin
  select * into r from public.development_item where item_id = p_item for update;
  if not found or not app.consultant_on(p_actor, r.assessment_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  for k in select jsonb_object_keys(p_fields) loop
    if k not in ('start_stop_keep', 'behaviour', 'visible_change_30d') then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown field ' || k; end if;
  end loop;
  update public.development_item set
    start_stop_keep    = case when p_fields ? 'start_stop_keep' then nullif(p_fields ->> 'start_stop_keep', '') else start_stop_keep end,
    behaviour          = case when p_fields ? 'behaviour' then nullif(btrim(p_fields ->> 'behaviour'), '') else behaviour end,
    visible_change_30d = case when p_fields ? 'visible_change_30d' then nullif(btrim(p_fields ->> 'visible_change_30d'), '') else visible_change_30d end,
    updated_by = p_actor
  where item_id = p_item;
exception when check_violation then
  raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'development item';
end $$;

-- Agrees every item of one leader's plan, once each is complete.
create function public.rpc_development_agree(p_actor uuid, p_assessment text, p_version int, p_assignment text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare n int; tid text;
begin
  if not app.consultant_on(p_actor, p_assessment) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.development_item where assessment_id = p_assessment and score_version = p_version and assignment_id = p_assignment) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'no plan for this leader';
  end if;
  if exists (select 1 from public.development_item where assessment_id = p_assessment and score_version = p_version and assignment_id = p_assignment
             and (start_stop_keep is null or behaviour is null or visible_change_30d is null)) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'complete every item first';
  end if;
  select tenant_id into tid from public.assessment where assessment_id = p_assessment;
  update public.development_item set agreed_at = now(), agreed_by = p_actor, updated_by = p_actor
  where assessment_id = p_assessment and score_version = p_version and assignment_id = p_assignment and agreed_at is null;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'PLAN_AGREED' using errcode = 'P0001'; end if;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (tid, p_actor, 'ldp.agreed', 'leader_assignment', p_assignment);
  return jsonb_build_object('agreed', n);
end $$;

revoke execute on function public.rpc_development_store(uuid, text, int, jsonb), public.rpc_development_update(uuid, text, jsonb),
                           public.rpc_development_agree(uuid, text, int, text) from public, anon, authenticated;
grant  execute on function public.rpc_development_store(uuid, text, int, jsonb), public.rpc_development_update(uuid, text, jsonb),
                           public.rpc_development_agree(uuid, text, int, text) to service_role;
