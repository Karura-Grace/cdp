-- Workshop 1 workbook (owner rulings Q-WS1 and Q-WS2, design docs/designs/J7-workshop-1-workbook.md). Every upload of the filled Excel workbook is a NEW version and is
-- never changed or removed; marking a version final is a separate insert only row (the latest mark wins). Only the final version is written to Setup (the agreed
-- perspective, as a draft), through the existing section save path, so the engine still reads only what Setup has agreed. Read: the assigned PAC Consultant only.
create table public.setup_workbook_version (
  version_id    text primary key default app.new_id('swb'),
  tenant_id     text not null references public.tenant(tenant_id),
  engagement_id text not null references public.engagement(engagement_id),
  version_no    int  not null check (version_no >= 1),
  file_name     text not null check (length(file_name) between 1 and 200),
  file_hash     text not null check (file_hash ~ '^[0-9a-f]{64}$'),
  sections_json jsonb not null,                       -- { "A": { payload, errors }, ... } as parsed
  clean         boolean not null,                      -- no section has an error
  uploaded_by   uuid,
  uploaded_at   timestamptz not null default now(),
  unique (engagement_id, version_no)
);
create table public.setup_workbook_final (
  mark_id       text primary key default app.new_id('swf'),
  tenant_id     text not null references public.tenant(tenant_id),
  engagement_id text not null references public.engagement(engagement_id),
  version_id    text not null references public.setup_workbook_version(version_id),
  marked_by     uuid,
  marked_at     timestamptz not null default now()
);
create index setup_workbook_final_idx on public.setup_workbook_final (engagement_id, marked_at desc);
create trigger setup_workbook_version_append_only before update or delete on public.setup_workbook_version for each row execute function app.deny_mutation();
create trigger setup_workbook_final_append_only before update or delete on public.setup_workbook_final for each row execute function app.deny_mutation();
alter table public.setup_workbook_version enable row level security;
alter table public.setup_workbook_final enable row level security;
revoke all on public.setup_workbook_version, public.setup_workbook_final from public, anon, authenticated, service_role;
grant select on public.setup_workbook_version, public.setup_workbook_final to authenticated, service_role;
grant insert on public.setup_workbook_version, public.setup_workbook_final to service_role;
create policy setup_workbook_version_read on public.setup_workbook_version for select to authenticated
  using (engagement_id in (select app.pac_engagement_ids()));
create policy setup_workbook_final_read on public.setup_workbook_final for select to authenticated
  using (engagement_id in (select app.pac_engagement_ids()));
