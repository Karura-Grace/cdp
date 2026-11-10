-- Journey 3, slice S5 (owner approved 21 October 2026, docs/designs/J3-scoring-review.md): a consultant may void a response after
-- the data freeze and before the score freeze. Same function and grants as 20261020050000; only the state check changes.
--   open survey (LAUNCHED, not frozen): as before.
--   data frozen (frozen_at set) and no frozen score version: allowed. The route then recomputes the response set hash and records
--   the void in the freeze manifest; the next score is a new version because its payload hash differs.
--   a frozen score version exists: refused with SCORE_FROZEN.
create or replace function capture.void_response(p_assessment_id text, p_response_id text, p_reason text, p_actor uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare r record; a record;
begin
  select rs.response_id, rs.assessment_id, rs.tenant_id, rs.voided_reason into r from capture.response rs
   where rs.response_id = p_response_id and rs.assessment_id = p_assessment_id for update;
  if not found then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'response'; end if;
  select status, frozen_at into a from public.assessment where assessment_id = r.assessment_id;
  if a.frozen_at is null and a.status <> 'LAUNCHED' then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001'; end if;
  if a.frozen_at is not null and exists (select 1 from public.score_object so where so.assessment_id = r.assessment_id and so.frozen_at is not null) then
    raise exception 'SCORE_FROZEN' using errcode = 'P0001';
  end if;
  if r.voided_reason is not null then raise exception 'ALREADY_DECIDED' using errcode = 'P0001'; end if;
  update capture.response set voided_reason = p_reason where response_id = p_response_id;
  insert into public.exclusion_log (tenant_id, assessment_id, response_id, kind, reason, created_by)
  values (r.tenant_id, r.assessment_id, p_response_id, 'VOID', p_reason, p_actor);
  return r.assessment_id;
end $$;
