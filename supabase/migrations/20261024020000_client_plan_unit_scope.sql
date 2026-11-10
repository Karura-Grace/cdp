-- Client owned plan, unit scope (J4b, Q-AP7). Under rules 2.2 a People Leader moves only the actions of a unit they lead (or under it), so the
-- transition writer re-checks that for a People Leader. Client Admin and Executive are unaffected, and so are plans on rules 2.0 and 2.1.
create or replace function public.rpc_action_transition(p_actor uuid, p_action text, p_from text, p_to text, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  select * into r from public.action where action_id = p_action for update;
  if not found or not app.on_engagement(p_actor, r.assessment_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if exists (select 1 from app.membership m where m.user_id = p_actor and m.role = 'PEOPLE_LEADER')
     and exists (select 1 from public.assessment a join public.rules_version v on v.version_id = a.rules_version_id
                 where a.assessment_id = r.assessment_id and v.semver = '2.2')
     and not app.client_acts_on(p_actor, p_action) then
    raise exception 'FORBIDDEN' using errcode = 'P0001', detail = 'a People Leader acts on the actions of their own unit';
  end if;
  if r.status <> p_from then raise exception 'ILLEGAL_TRANSITION' using errcode = 'P0001', detail = 'the action changed; reload'; end if;
  perform set_config('cdp.action_transition', p_action, true);
  update public.action set status = p_to, updated_by = p_actor where action_id = p_action;
  perform set_config('cdp.action_transition', '', true);
  insert into public.action_event (tenant_id, action_id, from_status, to_status, actor_id, reason) values (r.tenant_id, p_action, p_from, p_to, p_actor, nullif(btrim(p_reason), ''));
  insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (r.tenant_id, p_actor, 'action.' || lower(p_to), 'action', p_action);
end $$;
