-- Journey 2 (owner ruling 19 October 2026): a new assessment version carries over each leader's rater window with the nominations,
-- so raters of the new version answer inside the same window. Same function as 20261018110000 otherwise.

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
  insert into public.rater_window (tenant_id, assessment_id, assignment_id, opens_on, closes_on, created_by)
    select tenant_id, nid, assignment_id, opens_on, closes_on, created_by from public.rater_window where assessment_id = p_assessment;
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (a.tenant_id, null, 'assessment.new_version', 'assessment', nid);
  return nid;
end $$;
