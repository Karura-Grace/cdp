-- Applied 2026-10-02 to project swnvjucteqguqdbsdmsl.
-- 4/6 Frozen score object, stored evaluation, reports and the release gate.
-- Spec: Appendix A rows score_object, report; §0.5 override rule 2; §4.6 release.
-- CLAUDE.md §3 rows 2, 3 and 6.
--
-- Out of the demo slice: segment_profile, segment_query_log, finding/scenario_match rows
-- (findings are read from evaluation.payload_json), priority/action tables, narrative_draft,
-- event_outbox, pulses. Add with their phases.

-- ---------------------------------------------------------------- score_object

create table public.score_object (
  score_id      text primary key default app.new_id('sco'),
  tenant_id     text not null,
  assessment_id text not null,
  version       int  not null check (version > 0),
  payload_json  jsonb not null,           -- engine toJsonable(scoreAssessment(...)); numbers stay strings
  payload_hash  text not null,            -- 'sha256:...' from the engine's canonical hash
  frozen_at     timestamptz,
  frozen_by     uuid,
  created_at timestamptz not null default now(), created_by uuid,
  unique (assessment_id, version),
  unique (assessment_id, payload_hash),   -- idempotent re-run: same hash means no new version
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create index score_object_tenant_idx on public.score_object (tenant_id);

-- Payload and hash never change. Once frozen, nothing changes and nothing is deleted.
create function app.score_object_guard() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.frozen_at is not null then raise exception 'SCORE_FROZEN' using errcode = 'P0001'; end if;
    return old;
  end if;
  if old.frozen_at is not null then raise exception 'SCORE_FROZEN' using errcode = 'P0001'; end if;
  if (new.payload_json, new.payload_hash, new.assessment_id, new.version)
       is distinct from (old.payload_json, old.payload_hash, old.assessment_id, old.version) then
    raise exception 'SCORE_PAYLOAD_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger score_object_guard before update or delete on public.score_object
  for each row execute function app.score_object_guard();

-- ---------------------------------------------------------------- evaluation (rules-engine output for one score version)

create table public.evaluation (
  tenant_id     text not null,
  assessment_id text not null,
  score_version int  not null,
  payload_json  jsonb not null,           -- engine evaluate(...) output, canonical
  payload_hash  text not null,
  created_at timestamptz not null default now(), created_by uuid,
  primary key (assessment_id, score_version),
  foreign key (assessment_id, score_version) references public.score_object(assessment_id, version),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id)
);
create index evaluation_tenant_idx on public.evaluation (tenant_id);
create trigger evaluation_no_update before update or delete on public.evaluation
  for each row execute function app.deny_mutation();

-- ---------------------------------------------------------------- report and release gate

create table public.report (
  report_id     text primary key default app.new_id('rep'),
  tenant_id     text not null,
  assessment_id text not null,
  score_version int  not null,
  type          text not null check (type in
                  ('BOARD_EXEC_SUMMARY', 'ORGANISATIONAL', 'SUB_CULTURE', 'LEADER', 'LEADERSHIP_TEAM', 'ACTION_PLAN')),
  audience      text,
  status        text not null default 'DRAFT' check (status in ('DRAFT', 'RELEASED')),
  released_by   uuid,
  released_at   timestamptz,
  payload_hash  text,                      -- must equal the score_object hash at release
  files         jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(), created_by uuid,
  updated_at timestamptz not null default now(), updated_by uuid,
  foreign key (assessment_id, score_version) references public.score_object(assessment_id, version),
  foreign key (assessment_id, tenant_id) references public.assessment(assessment_id, tenant_id),
  check ((status = 'RELEASED') = (released_by is not null and released_at is not null))
);
create index report_assessment_idx on public.report (assessment_id, score_version);
create index report_tenant_idx on public.report (tenant_id);
create trigger report_touch before insert or update on public.report
  for each row execute function app.touch();

-- Release rules enforced in the database, whoever calls (route handlers use service_role):
--   * only an active PAC Consultant assignee of the engagement may release (Table 7: Report release);
--   * the score object must be frozen, and the report hash must equal its hash (traceability);
--   * a released report never changes (Table 68 / AC-4.x).
-- The editorial checks (mandatory sections, accepted text) are the engine's checkRelease, before this call.
create function app.report_release_guard() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare s record; eng text;
begin
  if tg_op = 'UPDATE' and old.status = 'RELEASED' then
    raise exception 'REPORT_RELEASED' using errcode = 'P0001';
  end if;
  if new.status = 'RELEASED' then
    select * into s from public.score_object where assessment_id = new.assessment_id and version = new.score_version;
    if s.frozen_at is null then
      raise exception 'RELEASE_INCOMPLETE' using errcode = 'P0001', detail = 'score object not frozen';
    end if;
    if new.payload_hash is distinct from s.payload_hash then
      raise exception 'RELEASE_INCOMPLETE' using errcode = 'P0001', detail = 'report hash differs from score object';
    end if;
    select engagement_id into eng from public.assessment where assessment_id = new.assessment_id;
    if not app.is_active_assignee(new.released_by, eng) then
      raise exception 'FORBIDDEN' using errcode = 'P0001', detail = 'releaser is not an active PAC Consultant on this engagement';
    end if;
  end if;
  return new;
end $$;
create trigger report_release_guard before insert or update on public.report
  for each row execute function app.report_release_guard();
create trigger report_no_delete before delete on public.report
  for each row execute function app.deny_mutation();

create function app.audit_report_release() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'RELEASED' and (tg_op = 'INSERT' or old.status <> 'RELEASED') then
    insert into public.audit_log (tenant_id, actor_id, action, object_type, object_id, payload_hash)
    values (new.tenant_id, new.released_by, 'report.released', 'report', new.report_id, new.payload_hash);
  end if;
  return new;
end $$;
create trigger report_audit_release after insert or update on public.report
  for each row execute function app.audit_report_release();

-- ---------------------------------------------------------------- privileges (policies: migration 5)

alter table public.score_object enable row level security;
alter table public.evaluation   enable row level security;
alter table public.report       enable row level security;

revoke all on public.score_object, public.evaluation, public.report from anon, authenticated;
grant select on public.score_object, public.evaluation, public.report to authenticated;
grant all    on public.score_object, public.evaluation, public.report to service_role;
