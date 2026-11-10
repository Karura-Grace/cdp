-- Owner ruling of 22 October 2026 (Erick Ngala comments 22 and 72, logged in context-sessions/DECISIONS-LOG.md): the survey window can be extended
-- as often as needed and by any length, by the PAC consultant or the Super Admin, with a reason ("what if there is a lockdown?"). The platform
-- does not control this part. Every extension is still recorded (insert only), moves the close date of open links, and appears in the technical
-- appendix. Replaces the limits of 20261020030000: at most two extensions, 1 to 5 working days each, the second approved by the engagement lead.
alter table public.window_extension drop constraint window_extension_seq_check;
alter table public.window_extension drop constraint window_extension_working_days_check;
alter table public.window_extension drop constraint window_extension_check;
alter table public.window_extension add constraint window_extension_seq_check check (seq >= 1);
alter table public.window_extension add constraint window_extension_working_days_check check (working_days between 1 and 365);   -- a sanity bound, not a policy

create or replace function capture.extend_window(p_assessment_id text, p_new_close timestamptz, p_working_days int, p_reason text,
                                      p_requested_by uuid, p_approved_by uuid) returns int
language plpgsql security definer set search_path = ''
as $$
declare a record; n int;
begin
  select * into a from public.assessment where assessment_id = p_assessment_id for update;
  if a.status <> 'LAUNCHED' or a.frozen_at is not null then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001'; end if;
  select count(*) into n from public.window_extension where assessment_id = p_assessment_id;
  insert into public.window_extension (assessment_id, seq, tenant_id, old_close, new_close, working_days, reason, requested_by, approved_by)
  values (p_assessment_id, n + 1, a.tenant_id, a.window_close, p_new_close, p_working_days, p_reason, p_requested_by, p_approved_by);
  perform set_config('app.window_extension', 'on', true);
  update public.assessment set window_close = p_new_close where assessment_id = p_assessment_id;
  perform set_config('app.window_extension', 'off', true);
  update capture.invitation set expires_at = p_new_close
   where assessment_id = p_assessment_id and submitted_at is null and expires_at = a.window_close;
  return n + 1;
end $$;
