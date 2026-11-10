-- Advice library (Erick Ngala comment 197; owner rounds Q-AL1 to Q-AL20 of 31 October 2026 in context-sessions/DECISIONS-LOG.md).
-- The PAC playbook as data: each advice item carries a rule over a report's frozen numbers. Once a report's numbers are out the
-- engine (packages/cdp-engine/src/advice.ts) proposes the matching items; the PAC consultant keeps, drops or rewords each one before release.
--   * advice_library_version: a consultant drafts, a Super Admin publishes; a published version never changes (Q-AL2, Q-AL3).
--   * advice_item: one piece of advice with its rule, level (organisation, group, leader) and optional tags (Q-AL5 to Q-AL11).
--   * report_advice: what was proposed for a report and what the consultant decided; frozen with the report at release.
--   * assessment.advice_version_id: the library version an assessment's advice came from, pinned at the first proposal.
-- Findings stay the engine's (Q-AL13): the library only adds wording. Client roles have no access to the library tables;
-- accepted advice reaches them only inside a released report.

create table public.advice_library_version (
  version_id   text primary key default app.new_id('alv'),
  label        text not null unique,
  status       text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  check ((status = 'DRAFT') = (published_at is null))
);
-- at most one current version
create unique index advice_library_version_current on public.advice_library_version ((true)) where status = 'PUBLISHED';
create trigger advice_library_version_touch before insert or update on public.advice_library_version
  for each row execute function app.touch();

create table public.advice_item (
  item_id     text primary key default app.new_id('adv'),
  version_id  text not null references public.advice_library_version(version_id),
  topic       text not null,                                   -- e.g. ORIENTATION, CHECK, SCENARIO, PATHWAY, DIMENSION, READINESS, ENGAGEMENT, GROUP, LEADER
  level       text not null check (level in ('ORG', 'GROUP', 'LEADER')),
  section     text not null,                                   -- the report result the advice sits under (Q-AL16), e.g. check.C2, orientation.ENGAGE
  priority    int  not null default 50 check (priority between 0 and 100),
  title       text not null,
  diagnosis   text not null default '',
  why         text not null default '',
  risks       text[] not null default '{}',
  actions     jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),   -- [{text, owner_role, horizon, lever}]
  questions   text[] not null default '{}',
  signal      text not null default '',
  watch       text[] not null default '{}',
  good        text[] not null default '{}',
  traps       text[] not null default '{}',
  tags        jsonb not null default '{}'::jsonb check (jsonb_typeof(tags) = 'object'),     -- {sector:[], size:[], business_model:[]}
  rule        jsonb not null check (jsonb_typeof(rule) = 'object'),
  status      text not null default 'DRAFT' check (status in ('DRAFT', 'APPROVED', 'RETIRED')),
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid
);
create index advice_item_version_idx on public.advice_item (version_id, status);
create trigger advice_item_touch before insert or update on public.advice_item
  for each row execute function app.touch();

-- A published version is frozen: its row may only move to RETIRED, and its items never change.
create function app.advice_version_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'DRAFT' then raise exception 'VERSION_IMMUTABLE' using errcode = 'P0001'; end if;
    return old;
  end if;
  if old.status <> 'DRAFT' and not (old.status = 'PUBLISHED' and new.status = 'RETIRED'
       and (new.label, new.published_at, new.published_by) is not distinct from (old.label, old.published_at, old.published_by)) then
    raise exception 'VERSION_IMMUTABLE' using errcode = 'P0001';
  end if;
  if new.status = 'PUBLISHED' and new.published_at is null then new.published_at := now(); end if;
  return new;
end $$;
create trigger advice_library_version_guard before update or delete on public.advice_library_version
  for each row execute function app.advice_version_guard();

create function app.advice_item_guard() returns trigger
language plpgsql set search_path = ''
as $$
declare v text;
begin
  select status into v from public.advice_library_version
   where version_id = case when tg_op = 'INSERT' then new.version_id else old.version_id end;
  if v <> 'DRAFT' then raise exception 'VERSION_IMMUTABLE' using errcode = 'P0001'; end if;
  if tg_op = 'UPDATE' and new.version_id <> old.version_id then raise exception 'VERSION_IMMUTABLE' using errcode = 'P0001'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger advice_item_guard before insert or update or delete on public.advice_item
  for each row execute function app.advice_item_guard();

alter table public.assessment add column advice_version_id text references public.advice_library_version(version_id);

create table public.report_advice (
  report_id     text not null references public.report(report_id),
  item_id       text not null references public.advice_item(item_id),
  tenant_id     text not null,
  version_id    text not null references public.advice_library_version(version_id),
  level         text not null check (level in ('ORG', 'GROUP', 'LEADER')),
  scope_key     text not null default '',                       -- '' for the organisation, the segment key or leader assignment otherwise
  section       text not null,
  proposed_rank int  not null,
  decision      text not null default 'PROPOSED' check (decision in ('PROPOSED', 'ACCEPTED', 'DROPPED')),
  edited        jsonb check (edited is null or jsonb_typeof(edited) = 'object'),   -- the consultant's rewording of item fields
  decided_by    uuid,
  decided_at    timestamptz,
  created_at timestamptz not null default now(), created_by uuid,
  primary key (report_id, item_id, scope_key),
  check ((decision = 'PROPOSED') = (decided_at is null))
);
create index report_advice_tenant_idx on public.report_advice (tenant_id);

-- Frozen with the report: nothing changes once the report is released.
create function app.report_advice_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if exists (select 1 from public.report r where r.report_id = case when tg_op = 'INSERT' then new.report_id else old.report_id end
               and r.status = 'RELEASED') then
    raise exception 'REPORT_RELEASED' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger report_advice_guard before insert or update or delete on public.report_advice
  for each row execute function app.report_advice_guard();

-- ---------------------------------------------------------------- access
-- Reads: PAC staff only (Super Admin, or a consultant with an active assignment). report_advice also to the assigned consultant.
-- Writes: route handlers with service_role after the role checks (consultant drafts, Super Admin publishes), as everywhere else.
alter table public.advice_library_version enable row level security;
alter table public.advice_item enable row level security;
alter table public.report_advice enable row level security;
revoke all on public.advice_library_version, public.advice_item, public.report_advice from public, anon, authenticated, service_role;
grant select on public.advice_library_version, public.advice_item, public.report_advice to authenticated;
grant select, insert, update, delete on public.advice_library_version, public.advice_item, public.report_advice to service_role;

create policy advice_version_read on public.advice_library_version for select to authenticated
  using ((select app.is_super_admin()) or (select app.is_pac_consultant()));
create policy advice_item_read on public.advice_item for select to authenticated
  using ((select app.is_super_admin()) or (select app.is_pac_consultant()));
create policy report_advice_read on public.report_advice for select to authenticated using (
  (select app.is_super_admin())
  or report_id in (select r.report_id from public.report r join public.assessment a using (assessment_id)
                   where a.engagement_id in (select app.pac_engagement_ids()))
);
