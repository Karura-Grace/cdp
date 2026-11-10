import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { projectCohort, type CohortIn, type CohortPerson } from "./cohorts";
import { STAFF_TEMPLATE_VERSION } from "./staff-message";
import { all, leaderScope, type StoredGraph } from "./org-graph";

// The pre-flight pieces that need the database and are not scoring rules: Section I cohorts, the difference report for L7, the rater
// report for L8, the tenant calendar and the staff message approval. Every threshold comes from the engine configuration.
type Db = ReturnType<typeof admin>;
const day = (s: string | null | undefined) => (s ? s.slice(0, 10) : "");

// ---------------------------------------------------------------- calendar (tenant holidays and the performance review period)

export async function loadCalendar(db: Db, tenantId: string) {
  const [{ data: hol }, { data: t }] = await Promise.all([
    db.from("tenant_holiday").select("day, label").eq("tenant_id", tenantId).order("day"),
    db.from("tenant").select("review_period_start, review_period_end").eq("tenant_id", tenantId).single(),
  ]);
  return { holidays: (hol ?? []).map((h) => ({ day: day(h.day), label: h.label })), review_start: t?.review_period_start ?? null, review_end: t?.review_period_end ?? null };
}

// ---------------------------------------------------------------- I1 cohorts

export interface CohortRow { name: string; size: number; rollup: boolean; ok: boolean }

/** Projected size of each Section I cohort (ACTIVE persons matching), against the reporting floor. Below the floor blocks unless rolled up. */
export async function cohortReport(db: Db, tenantId: string, cohorts: CohortIn[], at: string): Promise<CohortRow[]> {
  if (!cohorts.length) return [];
  const [people, units, grades, bands, attrs, vals] = await Promise.all([
    all<CohortPerson>((a, b) => db.from("person_of_record").select("person_id, unit_id, grade_id, start_date").eq("tenant_id", tenantId).eq("employment_status", "ACTIVE").order("person_id").range(a, b)),
    all((a, b) => db.from("org_unit").select("unit_id, name, type, parent_unit_id").eq("tenant_id", tenantId).order("unit_id").range(a, b)),
    all((a, b) => db.from("grade_band").select("grade_id, name, is_executive").eq("tenant_id", tenantId).order("grade_id").range(a, b)),
    all((a, b) => db.from("tenure_band").select("name, min_months, max_months").eq("tenant_id", tenantId).order("band_id").range(a, b)),
    db.from("demographic_attribute").select("attr_id, name").eq("tenant_id", tenantId),
    all((a, b) => db.from("person_demographic").select("person_id, attr_id, value").eq("tenant_id", tenantId).order("person_id").range(a, b)),
  ]);
  const attrName = new Map((attrs.data ?? []).map((x) => [x.attr_id, x.name.trim().toLowerCase()]));
  const demographics = new Map<string, Record<string, string>>();
  for (const v of vals) { const n = attrName.get(v.attr_id); if (n) demographics.set(v.person_id, { ...(demographics.get(v.person_id) ?? {}), [n]: v.value }); }
  const floor = E.config.get("segments.floor");
  return cohorts.map((c) => {
    const size = projectCohort(c, people, { units, grades, bands, demographics, at });
    return { name: c.name, size, rollup: c.rollup_to_parent === true, ok: size >= floor || c.rollup_to_parent === true };
  });
}

// ---------------------------------------------------------------- L7 difference report

export interface Difference { missing_email: string[]; not_on_list: string[]; no_longer_active: string[]; active: number; declared_headcount: number | null; count: number }

/**
 * L7: the invitation list against the ACTIVE persons in scope. Before any link is issued the list is the one the roster invitation would
 * produce: every ACTIVE person with a usable work email. Once links exist the list is the invitation roster. The report names people by
 * employee reference only. The declared headcount is shown beside the count for context and does not change the result.
 */
export async function differenceReport(db: Db, assessmentId: string, tenantId: string): Promise<Difference> {
  const [people, roster, ten] = await Promise.all([
    all((a, b) => db.from("person_of_record").select("person_id, employee_ref, email, employment_status").eq("tenant_id", tenantId).order("person_id").range(a, b)),
    all((a, b) => db.from("invitation_roster").select("person_id").eq("assessment_id", assessmentId).order("person_id").range(a, b)),
    db.from("tenant").select("headcount").eq("tenant_id", tenantId).single(),
  ]);
  const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const active = people.filter((p) => p.employment_status === "ACTIVE");
  const onRoster = new Set(roster.map((r) => r.person_id));
  const missing_email = active.filter((p) => !emailOk(p.email)).map((p) => p.employee_ref).sort();
  const not_on_list = roster.length ? active.filter((p) => !onRoster.has(p.person_id)).map((p) => p.employee_ref).sort() : [];
  const byId = new Map(people.map((p) => [p.person_id, p]));
  const no_longer_active = roster.filter((r) => byId.get(r.person_id)?.employment_status !== "ACTIVE").map((r) => byId.get(r.person_id)?.employee_ref ?? r.person_id).sort();
  return { missing_email, not_on_list, no_longer_active, active: active.length, declared_headcount: ten.data?.headcount ?? null, count: missing_email.length + not_on_list.length + no_longer_active.length };
}

// ---------------------------------------------------------------- L8 Leadership 360 configuration

export interface LeaderRaters { assignment_id: string; team_key: string; ok: boolean; reasons: string[]; counts: Record<string, number>; proposed: number }

/**
 * L8: for each leader in scope on the window start date, raters nominated and approved. A leader is complete when nothing waits for
 * approval, peers are 3 to 8 (spec 1.4.6, D-09) and there are at least 3 non self raters in total.
 */
export async function ratersReport(db: Db, assessmentId: string, graph: StoredGraph, windowStart: string): Promise<{ inScope: boolean; leaders: LeaderRaters[] }> {
  const scope = leaderScope(graph, windowStart);
  if (!scope.length) return { inScope: false, leaders: [] };
  const noms = await all((a, b) => db.from("rater_nomination").select("assignment_id, rater_group, status").eq("assessment_id", assessmentId).order("nomination_id").range(a, b));
  const leaders = scope.map((l) => {
    const mine = noms.filter((n) => n.assignment_id === l.assignment_id);
    const counts: Record<string, number> = {};
    for (const n of mine.filter((x) => x.status !== "PROPOSED")) counts[n.rater_group] = (counts[n.rater_group] ?? 0) + 1;
    const proposed = mine.filter((x) => x.status === "PROPOSED").length, total = Object.values(counts).reduce((a, b) => a + b, 0), peers = counts.PEER ?? 0;
    const reasons: string[] = [];
    if (proposed) reasons.push(`${proposed} proposed rater${proposed === 1 ? "" : "s"} waiting for approval`);
    if (total < 3) reasons.push(`${total} approved rater${total === 1 ? "" : "s"}; at least 3 are needed`);
    if (peers < 3 || peers > 8) reasons.push(`${peers} peers; 3 to 8 are needed`);
    return { assignment_id: l.assignment_id, team_key: l.team_key, ok: reasons.length === 0, reasons, counts, proposed };
  });
  return { inScope: true, leaders };
}

// ---------------------------------------------------------------- staff message approval

/** True when the owner's approval covers the template wording in this build. */
export async function templatesApproved(db: Db): Promise<boolean> {
  const { data } = await db.from("platform_setting").select("value").eq("key", "staff_templates_approved").maybeSingle();
  return (data?.value as { approved_version?: string | null } | null)?.approved_version === STAFF_TEMPLATE_VERSION;
}

