-- Applied 2026-10-02 to project swnvjucteqguqdbsdmsl.
-- 5/6 Row-level security for every public table in migrations 1-4. Spec Table 7.
-- All policies are `to authenticated` and go through app.* helpers wrapped in (select ...)
-- so Postgres evaluates them once per statement, not once per row.
--
-- Cells covered here (Table 7, slice objects only). Anything not listed has no policy = no access.
--
--   Object                    SUPER_ADMIN  PAC_CONSULTANT    CLIENT_ADMIN       EXECUTIVE         PEOPLE_LEADER   COACH
--   tenant                    R            R (assigned)      R (own)            -                 -               -
--   engagement                R            R (assigned)      R (own tenant)     R (own tenant)    R (own tenant)  R (own tenant)
--   instrument/rules/items    R            R                 -                  -                 -               -
--   setup_record              -            R W (assigned)    R W (own tenant)   R (own tenant)    -               -
--   assessment                -            R (assigned)      R (own tenant)     -                 -               -
--   score_object, evaluation  -            R (assigned)      R after release    R after release   -               -
--   report                    -            R (assigned)      R released         R released        R released ORG  -
--   audit_log                 R            R (assigned)      R (own tenant)     -                 -               -
--   individual responses      NO ONE (schema capture, migration 3)
--
-- Writes: no INSERT/UPDATE grant exists for `authenticated` except setup_record.
-- Every other write is a route handler using service_role after engine validation,
-- backed by the guard triggers in migrations 1-4. The staff UI must READ with the
-- user's own JWT client so these policies actually apply; service_role bypasses RLS.
-- Coach and People Leader see only reports (org-level) in this slice; leader and team
-- scopes arrive with 360 and segments.

-- ---------------------------------------------------------------- tenant

create policy tenant_read on public.tenant for select to authenticated using (
  (select app.is_super_admin())
  or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN')
);

-- ---------------------------------------------------------------- engagement

create policy engagement_read on public.engagement for select to authenticated using (
  (select app.is_super_admin())
  or engagement_id in (select app.pac_engagement_ids())
  or tenant_id = (select app.client_tenant_id())
);

-- ---------------------------------------------------------------- who is who (own rows; Super Admin reads all)

create policy platform_admin_read on app.platform_admin for select to authenticated using (
  user_id = (select auth.uid()) or (select app.is_super_admin())
);
create policy membership_read on app.membership for select to authenticated using (
  user_id = (select auth.uid()) or (select app.is_super_admin())
);
create policy assignment_read on app.engagement_assignment for select to authenticated using (
  user_id = (select auth.uid()) or (select app.is_super_admin())
);

-- ---------------------------------------------------------------- instrument and rules

create policy instrument_version_read on public.instrument_version for select to authenticated using (
  (select app.is_super_admin()) or (select app.is_pac_consultant())
);
create policy rules_version_read on public.rules_version for select to authenticated using (
  (select app.is_super_admin()) or (select app.is_pac_consultant())
);
create policy scenario_read on public.scenario for select to authenticated using (
  (select app.is_super_admin()) or (select app.is_pac_consultant())
);
create policy scenario_statement_read on public.scenario_statement for select to authenticated using (
  (select app.is_super_admin()) or (select app.is_pac_consultant())
);
create policy item_read on public.item for select to authenticated using (
  (select app.is_super_admin()) or (select app.is_pac_consultant())
);

-- ---------------------------------------------------------------- setup_record

create policy setup_record_read on public.setup_record for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id())
      and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE'))
);

create policy setup_record_insert on public.setup_record for insert to authenticated with check (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'
      and perspective <> 'AGREED')                 -- agreeing a section is the Consultant's act (Table 7: A)
);

create policy setup_record_update on public.setup_record for update to authenticated
using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'
      and perspective <> 'AGREED')
)
with check (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN'
      and perspective <> 'AGREED' and status <> 'AGREED')
);

-- ---------------------------------------------------------------- assessment

create policy assessment_read on public.assessment for select to authenticated using (
  engagement_id in (select app.pac_engagement_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN')
);

-- ---------------------------------------------------------------- score_object, evaluation: the release gate
-- A client role sees a score version only if a RELEASED report pins exactly that version.
-- The released-report check runs in a definer helper so the gate does not depend on report's own policy.

create function app.score_released(p_assessment text, p_version int) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.report r
                 where r.assessment_id = p_assessment and r.score_version = p_version and r.status = 'RELEASED')
$$;
revoke execute on function app.score_released(text, int) from public, anon;
grant  execute on function app.score_released(text, int) to authenticated, service_role;

create policy score_object_read on public.score_object for select to authenticated using (
  assessment_id in (select a.assessment_id from public.assessment a
                    where a.engagement_id in (select app.pac_engagement_ids()))
  or (tenant_id = (select app.client_tenant_id())
      and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')
      and app.score_released(assessment_id, version))
);

create policy evaluation_read on public.evaluation for select to authenticated using (
  assessment_id in (select a.assessment_id from public.assessment a
                    where a.engagement_id in (select app.pac_engagement_ids()))
  or (tenant_id = (select app.client_tenant_id())
      and (select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')
      and app.score_released(assessment_id, score_version))
);

-- ---------------------------------------------------------------- report

create policy report_read on public.report for select to authenticated using (
  assessment_id in (select a.assessment_id from public.assessment a
                    where a.engagement_id in (select app.pac_engagement_ids()))
  or (tenant_id = (select app.client_tenant_id()) and status = 'RELEASED' and (
        ((select app.client_role()) in ('CLIENT_ADMIN', 'EXECUTIVE')
           and type in ('BOARD_EXEC_SUMMARY', 'ORGANISATIONAL', 'LEADERSHIP_TEAM', 'ACTION_PLAN'))
        or ((select app.client_role()) = 'PEOPLE_LEADER' and type = 'ORGANISATIONAL')
     ))
);

-- ---------------------------------------------------------------- audit_log

create policy audit_log_read on public.audit_log for select to authenticated using (
  (select app.is_super_admin())
  or tenant_id in (select app.pac_tenant_ids())
  or (tenant_id = (select app.client_tenant_id()) and (select app.client_role()) = 'CLIENT_ADMIN')
);

-- ---------------------------------------------------------------- policy-column indexes not already covered
-- (tenant_id and assessment_id/engagement_id indexes exist from migrations 1-4.)
create index setup_record_engagement_idx on public.setup_record (engagement_id);
