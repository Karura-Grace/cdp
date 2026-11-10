-- Applied 2026-10-02 to project swnvjucteqguqdbsdmsl.
-- 1/6 Foundation: schemas, id helper, tenancy, roles, audit log, JWT claims hook.
-- Spec: Appendix A (tenant, engagement, audit_log), Table 6/7 (roles), §0.6 (states).
-- CLAUDE.md §4 (identity), §5 (data model).
--
-- Design notes
--   * `app` and `capture` are NOT in the Data API's exposed schemas. Helpers and
--     response tables are unreachable over REST; only the thin `public.rpc_*`
--     wrappers (migration 3) are, and only for service_role.
--   * RLS reads the membership tables, not JWT claims. Claims go stale until a
--     token refresh; the hook below fills them for the UI only.
--   * MFA is stubbed for the demo: app.mfa_ok() returns true. Flip it once
--     TOTP enrolment exists. Every policy goes through it.

create schema if not exists app;
create schema if not exists capture;

revoke all on schema app from public;
grant usage on schema app to authenticated, service_role, supabase_auth_admin;
revoke all on schema capture from public, anon, authenticated;

-- ---------------------------------------------------------------- ids and stamps

-- Prefixed opaque ids (ten_, eng_, asm_ ...). 64 bits of randomness, never sequential.
create function app.new_id(prefix text) returns text
language sql volatile set search_path = ''
as $$ select prefix || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16) $$;

-- created_by / updated_by come from the JWT; null when the service role writes.
create function app.touch() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := (select auth.uid());
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
  end if;
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end $$;

-- ---------------------------------------------------------------- enums

create type public.staff_role as enum
  ('SUPER_ADMIN', 'PAC_CONSULTANT', 'CLIENT_ADMIN', 'EXECUTIVE', 'PEOPLE_LEADER', 'COACH');

create type public.engagement_state as enum
  ('SETUP', 'FIELDING', 'SCORING', 'REPORTING', 'DEBRIEF', 'PLANNING',
   'IMPLEMENTATION', 'PULSE', 'RE_ASSESSMENT', 'CLOSED');

-- ---------------------------------------------------------------- tenant, engagement

create table public.tenant (
  tenant_id        text primary key default app.new_id('ten'),
  name             text not null,
  legal_name       text,
  sector           text,
  headcount        int check (headcount > 0),
  geographies      text[] not null default '{}',
  residency_region text not null default 'eu-west-1',
  privacy_regime   text not null,
  timezone         text not null default 'Africa/Nairobi',
  branding_pack_id text,
  dpia_recorded_at timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create trigger tenant_touch before insert or update on public.tenant
  for each row execute function app.touch();

create table public.engagement (
  engagement_id          text primary key default app.new_id('eng'),
  tenant_id              text not null references public.tenant(tenant_id),
  cycle_no               int  not null check (cycle_no > 0),
  state                  public.engagement_state not null default 'SETUP',
  previous_engagement_id text references public.engagement(engagement_id),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (tenant_id, cycle_no),
  unique (engagement_id, tenant_id)          -- target of composite FKs: child rows cannot cross tenants
);
create index engagement_tenant_idx on public.engagement (tenant_id);
create trigger engagement_touch before insert or update on public.engagement
  for each row execute function app.touch();

-- residency_region and privacy_regime are immutable once any engagement has left SETUP
-- ("after first launch", Appendix A). ponytail: engagement.state is the launch proxy.
create function app.tenant_residency_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (new.residency_region, new.privacy_regime) is distinct from (old.residency_region, old.privacy_regime)
     and exists (select 1 from public.engagement e where e.tenant_id = old.tenant_id and e.state <> 'SETUP') then
    raise exception 'RESIDENCY_LOCKED' using errcode = 'P0001',
      detail = 'residency_region and privacy_regime are immutable after first launch';
  end if;
  return new;
end $$;
create trigger tenant_residency_guard before update on public.tenant
  for each row execute function app.tenant_residency_guard();

-- ---------------------------------------------------------------- who is who

-- Super Admin: PAC platform operations. Not tenant-bound, no engagement data.
create table app.platform_admin (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Client-side staff. One tenant and one role per user.
create table app.membership (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  tenant_id      text not null references public.tenant(tenant_id),
  role           public.staff_role not null
                   check (role in ('CLIENT_ADMIN', 'EXECUTIVE', 'PEOPLE_LEADER', 'COACH')),
  is_people_lead boolean not null default false,
  person_id      text,                      -- person_of_record is out of the demo slice, so no FK yet
  created_at timestamptz not null default now()
);
create index membership_tenant_idx on app.membership (tenant_id);

-- PAC Consultants are granted per engagement and time-boxed (CLAUDE.md §4).
create table app.engagement_assignment (
  assignment_id text primary key default app.new_id('asg'),
  user_id       uuid not null references auth.users(id) on delete cascade,
  engagement_id text not null references public.engagement(engagement_id),
  role          public.staff_role not null default 'PAC_CONSULTANT' check (role = 'PAC_CONSULTANT'),
  valid_from    timestamptz not null default now(),
  valid_to      timestamptz not null,
  created_at timestamptz not null default now(),
  check (valid_to > valid_from)
);
create index engagement_assignment_user_idx on app.engagement_assignment (user_id, engagement_id, valid_to);
create index engagement_assignment_eng_idx  on app.engagement_assignment (engagement_id);

alter table app.platform_admin        enable row level security;
alter table app.membership            enable row level security;
alter table app.engagement_assignment enable row level security;

-- ---------------------------------------------------------------- helpers used by every policy
-- SECURITY DEFINER so they can read the tables above without tripping their own RLS.
-- Schema `app` is not exposed, so none of these is an API endpoint.

create function app.mfa_ok() returns boolean
language sql stable set search_path = ''
as $$ select true $$;   -- ponytail: MFA stubbed for the demo. Replace with (select auth.jwt()->>'aal') = 'aal2'.

create function app.is_super_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select app.mfa_ok() and exists (select 1 from app.platform_admin where user_id = (select auth.uid())) $$;

create function app.client_role() returns public.staff_role
language sql stable security definer set search_path = ''
as $$ select m.role from app.membership m where m.user_id = (select auth.uid()) and app.mfa_ok() $$;

create function app.client_tenant_id() returns text
language sql stable security definer set search_path = ''
as $$ select m.tenant_id from app.membership m where m.user_id = (select auth.uid()) and app.mfa_ok() $$;

create function app.is_people_lead() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select m.is_people_lead from app.membership m
                       where m.user_id = (select auth.uid()) and app.mfa_ok()), false) $$;

create function app.pac_engagement_ids() returns setof text
language sql stable security definer set search_path = ''
as $$
  select a.engagement_id from app.engagement_assignment a
  where a.user_id = (select auth.uid()) and app.mfa_ok() and now() >= a.valid_from and now() < a.valid_to
$$;

create function app.pac_tenant_ids() returns setof text
language sql stable security definer set search_path = ''
as $$ select e.tenant_id from public.engagement e where e.engagement_id in (select app.pac_engagement_ids()) $$;

create function app.is_pac_consultant() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from app.pac_engagement_ids()) $$;

-- Is this user an active PAC Consultant on this engagement? Used by the report-release trigger.
create function app.is_active_assignee(p_user uuid, p_engagement text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from app.engagement_assignment a
                 where a.user_id = p_user and a.engagement_id = p_engagement
                   and now() >= a.valid_from and now() < a.valid_to)
$$;

revoke execute on all functions in schema app from public, anon;
grant  execute on all functions in schema app to authenticated, service_role;

-- ---------------------------------------------------------------- audit log (insert-only)

create table public.audit_log (
  log_id       text primary key default app.new_id('aud'),
  tenant_id    text references public.tenant(tenant_id),
  actor_id     uuid,
  action       text not null,
  object_type  text not null,
  object_id    text not null,
  payload_hash text,
  at           timestamptz not null default now()
);
create index audit_log_tenant_idx on public.audit_log (tenant_id, at desc);

create function app.deny_mutation() returns trigger
language plpgsql set search_path = ''
as $$ begin raise exception 'APPEND_ONLY' using errcode = 'P0001', detail = tg_table_name; end $$;

create trigger audit_log_append_only before update or delete on public.audit_log
  for each row execute function app.deny_mutation();
create trigger audit_log_no_truncate before truncate on public.audit_log
  for each statement execute function app.deny_mutation();

-- Engagement state changes are audited by the database, whoever makes them (Appendix K: engagement.state_changed).
create function app.audit_engagement_state() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.state is distinct from old.state then
    insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id)
    values (new.tenant_id, (select auth.uid()), 'engagement.state_changed:' || old.state || '>' || new.state,
            'engagement', new.engagement_id);
  end if;
  return new;
end $$;
create trigger engagement_audit_state after update on public.engagement
  for each row execute function app.audit_engagement_state();

-- ---------------------------------------------------------------- JWT claims hook (UX only; RLS does not trust it)
-- Enable under Auth > Hooks > Custom Access Token (or [auth.hook.custom_access_token] in config.toml).

create function app.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  uid    uuid  := (event ->> 'user_id')::uuid;
  m      record;
begin
  if exists (select 1 from app.platform_admin where user_id = uid) then
    claims := claims || jsonb_build_object('app_role', 'SUPER_ADMIN');
  else
    select * into m from app.membership where user_id = uid;
    if found then
      claims := claims || jsonb_build_object('app_role', m.role, 'tenant_id', m.tenant_id,
                                             'is_people_lead', m.is_people_lead, 'person_id', m.person_id);
    elsif exists (select 1 from app.engagement_assignment a
                  where a.user_id = uid and now() >= a.valid_from and now() < a.valid_to) then
      claims := claims || jsonb_build_object('app_role', 'PAC_CONSULTANT');
    end if;
  end if;
  return jsonb_set(event, '{claims}', claims);
end $$;

revoke execute on function app.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant  execute on function app.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on app.platform_admin, app.membership, app.engagement_assignment to supabase_auth_admin;

create policy auth_admin_reads_platform_admin on app.platform_admin
  for select to supabase_auth_admin using (true);
create policy auth_admin_reads_membership on app.membership
  for select to supabase_auth_admin using (true);
create policy auth_admin_reads_assignment on app.engagement_assignment
  for select to supabase_auth_admin using (true);

-- ---------------------------------------------------------------- table privileges
-- Explicit, not inherited from default privileges. Staff read through RLS; every write
-- goes through a Next.js route handler (service_role) after the engine has validated it.

alter table public.tenant     enable row level security;
alter table public.engagement enable row level security;
alter table public.audit_log  enable row level security;

revoke all on public.tenant, public.engagement, public.audit_log from anon, authenticated;
grant select on public.tenant, public.engagement, public.audit_log to authenticated;
grant all    on public.tenant, public.engagement to service_role;
grant select, insert on public.audit_log to service_role;
-- own membership row, so the UI can show who the user is
grant select on app.membership to authenticated;
grant select on app.platform_admin, app.engagement_assignment to authenticated;
