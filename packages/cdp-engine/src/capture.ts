/**
 * Pure validation and lifecycle rules used by the API layer (spec §0.6, §1.6, §2.3–§2.6, §4.6, §4.8).
 * No I/O: route handlers call these, then persist. Error codes match Appendix J.
 */
import { ORIENTATIONS, DIMENSIONS_CS, LIKERT_DIMS, Orientation } from "./num.js";
import * as cfg from "./config.js";
import { addDays, addWorkingDays, workingDays, ISODate } from "./dates.js";

export interface Problem { code: string; status: number; title: string; [k: string]: unknown }
const problem = (code: string, status: number, title: string, extra: Record<string, unknown> = {}): Problem => ({ code, status, title, ...extra });

// ---------------------------------------------------------------- capture validation (§2.6.1, AC-2.2)

export function validateAllocation(alloc: Record<string, unknown>, scenarioId: string, perspective: string): Problem | null {
  const keys = Object.keys(alloc).sort();
  if (keys.join() !== [...ORIENTATIONS].sort().join()) return problem("CONSTANT_SUM_VIOLATION", 422, "Allocations must cover exactly ENGAGE, INNOVATE, PERFORM, GOVERN", { scenario_id: scenarioId, perspective });
  const vals = ORIENTATIONS.map((o) => alloc[o]);
  if (vals.some((v) => typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100))
    return problem("CONSTANT_SUM_VIOLATION", 422, "Allocations must be whole numbers from 0 to 100", { scenario_id: scenarioId, perspective });
  const total = (vals as number[]).reduce((a, b) => a + b, 0);
  if (total !== 100) return problem("CONSTANT_SUM_VIOLATION", 422, "Allocations must total exactly 100", { detail: `Received ${total}.`, scenario_id: scenarioId, perspective, received: total });
  return null;
}

/** Validate a draft or final survey payload; returns every problem (empty = valid). */
export function validateSurveyPayload(body: { alloc?: Record<string, Record<string, (Record<string, unknown> | null)[]>>; likert?: Record<string, (number | null)[]>; eos?: (number | null)[] }): Problem[] {
  const out: Problem[] = [];
  for (const [persp, dims] of Object.entries(body.alloc ?? {})) {
    if (persp !== "NOW" && persp !== "PREFERRED") { out.push(problem("VALIDATION_FAILED", 422, `Unknown perspective ${persp}`)); continue; }
    for (const [d, scen] of Object.entries(dims ?? {})) {
      if (!(DIMENSIONS_CS as readonly string[]).includes(d)) { out.push(problem("VALIDATION_FAILED", 422, `Unknown dimension ${d}`)); continue; }
      if (scen.length > 3) out.push(problem("VALIDATION_FAILED", 422, `${d} has at most 3 scenarios`));
      scen.forEach((s, i) => { if (s) { const p = validateAllocation(s, `${d}-S${i + 1}`, persp); if (p) out.push(p); } });
    }
  }
  for (const [d, vals] of Object.entries(body.likert ?? {})) {
    if (!(LIKERT_DIMS as readonly string[]).includes(d) || vals.length > 12) { out.push(problem("VALIDATION_FAILED", 422, `${d} accepts 12 items`)); continue; }
    if (vals.some((v) => v !== null && (!Number.isInteger(v) || v < 1 || v > 5))) out.push(problem("SCALE_OUT_OF_RANGE", 422, `${d} items accept 1–5`, { field: d }));
  }
  const eos = body.eos ?? [];
  if (eos.length > 8) out.push(problem("VALIDATION_FAILED", 422, "eOS has 8 items"));
  if (eos.some((v) => v !== null && (!Number.isInteger(v) || v < 0 || v > 10))) out.push(problem("SCALE_OUT_OF_RANGE", 422, "eOS items accept 0–10", { field: "eos" }));
  return out;
}

/** 360 rating validation (§2.6.1): self form needs all 60 values 1–5; rater forms accept null as NOT_OBSERVED. */
export function validate360(ratings: (number | null)[], kind: "SELF" | "RATER"): Problem | null {
  if (ratings.length !== 60) return problem("VALIDATION_FAILED", 422, "A 360 form has exactly 60 items");
  if (ratings.some((v) => v !== null && (!Number.isInteger(v) || v < 1 || v > 5))) return problem("SCALE_OUT_OF_RANGE", 422, "360 items accept 1–5");
  if (kind === "SELF" && ratings.some((v) => v === null)) return problem("VALIDATION_FAILED", 422, "All 60 self items are required before submission");
  return null;
}

/** Progress shown to the respondent (§2.5): scenario sets completed ÷ 36. */
export function surveyProgress(body: { alloc?: Record<string, Record<string, (unknown | null)[]>> }): { sets_done: number; of: 36 } {
  let n = 0;
  for (const dims of Object.values(body.alloc ?? {})) for (const scen of Object.values(dims ?? {})) n += scen.filter(Boolean).length;
  return { sets_done: n, of: 36 };
}

// ---------------------------------------------------------------- engagement lifecycle (§0.6, Table 8)

export type EngagementState = "SETUP" | "FIELDING" | "SCORING" | "REPORTING" | "DEBRIEF" | "PLANNING" | "IMPLEMENTATION" | "PULSE" | "RE_ASSESSMENT" | "CLOSED";
export interface EngagementGuards {
  preflightPassed?: boolean; windowClosed?: boolean; dataFrozen?: boolean; scoreFrozen?: boolean; orgReportReleased?: boolean; boardSummaryReleased?: boolean;
  priorityZeroRecorded?: boolean; debriefLogged?: boolean; orgPlanApprovedAndPublished?: boolean; pulseComplete?: boolean;
  twelveMonthsElapsed?: boolean; triggerAccepted?: boolean; nextCycleCreated?: boolean; clientExitRecorded?: boolean;
}
const ENGAGEMENT_TRANSITIONS: Record<string, { roles: string[]; guard: (g: EngagementGuards) => string | null }> = {
  "SETUP>FIELDING": { roles: ["PAC_CONSULTANT", "CLIENT_ADMIN"], guard: (g) => (g.preflightPassed ? null : "Launch pre-flight has not passed") },
  "FIELDING>SCORING": { roles: ["PAC_CONSULTANT"], guard: (g) => (!g.windowClosed ? "Survey window is still open" : !g.dataFrozen ? "Dataset is not frozen" : null) },
  "SCORING>REPORTING": { roles: ["PAC_CONSULTANT"], guard: (g) => (g.scoreFrozen ? null : "Score object is not frozen") },
  "REPORTING>DEBRIEF": { roles: ["PAC_CONSULTANT"], guard: (g) => (g.orgReportReleased && g.boardSummaryReleased ? null : "Organisational Culture Report and Board / Executive Summary must be released") },
  "DEBRIEF>PLANNING": { roles: ["PAC_CONSULTANT"], guard: (g) => (g.priorityZeroRecorded && g.debriefLogged ? null : "Priority zero and the debrief must be recorded") },
  "PLANNING>IMPLEMENTATION": { roles: ["PAC_CONSULTANT"], guard: (g) => (g.orgPlanApprovedAndPublished ? null : "Organisation-level plan must be approved by an Executive and published") },
  "IMPLEMENTATION>PULSE": { roles: ["PAC_CONSULTANT", "SYSTEM"], guard: () => null },
  "PULSE>IMPLEMENTATION": { roles: ["PAC_CONSULTANT", "SYSTEM"], guard: (g) => (g.pulseComplete ? null : "Pulse not complete") },
  "IMPLEMENTATION>RE_ASSESSMENT": { roles: ["PAC_CONSULTANT"], guard: (g) => (g.twelveMonthsElapsed || g.triggerAccepted ? null : "Needs 12 months elapsed or an accepted trigger") },
  "RE_ASSESSMENT>SETUP": { roles: ["PAC_CONSULTANT"], guard: (g) => (g.nextCycleCreated ? null : "Create the next cycle with carry-forward first") },
  "RE_ASSESSMENT>CLOSED": { roles: ["PAC_CONSULTANT"], guard: (g) => (g.clientExitRecorded ? null : "Record the client exit first") },
};

/** Returns null when allowed, otherwise the RFC 7807 problem to return (409 ILLEGAL_TRANSITION / 403). */
export function checkEngagementTransition(from: EngagementState, to: EngagementState, role: string, guards: EngagementGuards): Problem | null {
  const t = ENGAGEMENT_TRANSITIONS[`${from}>${to}`];
  if (!t) return problem("ILLEGAL_TRANSITION", 409, `${from} → ${to} is not allowed`);
  if (!t.roles.includes(role)) return problem("FORBIDDEN", 403, `${role} cannot move an engagement ${from} → ${to}`);
  const why = t.guard(guards);
  return why ? problem("ILLEGAL_TRANSITION", 409, why, { from, to }) : null;
}

// ---------------------------------------------------------------- org graph validation V1–V7 (§1.6.1)

export interface OrgUnit { unit_id: string; parent_unit_id: string | null; type: "DIVISION" | "DEPARTMENT" | "TEAM"; rollup_to_parent?: boolean }
export interface PersonOfRecord { person_id: string; employee_ref: string; email: string; unit_id: string | null; grade_id: string | null; location_id?: string | null; employment_status: "ACTIVE" | "ON_LEAVE" | "EXITED"; invited?: boolean }
export interface LeaderAssignment { person_id: string; team_id: string; effect_from: ISODate; effect_to: ISODate | null }
export interface Defect { rule: string; blocking: boolean; refs: string[]; message: string }

export function validateOrgGraph(o: { units: OrgUnit[]; people: PersonOfRecord[]; leaders: LeaderAssignment[]; grades: { grade_id: string; is_executive: boolean }[];
  windowStart: ISODate; multiSite: boolean; overrides?: Record<string, string> }): Defect[] {
  const out: Defect[] = [];
  const active = o.people.filter((p) => p.employment_status === "ACTIVE");
  const teams = o.units.filter((u) => u.type === "TEAM");
  const onDate = (l: LeaderAssignment) => l.effect_from <= o.windowStart && (l.effect_to === null || l.effect_to >= o.windowStart);
  const leadersOn = o.leaders.filter(onDate);
  // structure: one root, no cycles
  const byId = new Map(o.units.map((u) => [u.unit_id, u]));
  const roots = o.units.filter((u) => !u.parent_unit_id);
  const cyc: string[] = [];
  for (const u of o.units) { const seen = new Set<string>(); let c: OrgUnit | undefined = u; while (c && c.parent_unit_id) { if (seen.has(c.unit_id)) { cyc.push(u.unit_id); break; } seen.add(c.unit_id); c = byId.get(c.parent_unit_id); } }
  if (roots.length !== 1 || cyc.length) out.push({ rule: "STRUCTURE", blocking: true, refs: cyc.length ? cyc : roots.map((r) => r.unit_id), message: "Org units must form one tree with a single root and no cycles" });
  // every team sits under a department (Table 15); divisions are optional
  const badTeams = teams.filter((t) => byId.get(t.parent_unit_id ?? "")?.type !== "DEPARTMENT").map((t) => t.unit_id);
  if (badTeams.length) out.push({ rule: "STRUCTURE", blocking: true, refs: badTeams, message: "Every team must sit directly under a department" });
  const v1 = teams.filter((t) => leadersOn.filter((l) => l.team_id === t.unit_id).length !== 1).map((t) => t.unit_id);
  if (v1.length) out.push({ rule: "V1", blocking: true, refs: v1, message: "Every team needs exactly one active accountable leader on the window start date" });
  const people = new Map(o.people.map((p) => [p.person_id, p]));
  const v2 = leadersOn.filter((l) => { const p = people.get(l.person_id); return !p || p.employment_status !== "ACTIVE" || p.invited === false; }).map((l) => l.person_id);
  if (v2.length) out.push({ rule: "V2", blocking: true, refs: [...new Set(v2)], message: "Every accountable leader must be an active person of record and an invited respondent" });
  const v3 = leadersOn.filter((l) => { const members = active.filter((p) => p.unit_id === l.team_id); return members.length === 1 && members[0].person_id === l.person_id; }).map((l) => l.team_id);
  // reporting chain: each leader's manager is the accountable leader of the team the leader belongs to; it must not loop
  const leaderOf = new Map(leadersOn.map((l) => [l.team_id, l.person_id]));
  const managerOf = (pid: string): string | null => { const u = people.get(pid)?.unit_id; const m = u ? leaderOf.get(u) : undefined; return m && m !== pid ? m : null; };
  for (const l of leadersOn) {
    const seen = new Set<string>([l.person_id]);
    for (let m = managerOf(l.person_id); m; m = managerOf(m)) { if (seen.has(m)) { v3.push(l.team_id); break; } seen.add(m); }
  }
  if (v3.length) out.push({ rule: "V3", blocking: true, refs: [...new Set(v3)], message: "A person cannot lead their own team as its only member, and the reporting chain must have no cycles" });
  const v4 = active.filter((p) => !p.unit_id || !byId.has(p.unit_id) || byId.get(p.unit_id)!.type !== "TEAM" || !p.grade_id || (o.multiSite && !p.location_id)).map((p) => p.employee_ref);
  if (v4.length) out.push({ rule: "V4", blocking: true, refs: v4, message: "Every person must resolve to exactly one team, one grade and (multi-site) one location" });
  const execGrades = new Set(o.grades.filter((g) => g.is_executive).map((g) => g.grade_id));
  const execN = active.filter((p) => p.grade_id && execGrades.has(p.grade_id)).length;
  if (!execGrades.size || execN < cfg.get("segments.floor")) out.push({ rule: "V5", blocking: false, refs: [], message: `Executive cohort projected at ${execN}; perception gap will not compute below ${cfg.get("segments.floor")}` });
  const v6 = teams.filter((t) => !t.rollup_to_parent && active.filter((p) => p.unit_id === t.unit_id).length < cfg.get("segments.floor")).map((t) => t.unit_id);
  if (v6.length) out.push({ rule: "V6", blocking: true, refs: v6, message: "Teams below 5 must be marked “roll up to parent”" });
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const seenEmail = new Map<string, number>();
  for (const p of o.people) seenEmail.set(p.email.toLowerCase(), (seenEmail.get(p.email.toLowerCase()) ?? 0) + 1);
  const v7 = o.people.filter((p) => !emailRe.test(p.email) || seenEmail.get(p.email.toLowerCase())! > 1).map((p) => p.employee_ref);
  if (v7.length) out.push({ rule: "V7", blocking: true, refs: v7, message: "Work emails must be unique and well-formed" });
  // consultant overrides with a recorded reason convert a blocking defect to non-blocking (listed in every report's technical appendix)
  return out.map((d) => (o.overrides?.[d.rule] ? { ...d, blocking: false, message: d.message + ` (overridden: ${o.overrides[d.rule]})` } : d));
}

// ---------------------------------------------------------------- workshop record for agreeing a section (AC-1.3)

/** A section can be agreed only with a workshop date (not in the future) and at least two executives present. */
export function checkWorkshopRecord(workshopDate: ISODate | null | undefined, executives: number, today: ISODate): Problem | null {
  const min = cfg.get("setup.min_workshop_executives");
  if (!workshopDate || !/^\d{4}-\d{2}-\d{2}$/.test(workshopDate) || workshopDate > today || executives < min)
    return problem("WORKSHOP_RECORD_MISSING", 422, `A section needs a workshop date (today or earlier) and at least ${min} executives present before it can be agreed`);
  return null;
}

// ---------------------------------------------------------------- launch pre-flight L1–L8 (§1.6.2)

export interface PreflightInput {
  orgDefects: Defect[];
  sections: Record<string, { status: "DRAFT" | "AGREED" | "LOCKED"; workshop_date?: ISODate | null; executive_participants?: number; has_agreed_perspective?: boolean }>;
  hasPriorityWithGoalType: boolean; businessModelSet: boolean; leadershipTargetResolved: boolean;
  scorecard: { objectives: number; kpisWithBaselineAndTarget: number };
  sectionILocked: boolean; window: { open: ISODate; close: ISODate }; holidays?: ISODate[]; overlapsLiveAssessment: boolean; languagesPublished: boolean;
  consentApproved: boolean; privacyRegimeSet: boolean; residencySet: boolean; outOfRegionProcessing: boolean; transferBasisRecorded: boolean;
  /** Spec 1.4.5: a data protection impact assessment is recorded on the tenant before first launch. Unnumbered in Table 25, so it has its own id. */
  dpiaRecorded: boolean;
  invitationDiff: number; l360InScope: boolean; ratersApprovedForAll: boolean;
}
export interface PreflightCheck { id: string; check: string; pass: boolean; blocking: boolean; detail?: unknown }

export function preflight(i: PreflightInput): { pass: boolean; checks: PreflightCheck[] } {
  const wd = workingDays(i.window.open, i.window.close, i.holidays ?? []);
  const minExec = cfg.get("setup.min_workshop_executives");
  const need = ["B", "C", "D", "F", "G", "H", "I"];
  const badSections = [...need, "E"].filter((s) => {
    const r = i.sections[s];
    if (!r) return true;
    const okStatus = s === "E" ? !!r.has_agreed_perspective : r.status === "AGREED" || r.status === "LOCKED";
    return !okStatus || !r.workshop_date || (r.executive_participants ?? 0) < minExec;
  });
  const checks: PreflightCheck[] = [
    { id: "L1", check: "Mapping validation passes or every failure carries a consultant override", pass: !i.orgDefects.some((d) => d.blocking), blocking: true, detail: i.orgDefects.filter((d) => d.blocking).map((d) => d.rule) },
    { id: "L2", check: "Sections B, C, D, F, G, H, I agreed; E has an agreed perspective; each with a workshop record and ≥ 2 executives", pass: badSections.length === 0, blocking: true, detail: badSections },
    { id: "L3", check: "A B3 priority with a goal type, business model set, leadership target orientation resolved", pass: i.hasPriorityWithGoalType && i.businessModelSet && i.leadershipTargetResolved, blocking: true },
    { id: "L4", check: "Scorecard has an objective and a KPI with baseline and 12-month target", pass: i.scorecard.objectives >= 1 && i.scorecard.kpisWithBaselineAndTarget >= 1, blocking: true },
    { id: "L5", check: `Section I locked; window ≥ ${cfg.get("survey.min_window_working_days")} working days (${wd}); no overlapping live assessment; languages published`,
      pass: i.sectionILocked && wd >= cfg.get("survey.min_window_working_days") && !i.overlapsLiveAssessment && i.languagesPublished, blocking: true, detail: { working_days: wd } },
    { id: "L6", check: "Consent text approved; privacy regime and residency set; transfer basis recorded for any out-of-region processing",
      pass: i.consentApproved && i.privacyRegimeSet && i.residencySet && (!i.outOfRegionProcessing || i.transferBasisRecorded), blocking: true },
    { id: "DPIA", check: "A data protection impact assessment is recorded for the organisation", pass: i.dpiaRecorded, blocking: true },
    { id: "L7", check: "Invitation list matches ACTIVE persons in scope", pass: i.invitationDiff === 0, blocking: false, detail: { difference: i.invitationDiff } },
    { id: "L8", check: "Leadership 360 raters nominated and approved for each leader in scope", pass: !i.l360InScope || i.ratersApprovedForAll, blocking: false },
  ];
  return { pass: checks.every((c) => c.pass || !c.blocking), checks };
}

// ---------------------------------------------------------------- reminders and window (§2.6.2)

/** STANDARD reminder plan: working day 3, working day 6, 24 h before close, final to started-not-submitted. */
export function reminderSchedule(open: ISODate, close: ISODate, holidays: ISODate[] = []) {
  return [
    { kind: "REMINDER_WD3", on: addWorkingDays(open, 3, holidays), audience: "NOT_SUBMITTED" },
    { kind: "REMINDER_WD6", on: addWorkingDays(open, 6, holidays), audience: "NOT_SUBMITTED" },
    { kind: "REMINDER_CLOSE_24H", on: addDays(close, -1), audience: "NOT_SUBMITTED" },
    { kind: "FINAL_STARTED_NOT_SUBMITTED", on: addDays(close, -1), audience: "STARTED_NOT_SUBMITTED" },
  ];
}

/** Extending the survey window is not controlled by the platform (owner ruling 22 Oct 2026, Erick Ngala comments 22 and 72): any number of times,
 *  by any length, with a reason, "what if there is a lockdown?". The one check is a sanity bound of 1 to 365 working days. */
export function checkExtension(extraWorkingDays: number): Problem | null {
  if (!Number.isInteger(extraWorkingDays) || extraWorkingDays < 1 || extraWorkingDays > 365) return problem("VALIDATION_FAILED", 422, "An extension is 1 to 365 working days");
  return null;
}

/** Completion-time statement check (D-11): after 30 COMPLETE responses, prompt if the median is outside 30–50 minutes. */
export const completionStatementNeedsUpdate = (completeCount: number, medianSeconds: number) => completeCount >= 30 && (medianSeconds < 1800 || medianSeconds > 3000);

// ---------------------------------------------------------------- setup derivations (§1.5.4)

/** Share of F1 behaviours whose orientation tag differs between EXECUTIVE and HR entries (SETUP_DIVERGENCE). */
export function f1Divergence(exec: Orientation[], hr: Orientation[]): number {
  const n = Math.min(exec.length, hr.length);
  if (!n) return 0;
  let d = 0;
  for (let i = 0; i < n; i++) if (exec[i] !== hr[i]) d++;
  return d / n;
}

/** Observable-behaviour warning for F1 (§1.4.2): fewer than 6 words or no verb from the list; consultant may override. */
export function f1BehaviourWarning(text: string, observableVerbs: string[]): string | null {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 6) return "Fewer than six words: describe what someone would see the leader do";
  const lower = words.map((w) => w.toLowerCase().replace(/[^a-z-]/g, ""));
  if (!observableVerbs.some((v) => lower.includes(v.toLowerCase()))) return "No observable verb: this reads as a value statement";
  return null;
}

// ---------------------------------------------------------------- report release gate (§4.6, UT-40)

export function checkRelease(r: { sections: Record<string, string | null | undefined>; accepted: Record<string, unknown>; aiSections: string[];
  scorePayloadHash: string | null; reportPayloadHash: string | null; technicalAppendixPresent: boolean }): Problem | null {
  const missing = ["what_this_means", "what_to_do_next"].filter((k) => !r.sections[k] || !r.sections[k]!.trim() || !(k in r.accepted));
  const unaccepted = r.aiSections.filter((k) => !(k in r.accepted));
  const reasons: string[] = [];
  if (missing.length) reasons.push("mandatory sections without accepted text: " + missing.join(", "));
  if (unaccepted.length) reasons.push("AI text not accepted: " + unaccepted.join(", "));
  if (!r.scorePayloadHash || r.scorePayloadHash !== r.reportPayloadHash) reasons.push("report is not drawn from the pinned score object");
  if (!r.technicalAppendixPresent) reasons.push("technical appendix missing");
  return reasons.length ? problem("RELEASE_INCOMPLETE", 422, "Report cannot be released", { reasons, missing }) : null;
}

/** Export rules (S4-06, AC-4.6, AC-5.7): released versions only; leader outputs never into prohibited contexts. */
export function checkExport(o: { released: boolean; kind: "REPORT" | "RAW_DATA" | "LEADER_OUTPUT"; context?: string | null }): Problem | null {
  if (o.kind === "RAW_DATA") return problem("EXPORT_FORBIDDEN", 403, "Raw response data is never exported");
  if (!o.released) return problem("EXPORT_FORBIDDEN", 403, "Only released report versions can be exported");
  if (o.kind === "LEADER_OUTPUT" && o.context && ["PERFORMANCE", "REMUNERATION", "SUCCESSION", "DISCIPLINARY"].includes(o.context))
    return problem("EXPORT_FORBIDDEN", 403, "Leader outputs are development-only and cannot enter performance, pay, succession or disciplinary contexts");
  return null;
}
