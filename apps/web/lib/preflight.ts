import { staffContext } from "./staff-ctx";
import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { kpiForInput } from "./setup-sections";
import { scorecardSource } from "./scorecard";
import { leaderScope, loadGraph, loadInvited, loadOverrides, validate } from "./org-graph";
import { attendanceBatch, executiveCount } from "./setup-workshop";
import { reviewOverlaps } from "./calendar";
import { cohortReport, differenceReport, loadCalendar, ratersReport, templatesApproved } from "./launch-checks";
import { messageGaps } from "./section-i.mjs";
import { templateInUse, type Anonymity } from "./staff-message";
import type { CohortIn } from "./cohorts";
import { consentPurposeWarning } from "./consent-purpose-warning";

// Launch pre-flight (spec §1.6.2) assembled from the database, then judged by the engine. No rule lives here.
// L7 and L8 are computed from the invitation list and the rater nominations (see launch-checks.ts). Extra app side checks that are not
// engine rules: I1 cohort sizes, I4 review period overlap, public holidays recorded, I5 staff message template approval.
const ISO = (s: string | null) => (s ? s.slice(0, 10) : "");

export async function runPreflight(assessmentId: string) {
  const db = admin();
  const { data: asm } = await db.from("assessment").select("*").eq("assessment_id", assessmentId).single();
  if (!asm) throw new Error("assessment not found");
  const [{ data: tenant }, { data: rows }, { data: ct }, { data: ins }, { data: others }] = await Promise.all([
    db.from("tenant").select("privacy_regime, residency_region, transfer_basis_recorded_at, dpia_recorded_at").eq("tenant_id", asm.tenant_id).single(),
    db.from("setup_record").select("section, perspective, status, payload_json, workshop_date, participants, locked_at").eq("engagement_id", asm.engagement_id),
    asm.consent_text_id ? db.from("consent_text").select("status").eq("consent_text_id", asm.consent_text_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("instrument_version").select("status").eq("version_id", asm.instrument_version_id).single(),
    db.from("assessment").select("window_open, window_close").eq("tenant_id", asm.tenant_id).eq("status", "LAUNCHED").neq("assessment_id", assessmentId),
  ]);

  const agreed = new Map((rows ?? []).filter((r) => r.perspective === "AGREED").map((r) => [r.section, r]));
  const sections: E.PreflightInput["sections"] = {};
  // executives present: a person id counts when the grade is an executive grade; a typed name from an older record counts but is unverified
  const att = await attendanceBatch(asm.tenant_id, [...agreed.values()].map((r) => r.participants));
  const execOf = new Map([...agreed.keys()].map((s, i) => [s, executiveCount(att[i])]));
  for (const [s, r] of agreed) {
    sections[s] = {
      status: r.locked_at ? "LOCKED" : r.status === "AGREED" ? "AGREED" : "DRAFT",
      workshop_date: r.workshop_date, executive_participants: execOf.get(s),
      has_agreed_perspective: r.status === "AGREED",
    };
  }

  const p = (s: string) => (agreed.get(s)?.payload_json ?? {}) as Record<string, unknown>;
  const sc = await scorecardSource(asm.engagement_id);
  const kpiFor = sc.kpiFor ?? kpiForInput(p("C"), p("D"), p("G")) ?? {};
  const input = { ...p("B"), ...p("F"), kpi_for: kpiFor } as unknown as E.SetupInput;
  let leadershipTargetResolved = false;
  try { leadershipTargetResolved = !!E.deriveSetup(input).leadership_target_orientation; } catch { /* a tie leaves it unresolved */ }

  const open = ISO(asm.window_open), close = ISO(asm.window_close);
  const overlaps = (others ?? []).some((o) => o.window_open && o.window_close && o.window_open < (asm.window_close ?? "") && o.window_close > (asm.window_open ?? ""));
  // L1: the org graph (V1 to V7) as stored, with the consultant's overrides, as of the survey window start
  const windowStart = open || new Date().toISOString().slice(0, 10);
  const { graph, version } = await loadGraph(db, asm.tenant_id);
  const overrides = await loadOverrides(db, asm.engagement_id);
  const orgDefects = validate(graph, windowStart, overrides, await loadInvited(db, asm.assessment_id));
  // launch slice: tenant calendar, Section I cohorts, L7 difference report, L8 raters, staff message template
  const cal = await loadCalendar(db, asm.tenant_id);
  const holidays = cal.holidays.map((h) => h.day);
  const pi = p("I");
  const cohorts = await cohortReport(db, asm.tenant_id, ((pi.cohorts as CohortIn[] | undefined) ?? []), windowStart);
  const diff = await differenceReport(db, assessmentId, asm.tenant_id);
  const l8 = await ratersReport(db, assessmentId, graph, windowStart);
  const used = templateInUse(pi.staff_message, await staffContext(db, asm.engagement_id, asm.tenant_id));
  const approved = await templatesApproved(db);
  const result = E.preflight({
    orgDefects,
    sections,
    hasPriorityWithGoalType: !!input.priorities?.some((x) => x.goal_type),
    businessModelSet: !!input.business_model,
    leadershipTargetResolved,
    // L4 reads the scorecard entity once one is stored (every stored KPI has a baseline and a 12 month target). An engagement with no scorecard
    // yet keeps the older reading: objectives are the B3 priorities, KPIs are those linked to an orientation in C and D.
    scorecard: sc.objectives || sc.kpis ? { objectives: sc.objectives, kpisWithBaselineAndTarget: sc.kpis }
      : { objectives: Math.max(input.priorities?.length ?? 0, ((p("G").objectives as unknown[]) ?? []).length), kpisWithBaselineAndTarget: Object.keys(kpiFor).length },
    sectionILocked: sections.I?.status === "AGREED" || sections.I?.status === "LOCKED",   // launch locks it
    window: { open, close }, holidays, overlapsLiveAssessment: overlaps, languagesPublished: ins?.status === "PUBLISHED",
    consentApproved: ct?.status === "APPROVED",
    privacyRegimeSet: !!tenant?.privacy_regime, residencySet: !!tenant?.residency_region,
    outOfRegionProcessing: true,                                  // the platform runs in an EU region (CLAUDE.md §2)
    transferBasisRecorded: !!tenant?.transfer_basis_recorded_at,
    dpiaRecorded: !!tenant?.dpia_recorded_at,                     // engine check DPIA (spec 1.4.5)
    invitationDiff: diff.count, l360InScope: l8.inScope, ratersApprovedForAll: l8.leaders.every((l) => l.ok),
  });
  const small = cohorts.filter((c) => !c.ok);
  const i1 = { id: "I1", check: "Section I names at least one cohort, and each is at least the reporting floor or rolls up to its parent", pass: cohorts.length > 0 && small.length === 0, blocking: true, detail: { cohorts } };
  const overlap = reviewOverlaps(open, close, cal.review_start, cal.review_end);
  const i4 = { id: "I4", check: "The survey window does not overlap the performance review period", pass: !overlap, blocking: false, detail: { review_start: cal.review_start, review_end: cal.review_end } };
  const hol = { id: "HOL", check: "Public holidays are recorded for the organisation (working days skip them)", pass: holidays.length > 0, blocking: false, detail: { holidays: holidays.length } };
  // I5 (owner decision, October 2026): launch needs the owner's approval of both templates whatever the message says (edited or not), and a
  // message taken from a template must match I2. The keyword scan is a warning only: it can miss wording, the consultant's tick is the rule.
  const anon = pi.anonymity as Anonymity | undefined;
  const i5 = { id: "I5", check: "The owner has approved both staff message templates, and a message used from a template states the anonymity commitment chosen in I2",
    pass: approved && (!used || used === anon), blocking: true, detail: { template: used, approved, matches_i2: !used || used === anon } };
  const gaps = messageGaps(pi.staff_message);
  const i5w = { id: "I5W", check: "The staff message seems to state the purpose, how results are used, the anonymity commitment and what happens next", pass: gaps.length === 0, blocking: false, detail: { missing: gaps.map((g) => g.text) } };
  const cpw = await consentPurposeWarning(asm.engagement_id);
  const cp = cpw ? { id: cpw.id, check: "The approved consent text states the purpose of the assessment", pass: false, blocking: false, detail: { message: cpw.message } } : null;
  // J2 (owner rulings 19 October 2026): the executive and staff split needs an executive grade; each of A to D needs its own recorded Executive tick
  const [{ count: execGrades }, { data: ticks }] = await Promise.all([
    db.from("grade_band").select("grade_id", { count: "exact", head: true }).eq("tenant_id", asm.tenant_id).eq("is_executive", true),
    db.from("setup_confirmation").select("section").eq("engagement_id", asm.engagement_id).in("section", ["A", "B", "C", "D"]),
  ]);
  const exg = { id: "EXG", check: "At least one grade is marked executive, so the executive and staff views can be computed", pass: (execGrades ?? 0) > 0, blocking: true, detail: { executive_grades: execGrades ?? 0 } };
  const unticked = ["A", "B", "C", "D"].filter((s) => !(ticks ?? []).some((t) => t.section === s));
  const ext = { id: "EXT", check: "An Executive has confirmed each of sections A to D with a recorded tick", pass: unticked.length === 0, blocking: true, detail: { missing: unticked } };
  const extra = [i1, i4, hol, i5, i5w, exg, ext, ...(cp ? [cp] : [])];
  const checks = [...result.checks, ...extra];
  return { pass: result.pass && extra.every((c) => c.pass || !c.blocking), checks, not_assessed: [] as string[],
    org: { version, windowStart, defects: orgDefects, scope: leaderScope(graph, windowStart) }, l7: diff, l8, cohorts, calendar: cal };
}
