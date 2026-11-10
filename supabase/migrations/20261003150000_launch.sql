-- 11 Launch (spec §1.6.2, AC-1.5, AC-1.6).
--   * tenant.transfer_basis_ref / transfer_basis_recorded_at: the recorded transfer basis that pre-flight L6 needs for
--     out-of-region processing (spec D-04). Nothing writes it yet except the demo seed; who signs it is an open item.
--   * rpc_launch_assessment: the atomic launch. Locks the setup sections, moves the assessment DRAFT -> LAUNCHED and the
--     engagement SETUP -> FIELDING in one transaction, and audits it. service_role only; it re-checks that the actor is an
--     active PAC Consultant assigned to the engagement (the route checks too; this is the second lock). Pre-flight L1-L8
--     runs in the route, through the engine; the database itself enforces the consent-text rule (migration 10).

alter table public.tenant
  add column transfer_basis_ref         text,
  add column transfer_basis_recorded_at timestamptz;

create function public.rpc_launch_assessment(p_actor uuid, p_assessment text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a record; eng record; locked int;
begin
  select * into a from public.assessment where assessment_id = p_assessment for update;
  if not found
     or not coalesce((select p.active from app.user_profile p where p.user_id = p_actor), true)
     or not exists (select 1 from app.engagement_assignment g
                    where g.user_id = p_actor and g.engagement_id = a.engagement_id
                      and now() >= g.valid_from and now() < g.valid_to) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  select * into eng from public.engagement where engagement_id = a.engagement_id for update;
  if a.status <> 'DRAFT' or eng.state <> 'SETUP' then
    raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001';
  end if;

  update public.setup_record set locked_at = now() where engagement_id = a.engagement_id and locked_at is null;
  get diagnostics locked = row_count;
  update public.assessment set status = 'LAUNCHED' where assessment_id = a.assessment_id;      -- guard: approved consent text
  update public.engagement set state = 'FIELDING' where engagement_id = a.engagement_id;

  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id)
  values (a.tenant_id, p_actor, 'assessment.launched', 'assessment', a.assessment_id);
  return jsonb_build_object('assessment_id', a.assessment_id, 'status', 'LAUNCHED', 'sections_locked', locked);
end $$;

revoke execute on function public.rpc_launch_assessment(uuid, text) from public, anon, authenticated;
grant  execute on function public.rpc_launch_assessment(uuid, text) to service_role;
