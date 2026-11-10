-- Block 32: coach assignment (spec 1.4.6): a Coach reads leader outputs only for assigned leaders and inside the dates.
create table public.coach_assignment (
  coach_assignment_id text primary key default app.new_id('cch'),
  tenant_id       text not null references public.tenant(tenant_id),
  coach_user_id   uuid not null,
  leader_person_ids text[] not null check (cardinality(leader_person_ids) >= 1),
  from_date       date not null,
  to_date         date not null,
  created_at timestamptz not null default now(), created_by uuid,
  check (to_date >= from_date)
);
create index coach_assignment_user_idx on public.coach_assignment (coach_user_id);
alter table public.coach_assignment enable row level security;
revoke all on public.coach_assignment from anon, authenticated;
grant select on public.coach_assignment to authenticated;
grant all on public.coach_assignment to service_role;
create policy coach_assignment_read on public.coach_assignment for select to authenticated using (
  coach_user_id = (select auth.uid()) or (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
-- helper for later leader policies: is this person assigned to the calling coach today
create function app.coach_has_leader(p_person text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_assignment c where c.coach_user_id = (select auth.uid())
                 and p_person = any (c.leader_person_ids) and current_date between c.from_date and c.to_date)
$$;
