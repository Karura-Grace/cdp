-- 21 Measure stage, step C: adjust or retire at the 90 and 180 day reviews (spec §6.5, engine adjustOrRetire). Approved 14 Oct 2026.
--   * action_review: one insert only record per action and review point. It stores what the engine recommended, what the
--     assigned PAC consultant decided (it may differ, with a reason), and the inputs the engine was given.
--   * A review is recorded while the action is UNDER_REVIEW, the state the engine's own workflow uses for it. The app then
--     moves the action with the existing engine transition (back to IN_PROGRESS, or to RETIRED); this table never changes a status.
--   * Client roles read reviews of an action only after the report on its score version is released.

create table public.action_review (
  review_id       text primary key default app.new_id('arv'),
  tenant_id       text not null,
  engagement_id   text not null references public.engagement(engagement_id),
  assessment_id   text not null,
  score_version   int  not null,
  action_id       text not null references public.action(action_id),
  review_point    text not null check (review_point in ('+90d', '+180d')),
  engine_decision text not null check (engine_decision in ('CONTINUE', 'ADJUST_INTERVENTION', 'ADJUST_RESOURCING', 'SUSPEND_AND_REDIAGNOSE',
                    'RETIRE_AND_REINSTATE_PRECONDITION', 'RETIRE_SUPERSEDED', 'REASSIGN_WITHIN_14_DAYS', 'RETIRE_NOT_ACHIEVED')),
  final_decision  text not null check (final_decision in ('CONTINUE', 'ADJUST_INTERVENTION', 'ADJUST_RESOURCING', 'SUSPEND_AND_REDIAGNOSE',
                    'RETIRE_AND_REINSTATE_PRECONDITION', 'RETIRE_SUPERSEDED', 'REASSIGN_WITHIN_14_DAYS', 'RETIRE_NOT_ACHIEVED')),
  override_reason text check (override_reason is null or length(override_reason) <= 1000),
  inputs_json     jsonb not null,
  decided_by      uuid,
  decided_at      timestamptz not null default now(),
  unique (action_id, review_point),
  check (final_decision = engine_decision or length(btrim(coalesce(override_reason, ''))) >= 3)
);
create index action_review_eng_idx on public.action_review (engagement_id);
create trigger action_review_append_only before update or delete on public.action_review for each row execute function app.deny_mutation();

-- ---------------------------------------------------------------- write (service role only)
-- The engine computed engine_decision from the inputs; the database checks who may record it, and when.
create function public.rpc_action_review_record(p_actor uuid, p_action text, p_point text, p_engine text, p_final text, p_reason text, p_inputs jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare a record; e text; id text;
begin
  select * into a from public.action where action_id = p_action;
  if not found then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select s.engagement_id into e from public.assessment s where s.assessment_id = a.assessment_id;
  if e is null or not app.consultant_on_engagement(p_actor, e) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if a.status <> 'UNDER_REVIEW' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'a review is recorded while the action is under review';
  end if;
  insert into public.action_review (tenant_id, engagement_id, assessment_id, score_version, action_id, review_point, engine_decision, final_decision,
                                    override_reason, inputs_json, decided_by)
  values (a.tenant_id, e, a.assessment_id, a.score_version, p_action, p_point, p_engine, p_final, nullif(btrim(p_reason), ''), p_inputs, p_actor)
  returning review_id into id;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id)
  values (a.tenant_id, p_actor, 'action_review.recorded:' || p_final, 'action', p_action);
  return id;
exception
  when check_violation then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'a reason is needed to override the engine';
  when unique_violation then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'this action already has a review at that point';
end $$;

revoke execute on function public.rpc_action_review_record(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.rpc_action_review_record(uuid, text, text, text, text, text, jsonb) to service_role;

-- ---------------------------------------------------------------- reads (RLS)
alter table public.action_review enable row level security;
revoke all on public.action_review from public, anon, authenticated, service_role;
grant select on public.action_review to authenticated, service_role;

create policy action_review_read on public.action_review for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')
      and (select app.score_released(assessment_id, score_version))));
