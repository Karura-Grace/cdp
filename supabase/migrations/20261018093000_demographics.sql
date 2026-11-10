-- Block 29: closed list demographic attributes with an analytical purpose (spec 1.4.1, 1.4.5, AC-1.7). No free text values.
create table public.demographic_attribute (
  attr_id            text primary key default app.new_id('dem'),
  tenant_id          text not null references public.tenant(tenant_id),
  name               text not null check (length(btrim(name)) between 1 and 60),
  values_list        text[] not null check (cardinality(values_list) between 2 and 30),
  is_sensitive       boolean not null default false,
  analytical_purpose text not null check (length(btrim(analytical_purpose)) between 10 and 500),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (tenant_id, name),
  unique (attr_id, tenant_id)
);
create table public.person_demographic (
  person_id text not null,
  attr_id   text not null,
  tenant_id text not null,
  value     text not null,
  primary key (person_id, attr_id),
  foreign key (person_id, tenant_id) references public.person_of_record(person_id, tenant_id) on delete cascade,
  foreign key (attr_id, tenant_id) references public.demographic_attribute(attr_id, tenant_id) on delete cascade
);
create function app.demographic_value_guard() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.demographic_attribute a where a.attr_id = new.attr_id and new.value = any (a.values_list)) then
    raise exception 'DEMOGRAPHIC_VALUE_NOT_IN_LIST' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger person_demographic_guard before insert or update on public.person_demographic for each row execute function app.demographic_value_guard();
create trigger demographic_attribute_touch before insert or update on public.demographic_attribute for each row execute function app.touch();
alter table public.demographic_attribute enable row level security;
alter table public.person_demographic enable row level security;
revoke all on public.demographic_attribute, public.person_demographic from anon, authenticated;
grant select on public.demographic_attribute to authenticated;
grant all on public.demographic_attribute, public.person_demographic to service_role;
create policy demographic_attribute_read on public.demographic_attribute for select to authenticated using (
  (select app.is_super_admin()) or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')));
