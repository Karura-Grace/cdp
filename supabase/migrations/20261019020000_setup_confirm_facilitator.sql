-- Journey 1 decisions 18 Oct 2026 (setup slice).
-- 1. The workshop facilitator is a reference to a PAC user assigned to the engagement. `facilitator` stays as the display name
--    (and holds the old typed text on earlier rows); `facilitator_user_id` is the reference.
-- 2. Executives confirm an agreed section with a recorded tick: one row per Executive per section. Written by route handlers
--    (service role) after the role check; a change to the section clears its ticks.
-- 3. The consultants assigned to an engagement, for the facilitator pick list. Service key only.
alter table public.setup_record add column facilitator_user_id uuid;

create table public.setup_confirmation (
  engagement_id text not null,
  tenant_id     text not null,
  section       text not null check (section ~ '^[A-I]$'),
  user_id       uuid not null,
  confirmed_at  timestamptz not null default now(),
  primary key (engagement_id, section, user_id),
  foreign key (engagement_id, tenant_id) references public.engagement(engagement_id, tenant_id)
);
alter table public.setup_confirmation enable row level security;
revoke all on public.setup_confirmation from anon, authenticated;
grant select on public.setup_confirmation to authenticated;
grant all on public.setup_confirmation to service_role;
create policy setup_confirmation_read on public.setup_confirmation for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE'))
);

create function public.rpc_engagement_consultants(p_engagement text) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', a.user_id, 'full_name', p.full_name, 'email', u.email::text) order by p.full_name), '[]'::jsonb)
  from app.engagement_assignment a join auth.users u on u.id = a.user_id join app.user_profile p on p.user_id = a.user_id
  where a.engagement_id = p_engagement and p.active and now() >= a.valid_from and now() < a.valid_to
$$;
revoke all on function public.rpc_engagement_consultants(text) from public, anon, authenticated;
grant execute on function public.rpc_engagement_consultants(text) to service_role;
