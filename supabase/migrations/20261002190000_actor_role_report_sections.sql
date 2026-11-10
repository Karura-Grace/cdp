-- 7/7 Two additive pieces the score and release endpoints need. No policy is loosened.
--
-- 1. public.rpc_actor_role: the caller's role on one engagement, for route handlers. The `app`
--    schema is not exposed over REST, so a handler cannot read memberships or assignments itself.
--    SECURITY INVOKER, so it only ever reports on the caller (auth.uid()), and the engagement
--    lookup is subject to RLS.
-- 2. report.sections_json / accepted_json: consultant-written sections and the keys the consultant
--    accepted, which the engine's checkRelease reads (§4.6). Editable while DRAFT only; the release
--    guard already freezes a RELEASED row.

alter table public.report
  add column sections_json jsonb not null default '{}'::jsonb,
  add column accepted_json jsonb not null default '{}'::jsonb;

create function public.rpc_actor_role(p_engagement text) returns text
language sql stable security invoker set search_path = ''
as $$
  select case
    when p_engagement in (select app.pac_engagement_ids()) then 'PAC_CONSULTANT'
    when (select app.is_super_admin()) then 'SUPER_ADMIN'
    when (select app.client_tenant_id()) = (select e.tenant_id from public.engagement e where e.engagement_id = p_engagement)
      then (select app.client_role())::text
  end
$$;
revoke execute on function public.rpc_actor_role(text) from public, anon;
grant  execute on function public.rpc_actor_role(text) to authenticated, service_role;
