-- Block 28: tenant public holidays (working day counts) and the performance review period (spec 1.4.4 I4, 1.4.1).
alter table public.tenant
  add column review_period_start date,
  add column review_period_end   date,
  add check (review_period_end is null or review_period_start is null or review_period_end >= review_period_start);
create table public.tenant_holiday (
  tenant_id text not null references public.tenant(tenant_id),
  day       date not null,
  label     text not null check (length(btrim(label)) between 1 and 120),
  created_at timestamptz not null default now(), created_by uuid,
  primary key (tenant_id, day)
);
alter table public.tenant_holiday enable row level security;
revoke all on public.tenant_holiday from anon, authenticated;
grant select on public.tenant_holiday to authenticated;
grant all on public.tenant_holiday to service_role;
create policy tenant_holiday_read on public.tenant_holiday for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'));
