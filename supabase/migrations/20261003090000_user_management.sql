-- 8/8 User management: profiles, deactivation, one-time passwords, time-boxed consultant assignments.
--
-- Who manages whom (decided with the product owner, 2026-10-03):
--   * SUPER_ADMIN: creates and manages PAC Consultants and any client user, assigns consultants to engagements.
--   * CLIENT_ADMIN: creates and manages EXECUTIVE, PEOPLE_LEADER and COACH users of their own tenant only.
--   * Nobody manages themselves; a Client Admin cannot create or change another Client Admin; Super Admins are not
--     created or changed here.
--
-- What this migration changes in existing behaviour (the sensitive part):
--   * app.mfa_ok() is the single gate every RLS helper goes through. It is redefined to also require the caller's
--     profile to be active, so deactivating a user cuts their database access immediately, even while their JWT
--     is still valid. Users without a profile row (service role, anon) are unaffected. MFA is still stubbed.
--
-- All writes are SECURITY DEFINER functions that only service_role may execute. Each re-checks that the ACTING user is
-- allowed (the route handler also checks; this is the second lock) and writes an audit_log row.

-- ---------------------------------------------------------------- profile

create table app.user_profile (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  full_name            text not null default '',
  active               boolean not null default true,
  must_change_password boolean not null default false,
  temp_pw_hash         text,                 -- hash of the temporary password, to prove it was changed
  created_by           uuid,
  created_at           timestamptz not null default now()
);
alter table app.user_profile enable row level security;

-- a user may read their own row, minus the password hash
revoke all on app.user_profile from anon, authenticated;
grant select (user_id, full_name, active, must_change_password) on app.user_profile to authenticated;
create policy user_profile_read_own on app.user_profile for select to authenticated using (user_id = (select auth.uid()));

-- existing accounts (seeded demo users) become active profiles
insert into app.user_profile (user_id, full_name)
select id, coalesce(nullif(split_part(email, '@', 1), ''), 'User') from auth.users
on conflict do nothing;

-- ---------------------------------------------------------------- the session gate (see header)

create or replace function app.mfa_ok() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select p.active from app.user_profile p where p.user_id = (select auth.uid())), true) $$;
-- ponytail: still no TOTP. Add `and (select auth.jwt()->>'aal') = 'aal2'` here when enrolment exists.

-- ---------------------------------------------------------------- who may manage whom

create function app.manage_check(p_actor uuid, p_target_role text, p_target_tenant text) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare t text;
begin
  if p_actor is null or not exists (select 1 from app.user_profile where user_id = p_actor and active) then return false; end if;
  if exists (select 1 from app.platform_admin where user_id = p_actor) then
    return p_target_role in ('PAC_CONSULTANT', 'CLIENT_ADMIN', 'EXECUTIVE', 'PEOPLE_LEADER', 'COACH');
  end if;
  select m.tenant_id into t from app.membership m where m.user_id = p_actor and m.role = 'CLIENT_ADMIN';
  return t is not null and t = p_target_tenant and p_target_role in ('EXECUTIVE', 'PEOPLE_LEADER', 'COACH');
end $$;

create function app.audit_user(p_tenant text, p_actor uuid, p_action text, p_user uuid) returns void
language sql security definer set search_path = ''
as $$ insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id) values (p_tenant, p_actor, p_action, 'user', p_user::text) $$;

-- ---------------------------------------------------------------- reads

create function public.rpc_users_list(p_actor uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare sa boolean; t text;
begin
  sa := exists (select 1 from app.platform_admin where user_id = p_actor) and exists (select 1 from app.user_profile where user_id = p_actor and active);
  select m.tenant_id into t from app.membership m join app.user_profile p using (user_id)
   where m.user_id = p_actor and m.role = 'CLIENT_ADMIN' and p.active;
  if not sa and t is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.role, x.email) from (
    select p.user_id, u.email::text as email, p.full_name,
           case when pa.user_id is not null then 'SUPER_ADMIN' when m.user_id is not null then m.role::text else 'PAC_CONSULTANT' end as role,
           m.tenant_id, tn.name as tenant_name, p.active, p.must_change_password, p.created_at, u.last_sign_in_at,
           coalesce((select jsonb_agg(jsonb_build_object('assignment_id', a.assignment_id, 'engagement_id', a.engagement_id,
                        'tenant_name', te.name, 'valid_from', a.valid_from, 'valid_to', a.valid_to) order by a.valid_to desc)
                     from app.engagement_assignment a
                     join public.engagement e on e.engagement_id = a.engagement_id
                     join public.tenant te on te.tenant_id = e.tenant_id
                     where a.user_id = p.user_id), '[]'::jsonb) as assignments
    from app.user_profile p
    join auth.users u on u.id = p.user_id
    left join app.platform_admin pa on pa.user_id = p.user_id
    left join app.membership m on m.user_id = p.user_id
    left join public.tenant tn on tn.tenant_id = m.tenant_id
    where sa or m.tenant_id = t
  ) x), '[]'::jsonb);
end $$;

-- the caller's own scope, for route handlers (invoker: it reports on auth.uid() and nobody else)
create function public.rpc_actor_scope() returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'role', case when app.is_super_admin() then 'SUPER_ADMIN'
                 when app.client_role() is not null then app.client_role()::text
                 when app.is_pac_consultant() then 'PAC_CONSULTANT' end,
    'tenant_id', app.client_tenant_id())
$$;

create function public.rpc_my_profile() returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('full_name', p.full_name, 'must_change_password', p.must_change_password, 'active', p.active)
  from app.user_profile p where p.user_id = (select auth.uid())
$$;

-- ---------------------------------------------------------------- writes (service_role only)

-- Called after the auth user (with a temporary password) has been created.
create function public.rpc_user_create(p_actor uuid, p_user uuid, p_name text, p_role text, p_tenant text,
                                       p_engagement text default null, p_valid_to timestamptz default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare tenant_for_check text := case when p_role = 'PAC_CONSULTANT' then null else p_tenant end;
begin
  if not app.manage_check(p_actor, p_role, tenant_for_check) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_role <> 'PAC_CONSULTANT' and not exists (select 1 from public.tenant where tenant_id = p_tenant) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown tenant';
  end if;
  if btrim(coalesce(p_name, '')) = '' or length(p_name) > 120 then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'name'; end if;

  insert into app.user_profile (user_id, full_name, must_change_password, temp_pw_hash, created_by)
  values (p_user, btrim(p_name), true, (select encrypted_password from auth.users where id = p_user), p_actor);

  if p_role = 'PAC_CONSULTANT' then
    if p_engagement is not null then
      if p_valid_to is null or p_valid_to <= now() or p_valid_to > now() + interval '366 days' then
        raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'valid_to must be within the next year';
      end if;
      insert into app.engagement_assignment (user_id, engagement_id, valid_to) values (p_user, p_engagement, p_valid_to);
    end if;
  else
    insert into app.membership (user_id, tenant_id, role) values (p_user, p_tenant, p_role::public.staff_role);
  end if;
  perform app.audit_user(tenant_for_check, p_actor, 'user.created:' || p_role, p_user);
end $$;

create function public.rpc_user_update(p_actor uuid, p_user uuid, p_role text default null, p_active boolean default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare m record; cur text;
begin
  if p_actor = p_user then raise exception 'FORBIDDEN' using errcode = 'P0001', detail = 'you cannot change your own account'; end if;
  if exists (select 1 from app.platform_admin where user_id = p_user) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if not exists (select 1 from app.user_profile where user_id = p_user) then raise exception 'USER_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into m from app.membership where user_id = p_user;
  cur := coalesce(m.role::text, 'PAC_CONSULTANT');
  if not app.manage_check(p_actor, cur, m.tenant_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;

  if p_role is not null and p_role <> cur then
    if m.user_id is null or not app.manage_check(p_actor, p_role, m.tenant_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
    update app.membership set role = p_role::public.staff_role where user_id = p_user;
    perform app.audit_user(m.tenant_id, p_actor, 'user.role_changed:' || cur || '>' || p_role, p_user);
  end if;
  if p_active is not null then
    update app.user_profile set active = p_active where user_id = p_user and active is distinct from p_active;
    if found then perform app.audit_user(m.tenant_id, p_actor, case when p_active then 'user.reactivated' else 'user.deactivated' end, p_user); end if;
  end if;
end $$;

-- Called after the new temporary password has been set on the auth user.
create function public.rpc_user_mark_temp(p_actor uuid, p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare m record; cur text;
begin
  if p_actor = p_user then raise exception 'FORBIDDEN' using errcode = 'P0001', detail = 'use the change-password page for your own account'; end if;
  if exists (select 1 from app.platform_admin where user_id = p_user) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into m from app.membership where user_id = p_user;
  cur := coalesce(m.role::text, 'PAC_CONSULTANT');
  if not exists (select 1 from app.user_profile where user_id = p_user) then raise exception 'USER_NOT_FOUND' using errcode = 'P0001'; end if;
  if not app.manage_check(p_actor, cur, m.tenant_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  update app.user_profile set must_change_password = true, temp_pw_hash = (select encrypted_password from auth.users where id = p_user) where user_id = p_user;
  perform app.audit_user(m.tenant_id, p_actor, 'user.password_reset', p_user);
end $$;

-- Clears the must-change flag only if the password was really replaced (its hash differs from the temporary one).
create function public.rpc_password_changed(p_user uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare p record;
begin
  select * into p from app.user_profile where user_id = p_user;
  if not found or not p.must_change_password then return; end if;
  if (select encrypted_password from auth.users where id = p_user) is not distinct from p.temp_pw_hash then
    raise exception 'PASSWORD_UNCHANGED' using errcode = 'P0001';
  end if;
  update app.user_profile set must_change_password = false, temp_pw_hash = null where user_id = p_user;
  perform app.audit_user(null, p_user, 'user.password_changed', p_user);
end $$;

create function public.rpc_assignment_add(p_actor uuid, p_user uuid, p_engagement text, p_valid_to timestamptz) returns text
language plpgsql security definer set search_path = ''
as $$
declare aid text; tid text;
begin
  if not app.manage_check(p_actor, 'PAC_CONSULTANT', null) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if exists (select 1 from app.membership where user_id = p_user) or exists (select 1 from app.platform_admin where user_id = p_user)
     or not exists (select 1 from app.user_profile where user_id = p_user) then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'only PAC Consultants can be assigned to an engagement';
  end if;
  select tenant_id into tid from public.engagement where engagement_id = p_engagement;
  if tid is null then raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'unknown engagement'; end if;
  if p_valid_to is null or p_valid_to <= now() or p_valid_to > now() + interval '366 days' then
    raise exception 'VALIDATION_FAILED' using errcode = 'P0001', detail = 'valid_to must be within the next year';
  end if;
  insert into app.engagement_assignment (user_id, engagement_id, valid_to) values (p_user, p_engagement, p_valid_to) returning assignment_id into aid;
  perform app.audit_user(tid, p_actor, 'assignment.created:' || p_engagement, p_user);
  return aid;
end $$;

create function public.rpc_assignment_revoke(p_actor uuid, p_assignment text) returns void
language plpgsql security definer set search_path = ''
as $$
declare a record; tid text;
begin
  if not app.manage_check(p_actor, 'PAC_CONSULTANT', null) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into a from app.engagement_assignment where assignment_id = p_assignment;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0001'; end if;
  select tenant_id into tid from public.engagement where engagement_id = a.engagement_id;
  update app.engagement_assignment set valid_to = greatest(a.valid_from + interval '1 second', least(a.valid_to, now())) where assignment_id = p_assignment;
  perform app.audit_user(tid, p_actor, 'assignment.revoked:' || a.engagement_id, a.user_id);
end $$;

-- ---------------------------------------------------------------- privileges

revoke execute on all functions in schema app from public, anon;
grant  execute on all functions in schema app to authenticated, service_role;
revoke execute on function app.manage_check(uuid, text, text), app.audit_user(text, uuid, text, uuid) from authenticated;

revoke execute on function public.rpc_users_list(uuid), public.rpc_user_create(uuid, uuid, text, text, text, text, timestamptz),
  public.rpc_user_update(uuid, uuid, text, boolean), public.rpc_user_mark_temp(uuid, uuid), public.rpc_password_changed(uuid),
  public.rpc_assignment_add(uuid, uuid, text, timestamptz), public.rpc_assignment_revoke(uuid, text)
  from public, anon, authenticated;
grant execute on function public.rpc_users_list(uuid), public.rpc_user_create(uuid, uuid, text, text, text, text, timestamptz),
  public.rpc_user_update(uuid, uuid, text, boolean), public.rpc_user_mark_temp(uuid, uuid), public.rpc_password_changed(uuid),
  public.rpc_assignment_add(uuid, uuid, text, timestamptz), public.rpc_assignment_revoke(uuid, text)
  to service_role;

revoke execute on function public.rpc_actor_scope(), public.rpc_my_profile() from public, anon;
grant  execute on function public.rpc_actor_scope(), public.rpc_my_profile() to authenticated, service_role;
