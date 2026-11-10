-- Block 34: a scoring relevant change after launch creates a new assessment version (spec 1.6.2, AC-1.6).
alter table public.assessment drop constraint assessment_status_check;
alter table public.assessment
  add constraint assessment_status_check check (status in ('DRAFT', 'LAUNCHED', 'FROZEN', 'SUPERSEDED')),
  add column supersedes_assessment_id text references public.assessment(assessment_id),
  add column version_reason text check (version_reason is null or length(btrim(version_reason)) between 1 and 500);

-- the setup lock may be lifted only inside rpc_assessment_new_version
create or replace function app.setup_lock_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.locked_at is not null and coalesce(current_setting('app.setup_unlock', true), '') <> 'on' then
    raise exception 'SETUP_LOCKED' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

-- Allowed only while nobody has submitted: the launched assessment is superseded, its sections are unlocked, the engagement's
-- setup_version rises, and a DRAFT clone is returned for relaunch. Service role only; the caller checks the consultant role.
create function public.rpc_assessment_new_version(p_assessment text, p_reason text) returns text
language plpgsql security definer set search_path = '' as $$
declare a public.assessment; nid text;
begin
  select * into a from public.assessment where assessment_id = p_assessment for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if a.status <> 'LAUNCHED' then raise exception 'ASSESSMENT_NOT_LAUNCHED' using errcode = 'P0001'; end if;
  if exists (select 1 from capture.response r where r.assessment_id = p_assessment)
     or exists (select 1 from capture.invitation i where i.assessment_id = p_assessment and i.submitted_at is not null) then
    raise exception 'RESPONSES_EXIST' using errcode = 'P0001', detail = 'a new version cannot replace an assessment that already has responses';
  end if;
  perform set_config('app.setup_unlock', 'on', true);
  update public.setup_record set locked_at = null, status = case when status = 'AGREED' then 'SUBMITTED' else status end where engagement_id = a.engagement_id;
  update public.assessment set status = 'SUPERSEDED' where assessment_id = p_assessment;
  update public.engagement set setup_version = setup_version + 1, setup_snapshot = null where engagement_id = a.engagement_id;
  insert into public.assessment (tenant_id, engagement_id, instrument_version_id, rules_version_id, window_open, window_close, status, supersedes_assessment_id, version_reason)
    values (a.tenant_id, a.engagement_id, a.instrument_version_id, a.rules_version_id, a.window_open, a.window_close, 'DRAFT', p_assessment, p_reason)
    returning assessment_id into nid;
  return nid;
end $$;
revoke all on function public.rpc_assessment_new_version(text, text) from public, anon, authenticated;
grant execute on function public.rpc_assessment_new_version(text, text) to service_role;
