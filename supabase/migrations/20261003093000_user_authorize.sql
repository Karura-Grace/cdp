-- 9/9 Check-before-act helpers for user management. A route handler must know the acting user may manage a target BEFORE it
-- changes anything in Supabase Auth (creating an auth user, setting a password). The write functions in migration 8 check
-- again afterwards; these two are the first lock.

create function public.rpc_can_manage(p_actor uuid, p_role text, p_tenant text) returns boolean
language sql stable security definer set search_path = ''
as $$ select app.manage_check(p_actor, p_role, p_tenant) $$;

-- Raises FORBIDDEN or USER_NOT_FOUND unless p_actor may manage p_user. Never allows self-management or Super Admin targets.
create function public.rpc_user_authorize(p_actor uuid, p_user uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare m record;
begin
  if p_actor = p_user then raise exception 'FORBIDDEN' using errcode = 'P0001', detail = 'self'; end if;
  if exists (select 1 from app.platform_admin where user_id = p_user) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if not exists (select 1 from app.user_profile where user_id = p_user) then raise exception 'USER_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into m from app.membership where user_id = p_user;
  if not app.manage_check(p_actor, coalesce(m.role::text, 'PAC_CONSULTANT'), m.tenant_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
end $$;

revoke execute on function public.rpc_can_manage(uuid, text, text), public.rpc_user_authorize(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.rpc_can_manage(uuid, text, text), public.rpc_user_authorize(uuid, uuid) to service_role;
