-- Journey 2, slice S4 (owner ruling 19 October 2026: an objection revokes links already issued, not only future ones).
-- capture.revoke_person_links ends every unsubmitted survey, 360 and pulse link of one person in one tenant at once: the link
-- expires (410 with the neutral message), any saved draft is deleted, and the person link and demographic snapshot are cleared,
-- so nothing about the objecting person stays tied to a live token. Submitted answers are already unlinked and are not touched.
-- Called from the one place every objection goes through (lib/privacy.ts openObjectionTask), by employee reference.
create function capture.revoke_person_links(p_tenant_id text, p_employee_ref text) returns int
language plpgsql security definer set search_path = ''
as $$
declare pid text; n int := 0; k int;
begin
  select person_id into pid from public.person_of_record where tenant_id = p_tenant_id and employee_ref = p_employee_ref;
  if pid is null then return 0; end if;
  delete from capture.draft d using capture.invitation i
   where d.invitation_id = i.invitation_id and i.person_id = pid and i.tenant_id = p_tenant_id and i.submitted_at is null;
  update capture.invitation set expires_at = least(expires_at, now()), person_id = null, demographic_snapshot_json = '{}'::jsonb
   where person_id = pid and tenant_id = p_tenant_id and submitted_at is null;
  get diagnostics k = row_count; n := n + k;
  update capture.invitation_360 set expires_at = least(expires_at, now()), person_id = null
   where person_id = pid and tenant_id = p_tenant_id and submitted_at is null;
  get diagnostics k = row_count; n := n + k;
  update capture.pulse_invitation set expires_at = least(expires_at, now()), person_id = null
   where person_id = pid and tenant_id = p_tenant_id and submitted_at is null;
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;
revoke execute on function capture.revoke_person_links(text, text) from public, anon, authenticated;
grant  execute on function capture.revoke_person_links(text, text) to service_role;

create function public.rpc_revoke_person_links(p_tenant_id text, p_employee_ref text) returns int
language sql security invoker set search_path = ''
as $$ select capture.revoke_person_links(p_tenant_id, p_employee_ref) $$;
revoke execute on function public.rpc_revoke_person_links(text, text) from public, anon, authenticated;
grant  execute on function public.rpc_revoke_person_links(text, text) to service_role;
