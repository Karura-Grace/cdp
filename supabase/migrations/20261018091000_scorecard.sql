-- Block 27: strategic scorecard as entities (spec 1.4.3). Objectives link to Section B priorities; KPIs sit under objectives.
-- Read: assigned consultant, Client Admin and Executive of the tenant. Writes are route handlers (service role). Locked once the
-- engagement leaves SETUP, like the setup sections.
create table public.objective (
  objective_id  text primary key default app.new_id('obj'),
  tenant_id     text not null,
  engagement_id text not null,
  title         text not null check (length(btrim(title)) between 1 and 200),
  priority_keys text[] not null default '{}',
  sort_order    int not null default 0,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  foreign key (engagement_id, tenant_id) references public.engagement(engagement_id, tenant_id),
  unique (objective_id, tenant_id)
);
create index objective_eng_idx on public.objective (engagement_id);
create table public.scorecard_kpi (
  kpi_id          text primary key default app.new_id('kpi'),
  tenant_id       text not null,
  engagement_id   text not null,
  objective_id    text not null,
  name            text not null check (length(btrim(name)) between 1 and 200),
  unit            text not null check (unit in ('PERCENT', 'COUNT', 'CURRENCY', 'RATIO', 'DAYS', 'SCORE', 'OTHER')),
  currency_code   text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  direction       text not null check (direction in ('UP', 'DOWN')),
  baseline_value  numeric not null,
  baseline_date   date not null,
  baseline_source text not null check (length(btrim(baseline_source)) between 1 and 200),
  target_12m      numeric not null,
  target_3y       numeric,
  orientation     text check (orientation in ('ENGAGE', 'INNOVATE', 'PERFORM', 'GOVERN')),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  check (unit = 'CURRENCY' or currency_code is null),
  check (unit <> 'CURRENCY' or currency_code is not null),
  foreign key (engagement_id, tenant_id) references public.engagement(engagement_id, tenant_id),
  foreign key (objective_id, tenant_id) references public.objective(objective_id, tenant_id) on delete cascade
);
create index scorecard_kpi_obj_idx on public.scorecard_kpi (objective_id);
create trigger objective_touch before insert or update on public.objective for each row execute function app.touch();
create trigger scorecard_kpi_touch before insert or update on public.scorecard_kpi for each row execute function app.touch();

create function app.scorecard_lock_guard() returns trigger language plpgsql set search_path = '' as $$
declare e text := coalesce(new.engagement_id, old.engagement_id);
begin
  if exists (select 1 from public.engagement g where g.engagement_id = e and g.state <> 'SETUP') then
    raise exception 'SETUP_LOCKED' using errcode = 'P0001', detail = 'the scorecard is locked once the engagement has left SETUP';
  end if;
  return coalesce(new, old);
end $$;
create trigger objective_lock before insert or update or delete on public.objective for each row execute function app.scorecard_lock_guard();
create trigger scorecard_kpi_lock before insert or update or delete on public.scorecard_kpi for each row execute function app.scorecard_lock_guard();

alter table public.objective enable row level security;
alter table public.scorecard_kpi enable row level security;
revoke all on public.objective, public.scorecard_kpi from anon, authenticated;
grant select on public.objective, public.scorecard_kpi to authenticated;
grant all on public.objective, public.scorecard_kpi to service_role;
create policy objective_read on public.objective for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
create policy scorecard_kpi_read on public.scorecard_kpi for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
