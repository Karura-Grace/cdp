-- Block 35: privacy slice. Coach reads of leader outputs follow coach_assignment (spec 0.5 Table 6, 1.4.6); staff list for a tenant (service key
-- only); data subject self service by invitation token (spec 1.4.5): look up the person behind an unsubmitted invitation, erase that invitation.
-- Submitted responses are never touched here: their link to the person was already destroyed at submission.

-- 1. Self service requests have no due date until staff set one (the spec gives no deadline), so due_on may be empty.
alter table public.data_subject_request alter column due_on drop not null;

-- 2. Coach: leader outputs only for assigned leaders and dates
create function app.coach_has_assignment(p_assignment text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leader_assignment la where la.assignment_id = p_assignment and (select app.coach_has_leader(la.person_id)))
$$;
revoke execute on function app.coach_has_assignment(text) from public, anon;
grant execute on function app.coach_has_assignment(text) to authenticated;

create policy leader_result_coach on public.leader_result for select to authenticated using (
  (select app.client_role()) = 'COACH' and tenant_id = (select app.client_tenant_id())
  and (select app.score_released(assessment_id, score_version)) and (select app.coach_has_assignment(assignment_id)));

-- development items: the tenant wide Coach read is replaced by the assigned one
drop policy development_item_read on public.development_item;
create policy development_item_read on public.development_item for select to authenticated using (
  assessment_id in (select a.assessment_id from public.assessment a where a.engagement_id in (select app.pac_engagement_ids())));
create policy development_item_coach on public.development_item for select to authenticated using (
  (select app.client_role()) = 'COACH' and tenant_id = (select app.client_tenant_id())
  and (select app.score_released(assessment_id, score_version)) and (select app.coach_has_assignment(assignment_id)));

-- 3. Staff of one tenant (user id, email, role), for coach assignment checks and retention notices. Service key only.
create function public.rpc_tenant_staff(p_tenant text) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email::text, 'role', m.role::text)), '[]'::jsonb)
  from app.membership m join auth.users u on u.id = m.user_id join app.user_profile p on p.user_id = m.user_id
  where m.tenant_id = p_tenant and p.active
$$;
revoke all on function public.rpc_tenant_staff(text) from public, anon, authenticated;
grant execute on function public.rpc_tenant_staff(text) to service_role;

-- 4. Data subject self service, by invitation token. Both functions answer for a token that is valid and not yet submitted only.
create function public.rpc_rights_context(p_token text) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare inv record;
begin
  select * into inv from capture.invitation where token_hash = extensions.digest(p_token, 'sha256');
  if not found or inv.expires_at <= now() then return jsonb_build_object('state', 'INVALID'); end if;
  if inv.submitted_at is not null then return jsonb_build_object('state', 'SUBMITTED'); end if;
  if inv.person_id is null then return jsonb_build_object('state', 'ANONYMOUS'); end if;     -- anonymous seat: nothing is held about a person
  return jsonb_build_object('state', 'OPEN', 'person_id', inv.person_id, 'tenant_id', inv.tenant_id);
end $$;
create function public.rpc_erase_invitation(p_token text) returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  delete from capture.invitation where token_hash = extensions.digest(p_token, 'sha256') and submitted_at is null and person_id is not null;
  get diagnostics n = row_count;
  return n = 1;
end $$;
revoke all on function public.rpc_rights_context(text), public.rpc_erase_invitation(text) from public, anon, authenticated;
grant execute on function public.rpc_rights_context(text), public.rpc_erase_invitation(text) to service_role;
