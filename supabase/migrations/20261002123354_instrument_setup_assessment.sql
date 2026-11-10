-- Applied 2026-10-02 to project swnvjucteqguqdbsdmsl.
-- 2/6 Instrument + rules versions, item bank tables, setup records, assessment.
-- Spec: Appendix A rows instrument_version/rules_version, item/scenario/scenario_statement,
-- setup_record, assessment. CLAUDE.md §5.
--
-- Out of the demo slice (add when needed): item_locale_variant, org_unit/location/grade_band,
-- person_of_record, leader_assignment, strategic_requirement/objective/kpi, consent_record.

-- ---------------------------------------------------------------- versions (immutable once published)

create table public.instrument_version (
  version_id       text primary key default app.new_id('ins'),
  semver           text not null unique,
  status           text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  published_at     timestamptz,
  equivalence_note text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create table public.rules_version (
  version_id       text primary key default app.new_id('rul'),
  semver           text not null unique,
  status           text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  published_at     timestamptz,
  equivalence_note text,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);

create trigger instrument_version_touch before insert or update on public.instrument_version
  for each row execute function app.touch();
create trigger rules_version_touch before insert or update on public.rules_version
  for each row execute function app.touch();

-- Published rows may only move to RETIRED; nothing else changes and nothing is deleted.
create function app.version_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' then raise exception 'VERSION_IMMUTABLE' using errcode = 'P0001'; end if;
    return old;
  end if;
  if old.status <> 'DRAFT' and not (old.status = 'PUBLISHED' and new.status = 'RETIRED'
       and (new.semver, new.published_at, new.equivalence_note) is not distinct from
           (old.semver, old.published_at, old.equivalence_note)) then
    raise exception 'VERSION_IMMUTABLE' using errcode = 'P0001';
  end if;
  if new.status = 'PUBLISHED' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger instrument_version_guard before update or delete on public.instrument_version
  for each row execute function app.version_guard();
create trigger rules_version_guard before update or delete on public.rules_version
  for each row execute function app.version_guard();

-- ---------------------------------------------------------------- item bank (Appendix C)

create table public.scenario (
  version_id       text not null references public.instrument_version(version_id),
  scenario_id      text not null,                       -- 'D1-S1'
  dimension        text not null check (dimension ~ '^D[1-6]$'),
  sequence         int  not null check (sequence between 1 and 3),
  title            text not null,
  prompt_now       text not null,
  prompt_preferred text not null,
  primary key (version_id, scenario_id)
);

create table public.scenario_statement (
  version_id  text not null,
  scenario_id text not null,
  orientation text not null check (orientation in ('ENGAGE', 'INNOVATE', 'PERFORM', 'GOVERN')),
  text        text not null,
  primary key (version_id, scenario_id, orientation),
  foreign key (version_id, scenario_id) references public.scenario(version_id, scenario_id)
);

create table public.item (
  version_id     text not null references public.instrument_version(version_id),
  item_id        text not null,                          -- 'D7-01', 'EOS-1', 'Q1'
  block          text not null check (block in ('LIKERT', 'EOS', 'QUAL')),
  dimension      text check (dimension in ('D7', 'D8', 'D9')),
  sequence       int  not null,
  scale_type     text not null,
  title          text,
  canonical_text text not null,
  primary key (version_id, item_id),
  unique (version_id, block, dimension, sequence)
);

-- Items of a published instrument version are frozen with it.
create function app.item_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare v text := coalesce(new.version_id, old.version_id);
begin
  if exists (select 1 from public.instrument_version where version_id = v and status <> 'DRAFT') then
    raise exception 'VERSION_IMMUTABLE' using errcode = 'P0001', detail = 'items of a published instrument are immutable';
  end if;
  return coalesce(new, old);
end $$;
create trigger scenario_guard before insert or update or delete on public.scenario
  for each row execute function app.item_guard();
create trigger scenario_statement_guard before insert or update or delete on public.scenario_statement
  for each row execute function app.item_guard();
create trigger item_guard before insert or update or delete on public.item
  for each row execute function app.item_guard();

-- ---------------------------------------------------------------- setup_record (Sections A-I)

create table public.setup_record (
  setup_id      text primary key default app.new_id('set'),
  tenant_id     text not null,
  engagement_id text not null,
  section       text not null check (section ~ '^[A-I]$'),
  perspective   text not null check (perspective in ('EXECUTIVE', 'HR', 'AGREED')),
  payload_json  jsonb not null default '{}'::jsonb,
  status        text not null default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'AGREED')),
  workshop_date date,
  participants  text[] not null default '{}',
  locked_at     timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  unique (engagement_id, section, perspective),
  foreign key (engagement_id, tenant_id) references public.engagement(engagement_id, tenant_id)
);
create index setup_record_tenant_idx on public.setup_record (tenant_id);
create trigger setup_record_touch before insert or update on public.setup_record
  for each row execute function app.touch();

-- Launch sets locked_at; locked sections refuse edits (SETUP_LOCKED, AC-1.6).
create function app.setup_lock_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.locked_at is not null then
    raise exception 'SETUP_LOCKED' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger setup_record_lock before update or delete on public.setup_record
  for each row execute function app.setup_lock_guard();

-- ---------------------------------------------------------------- assessment

create table public.assessment (
  assessment_id         text primary key default app.new_id('asm'),
  tenant_id             text not null,
  engagement_id         text not null,
  instrument_version_id text not null references public.instrument_version(version_id),
  rules_version_id      text not null references public.rules_version(version_id),
  window_open           timestamptz,
  window_close          timestamptz,
  frozen_at             timestamptz,
  response_set_hash     text,
  status                text not null default 'DRAFT' check (status in ('DRAFT', 'LAUNCHED', 'FROZEN')),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  check (window_close is null or window_open is null or window_close > window_open),
  foreign key (engagement_id, tenant_id) references public.engagement(engagement_id, tenant_id),
  unique (assessment_id, tenant_id)         -- target of composite FKs from capture/score tables
);
create index assessment_engagement_idx on public.assessment (engagement_id);
create index assessment_tenant_idx on public.assessment (tenant_id);
create trigger assessment_touch before insert or update on public.assessment
  for each row execute function app.touch();

-- After launch the pinned versions and the window do not change; a freeze cannot be undone.
create function app.assessment_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if old.status <> 'DRAFT' and (new.instrument_version_id, new.rules_version_id, new.window_open, new.window_close)
       is distinct from (old.instrument_version_id, old.rules_version_id, old.window_open, old.window_close) then
    raise exception 'ASSESSMENT_PINNED' using errcode = 'P0001';
  end if;
  if old.frozen_at is not null and new.frozen_at is distinct from old.frozen_at then
    raise exception 'ASSESSMENT_FROZEN' using errcode = 'P0001';
  end if;
  if new.status <> 'DRAFT' and not exists (
       select 1 from public.instrument_version i, public.rules_version r
       where i.version_id = new.instrument_version_id and i.status = 'PUBLISHED'
         and r.version_id = new.rules_version_id and r.status = 'PUBLISHED') then
    raise exception 'VERSION_NOT_PUBLISHED' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger assessment_guard before update on public.assessment
  for each row execute function app.assessment_guard();

-- ---------------------------------------------------------------- privileges and RLS switches (policies: migration 5)

alter table public.instrument_version  enable row level security;
alter table public.rules_version       enable row level security;
alter table public.scenario            enable row level security;
alter table public.scenario_statement  enable row level security;
alter table public.item                enable row level security;
alter table public.setup_record        enable row level security;
alter table public.assessment          enable row level security;

revoke all on public.instrument_version, public.rules_version, public.scenario,
              public.scenario_statement, public.item, public.setup_record, public.assessment
  from anon, authenticated;
grant select on public.instrument_version, public.rules_version, public.scenario,
                public.scenario_statement, public.item, public.assessment to authenticated;
grant select, insert, update on public.setup_record to authenticated;   -- Client Admin / Consultant write Sections A-I (Table 7)
grant all on public.instrument_version, public.rules_version, public.scenario,
             public.scenario_statement, public.item, public.setup_record, public.assessment
  to service_role;
