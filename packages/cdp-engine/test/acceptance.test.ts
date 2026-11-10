/** Acceptance criteria owned by the engine (AC-1.x … AC-6.x) beyond the named UT-xx tests. */
import { describe, it, expect } from "vitest";
import {
  checkWorkshopRecord, validateSurveyPayload, validate360, surveyProgress, checkEngagementTransition, validateOrgGraph, preflight, reminderSchedule, checkExtension,
  completionStatementNeedsUpdate, f1Divergence, f1BehaviourWarning, checkRelease, checkExport, transition, WorkflowError, TRANSITIONS,
  missingCompanions, assertCompanions, assertCap, rag, escalation, kpiProgress, heatmap, segmentMetrics, Suppressed, leaderCultureLink,
  leadershipPopulation, draftDevelopmentPlan, scoreLeader, screenSection, screenDraft, terminologyScan, pulseTriggers, otherTriggers, adjustOrRetire,
  kpiDirection, rolloverPlan, evaluate, matchScenarios, config, D, profileOf, workingDays, addWorkingDays, verbatimAllowed, cohortVisible,
  raterGroupPublishable, perceptionForSplit, classifyAll, payloadNumbers, scoreAssessment, deriveSetup, scoreLeaders, buildPlan,
} from "../src/index.js";
import type { ActionStatus, PreflightInput, ResponseInput } from "../src/index.js";
import { fixture, loadCase } from "./helpers.js";
import { illustrativeRatings } from "./data.js";

describe("Stage 1 setup", () => {
  it("AC-1.3 a section is agreed only with a workshop date and two executives", () => {
    expect(checkWorkshopRecord("2026-09-20", 2, "2026-10-03")).toBeNull();
    expect(checkWorkshopRecord("2026-10-03", 3, "2026-10-03")).toBeNull();
    for (const [d, n] of [[null, 3], [undefined, 3], ["", 3], ["20/09/2026", 3], ["2026-10-04", 3], ["2026-09-20", 1], ["2026-09-20", 0]] as const)
      expect(checkWorkshopRecord(d, n, "2026-10-03")?.code).toBe("WORKSHOP_RECORD_MISSING");
  });

  const base = {
    units: [{ unit_id: "u_root", parent_unit_id: null, type: "DIVISION" as const }, { unit_id: "u_dep", parent_unit_id: "u_root", type: "DEPARTMENT" as const },
      { unit_id: "t1", parent_unit_id: "u_dep", type: "TEAM" as const }, { unit_id: "t2", parent_unit_id: "u_dep", type: "TEAM" as const }],
    people: [...Array(12)].map((_, i) => ({ person_id: `p${i}`, employee_ref: `E${i}`, email: `p${i}@x.co`, unit_id: i < 6 ? "t1" : "t2", grade_id: i < 5 ? "g_exec" : "g1", employment_status: "ACTIVE" as const })),
    leaders: [{ person_id: "p0", team_id: "t1", effect_from: "2026-01-01", effect_to: null }, { person_id: "p6", team_id: "t2", effect_from: "2026-01-01", effect_to: null }],
    grades: [{ grade_id: "g_exec", is_executive: true }, { grade_id: "g1", is_executive: false }], windowStart: "2026-10-05", multiSite: false,
  };
  it("AC-1.2 a clean org graph has no defects", () => expect(validateOrgGraph(base)).toEqual([]));
  it("AC-1.2 every team must sit directly under a department; the root is not a team", () => {
    const under = (parent: string) => validateOrgGraph({ ...base, units: base.units.map((u) => (u.unit_id === "t2" ? { ...u, parent_unit_id: parent } : u)) });
    expect(under("u_dep")).toEqual([]);
    const d = under("u_root");                                   // a team directly under a division
    expect(d.find((x) => x.rule === "STRUCTURE")?.refs).toEqual(["t2"]);
    expect(under("t1").find((x) => x.rule === "STRUCTURE")?.refs).toEqual(["t2"]);   // a team under a team
    const rootTeam = validateOrgGraph({ ...base, units: [{ unit_id: "t1", parent_unit_id: null, type: "TEAM" }], leaders: [], people: [] });
    expect(rootTeam.find((x) => x.message.includes("under a department"))?.refs).toEqual(["t1"]);
  });
  it("AC-1.2 V1 two leaders on one team; V7 duplicate email; V6 small team; V4 unresolved person", () => {
    const d = validateOrgGraph({ ...base, leaders: [...base.leaders, { person_id: "p1", team_id: "t1", effect_from: "2026-01-01", effect_to: null }],
      people: [...base.people.slice(0, 11), { ...base.people[11], email: "p0@x.co" }, { person_id: "px", employee_ref: "EX", email: "px@x.co", unit_id: null, grade_id: "g1", employment_status: "ACTIVE" }] });
    expect(d.map((x) => x.rule)).toEqual(expect.arrayContaining(["V1", "V4", "V7"]));
    const small = validateOrgGraph({ ...base, people: base.people.filter((p) => p.unit_id === "t1" || p.person_id === "p6") });
    expect(small.find((x) => x.rule === "V6")?.refs).toEqual(["t2"]);
    expect(validateOrgGraph({ ...base, units: base.units.map((u) => u.unit_id === "t2" ? { ...u, rollup_to_parent: true } : u), people: base.people.filter((p) => p.unit_id === "t1" || p.person_id === "p6") }).some((x) => x.rule === "V6")).toBe(false);
  });
  it("AC-1.2 V3 reporting-chain cycle and a sole-member self-led team", () => {
    const people = base.people.map((p) => (p.person_id === "p0" ? { ...p, unit_id: "t2" } : p.person_id === "p6" ? { ...p, unit_id: "t1" } : p));
    expect(validateOrgGraph({ ...base, people }).some((x) => x.rule === "V3")).toBe(true);
  });
  it("AC-1.2 an override with a reason makes a blocking defect non-blocking", () => {
    const d = validateOrgGraph({ ...base, people: base.people.filter((p) => p.unit_id === "t1" || p.person_id === "p6"), overrides: { V6: "Team merges next month" } });
    expect(d.find((x) => x.rule === "V6")!.blocking).toBe(false);
  });
  it("V5 executive cohort below 5 is a warning, not a block", () => {
    const d = validateOrgGraph({ ...base, people: base.people.map((p, i) => (i < 5 && i > 1 ? { ...p, grade_id: "g1" } : p)) });
    expect(d.find((x) => x.rule === "V5")!.blocking).toBe(false);
  });
  const ok: PreflightInput = {
    orgDefects: [], sections: Object.fromEntries(["B", "C", "D", "E", "F", "G", "H", "I"].map((s) => [s, { status: "AGREED" as const, workshop_date: "2026-09-20", executive_participants: 3, has_agreed_perspective: true }])),
    hasPriorityWithGoalType: true, businessModelSet: true, leadershipTargetResolved: true, scorecard: { objectives: 1, kpisWithBaselineAndTarget: 1 },
    sectionILocked: true, window: { open: "2026-10-05", close: "2026-10-19" }, overlapsLiveAssessment: false, languagesPublished: true, consentApproved: true,
    privacyRegimeSet: true, residencySet: true, outOfRegionProcessing: true, transferBasisRecorded: true, dpiaRecorded: true, invitationDiff: 0, l360InScope: true, ratersApprovedForAll: true,
  };
  it("AC-1.5 pre-flight passes; L1–L6 block; L7–L8 only warn", () => {
    expect(preflight(ok).pass).toBe(true);
    const shortWin = preflight({ ...ok, window: { open: "2026-10-05", close: "2026-10-15" } });
    expect(shortWin.pass).toBe(false); expect(shortWin.checks.find((c) => c.id === "L5")!.pass).toBe(false);
    expect(preflight({ ...ok, transferBasisRecorded: false }).checks.find((c) => c.id === "L6")!.pass).toBe(false);
    expect(preflight({ ...ok, sections: { ...ok.sections, F: { status: "AGREED", workshop_date: "2026-09-20", executive_participants: 1 } } }).pass).toBe(false);
    const noDpia = preflight({ ...ok, dpiaRecorded: false });
    expect(noDpia.pass).toBe(false); expect(noDpia.checks.find((c) => c.id === "DPIA")!.pass).toBe(false);
    const warn = preflight({ ...ok, invitationDiff: 3, ratersApprovedForAll: false });
    expect(warn.pass).toBe(true); expect(warn.checks.filter((c) => !c.pass).map((c) => c.id)).toEqual(["L7", "L8"]);
  });
  it("10 working days excludes weekends and tenant holidays", () => {
    expect(workingDays("2026-10-05", "2026-10-16")).toBe(10);
    expect(workingDays("2026-10-05", "2026-10-16", ["2026-10-10", "2026-10-20"])).toBe(10);   // 10 Oct is a Saturday
    expect(workingDays("2026-10-05", "2026-10-16", ["2026-10-14"])).toBe(9);
  });
  it("F1 divergence and observable-behaviour warning", () => {
    expect(f1Divergence(["ENGAGE", "ENGAGE", "PERFORM", "GOVERN", "ENGAGE"], ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN", "PERFORM"])).toBe(0.4);
    expect(f1BehaviourWarning("We value people", ["coach", "ask"])).toMatch(/six words/);
    expect(f1BehaviourWarning("Leaders coach each direct report every week", ["coach"])).toBeNull();
  });
});

describe("Stage 2 assessment", () => {
  it("AC-2.2 survey payload validation catches every bad allocation and scale", () => {
    const errs = validateSurveyPayload({ alloc: { NOW: { D1: [{ ENGAGE: 30, INNOVATE: 30, PERFORM: 30, GOVERN: 20 }, null, { ENGAGE: 25, INNOVATE: 25, PERFORM: 25, GOVERN: 25 }] } },
      likert: { D7: [1, 6, null] }, eos: [11] });
    expect(errs.map((e) => e.code)).toEqual(["CONSTANT_SUM_VIOLATION", "SCALE_OUT_OF_RANGE", "SCALE_OUT_OF_RANGE"]);
    expect(validateSurveyPayload({ alloc: { NOW: { D1: [{ ENGAGE: 40, INNOVATE: 30, PERFORM: 20, GOVERN: 10 }] } } })).toEqual([]);
  });
  it("360 forms: self needs all 60; rater accepts NOT_OBSERVED", () => {
    expect(validate360(Array(60).fill(3), "SELF")).toBeNull();
    expect(validate360([...Array(59).fill(3), null], "SELF")?.code).toBe("VALIDATION_FAILED");
    expect(validate360([...Array(59).fill(3), null], "RATER")).toBeNull();
    expect(validate360(Array(60).fill(6), "RATER")?.code).toBe("SCALE_OUT_OF_RANGE");
  });
  it("progress counts scenario sets of 36", () => expect(surveyProgress({ alloc: { NOW: { D1: [{}, {}, null] } } })).toEqual({ sets_done: 2, of: 36 }));
  it("AC-2.5 reminder plan: working day 3, working day 6, 24 h before close, final", () => {
    expect(reminderSchedule("2026-10-05", "2026-10-19").map((r) => r.on)).toEqual(["2026-10-08", "2026-10-13", "2026-10-18", "2026-10-18"]);
    expect(addWorkingDays("2026-10-09", 1)).toBe("2026-10-12");
  });
  it("the survey window can be extended any number of times, by any length from 1 to 365 working days", () => {
    expect(checkExtension(1)).toBeNull(); expect(checkExtension(30)).toBeNull(); expect(checkExtension(90)).toBeNull(); expect(checkExtension(365)).toBeNull();
    expect(checkExtension(0)?.code).toBe("VALIDATION_FAILED"); expect(checkExtension(366)?.code).toBe("VALIDATION_FAILED"); expect(checkExtension(2.5)?.code).toBe("VALIDATION_FAILED");
  });
  it("D-11 completion-time prompt", () => { expect(completionStatementNeedsUpdate(30, 3200)).toBe(true); expect(completionStatementNeedsUpdate(29, 3200)).toBe(false); expect(completionStatementNeedsUpdate(40, 2400)).toBe(false); });
  it("AC-2.7 cohorts below 5 invited are never shown; floors for verbatims and rater groups", () => {
    expect(cohortVisible(4)).toBe(false); expect(cohortVisible(5)).toBe(true); expect(verbatimAllowed(7)).toBe(false); expect(verbatimAllowed(8)).toBe(true);
    expect(raterGroupPublishable("SUPERIOR", 3)).toBe(false); expect(raterGroupPublishable("PEER", 3)).toBe(true); expect(raterGroupPublishable("OTHER", 3)).toBe(true);
  });
  it("AC-2.6 completion states on the seeded dataset", () => {
    const { scored } = classifyAll(loadCase("fixture").input.responses);
    const counts: Record<string, number> = {};
    for (const r of scored) counts[r._state] = (counts[r._state] ?? 0) + 1;
    expect(counts).toEqual({ COMPLETE: 441, PARTIAL_CULTURE: 22, INSUFFICIENT: 12 });
  });
});

describe("Engagement lifecycle (§0.6)", () => {
  it("each transition enforces its guard; unknown transitions are 409", () => {
    expect(checkEngagementTransition("SETUP", "FIELDING", "PAC_CONSULTANT", { preflightPassed: true })).toBeNull();
    expect(checkEngagementTransition("SETUP", "FIELDING", "PAC_CONSULTANT", {})?.status).toBe(409);
    expect(checkEngagementTransition("FIELDING", "SCORING", "PAC_CONSULTANT", { windowClosed: true, dataFrozen: false })?.title).toMatch(/frozen/);
    expect(checkEngagementTransition("REPORTING", "DEBRIEF", "PAC_CONSULTANT", { orgReportReleased: true })?.status).toBe(409);
    expect(checkEngagementTransition("SETUP", "REPORTING", "PAC_CONSULTANT", {})?.code).toBe("ILLEGAL_TRANSITION");
    expect(checkEngagementTransition("SCORING", "REPORTING", "CLIENT_ADMIN", { scoreFrozen: true })?.status).toBe(403);
  });
});

describe("Stage 3 segments and leaders", () => {
  it("AC-3.5 department heat-map: permitted cells carry metrics; suppression never shows a zero", () => {
    const f = fixture();
    const cells = heatmap(f.scored, "department", f.obj, {}, "organisation", "ENGAGE");
    expect(cells.map((c) => c.value)).toEqual(["dep_00", "dep_01", "dep_02", "dep_03", "dep_04", "dep_05", "dep_06"]);
    expect(cells.every((c) => c.suppressed || (c.n! >= 5 && c.metrics))).toBe(true);
    const ops = cells.find((c) => c.value === "dep_04")!.metrics!;
    expect(ops.readiness.tps).not.toBeNull(); expect(Object.keys(ops.subculture)).toContain("significance");
  });
  it("AC-3.5 a small department and its complement are both suppressed (differencing)", () => {
    const f = fixture();
    const scored = f.scored.map((r, i) => (r.snapshot.department === "dep_06" ? { ...r, snapshot: { ...r.snapshot, department: i % 7 === 0 ? "dep_tiny" : "dep_06" } } : r));
    const cells = heatmap(scored, "department", f.obj, { department: "dep_06" });
    expect(cells.length).toBe(1);   // within dep_06 only dep_06 remains, nothing to difference
    const pair = heatmap(scored.filter((r) => ["dep_06", "dep_tiny"].includes(String(r.snapshot.department))), "department", f.obj);
    expect(pair.every((c) => c.suppressed)).toBe(true);
    expect(pair.map((c) => c.reason).sort()).toEqual(["DIFFERENCING_PROTECTION", "PRIMARY_FLOOR"]);
    expect(pair.every((c) => c.n === null && c.rollup_label)).toBe(true);
  });
  it("segment queries below the floor throw (→ 409), never an empty payload", () => {
    const f = fixture();
    expect(() => segmentMetrics(f.scored, { department: "dep_06", grade: "G9" }, f.obj)).toThrow(Suppressed);
  });
  it("perception split reports the reason when a cohort is below 5 (UT-21)", () => {
    const f = fixture();
    expect(perceptionForSplit(f.scored, (r) => r.snapshot.grade === "EXEC" && r.id < "rsp_0003")).toEqual({ computed: false, reason: "EXECUTIVE_COHORT_BELOW_FLOOR" });
    expect(perceptionForSplit(f.scored, (r) => !!r.snapshot.is_executive).computed).toBe(true);
  });
  it("leader–culture link: team below the floor falls back to the parent and says so", () => {
    const f = fixture();
    const { self, other } = illustrativeRatings();
    const leader = { ...scoreLeader(self, [...Array(4)].map(() => ({ group: "DIRECT_REPORT" as const, ratings: other })), "ENGAGE"), assignment_id: "lda_x", headcount_led: 30 };
    const link = leaderCultureLink(leader, [{ department: "dep_01", grade: "G9" }, { department: "dep_01" }], f.scored, f.obj, "ENGAGE");
    expect(link.team_basis).toEqual({ department: "dep_01" });
    expect(link.team_basis_note).toMatch(/below the reporting threshold/);
    const orgLink = leaderCultureLink(leader, [], f.scored, f.obj, "ENGAGE");
    expect(orgLink.fit_index.toFixed(2)).toBe("91.44"); expect(orgLink.classification).toBe("NEUTRAL");
  });
  it("leadership population needs ≥ 5 valid results; counts by class, never by name", () => {
    const { self, other } = illustrativeRatings();
    const ls = [...Array(5)].map((_, i) => ({ ...scoreLeader(self, [...Array(3)].map(() => ({ group: "PEER" as const, ratings: other })), "ENGAGE"), assignment_id: `l${i}`, headcount_led: 10 }));
    expect(leadershipPopulation(ls.slice(0, 4), []).computed).toBe(false);
    const pop = leadershipPopulation(ls, []);
    expect(pop.computed && pop.n).toBe(5); expect(pop.computed && pop.collective_blind_spots).toContain("F");
  });
  it("Leader Development Plan: growth, target and blind-spot actions, max 3", () => {
    const { self, other } = illustrativeRatings();
    const l = scoreLeader(self, [...Array(3)].map(() => ({ group: "PEER" as const, ratings: other })), "ENGAGE");
    const ldp = draftDevelopmentPlan(l, "PERFORM", "BEHAVIOUR_GAP");
    expect(ldp.map((a) => a.basis)).toEqual(["GROWTH", "TARGET", "BLIND_SPOT"]); expect(ldp[0].support).toBe("COACHING_MIN_8_SESSIONS");
    expect(draftDevelopmentPlan({ valid: false, rater_count: 1 }, "ENGAGE")).toEqual([]);
  });
  it("a valid 360 counts toward coverage and blends the TPS (provisional removed at ≥ 60%)", () => {
    const c = loadCase("fixture_leader");
    const setup = deriveSetup(c.input.setup);
    const leaders = scoreLeaders(c.input.leaders, setup.leadership_target_orientation);
    const all = scoreAssessment(c.input.responses, setup, leaders, [{ headcount_led: 140 }]);
    expect(all.obj.readiness.coverage.toFixed(4)).toBe("1.0000"); expect(all.obj.readiness.provisional).toBe(false);
    expect(all.obj.readiness.leadership_alignment_source).toBe("BLENDED");
  });
});

describe("Stage 4 reporting", () => {
  it("segment and leader signals append findings and match SC-06 / SC-07 / SC-08 (aggregate only)", () => {
    const f = fixture();
    const ev = evaluate(f.obj, f.setup, {
      segments: [{ segment: "department:dep_03", significance: "CONFIRMED", dominance_divergence: true, is_subculture: true, eos_negative: ["Q1"] }],
      leaders: [{ assignment_id: "l1", lri: D("3.6"), fit: D("50"), classification: "CULTURE_BLOCKER", team_dominant: "ENGAGE", team_eos_differential: D("-12"), flags: ["SAFETY"] }],
    });
    expect(ev.findings.slice(0, f.ev.findings.length).map((x) => x.finding_id)).toEqual(f.ev.findings.map((x) => x.finding_id));   // org IDs stable
    expect(ev.findings.map((x) => x.type)).toEqual(expect.arrayContaining(["SUBCULTURE", "LEADER_FLAG"]));
    expect(ev.scenarios.map((s) => s.scenario_id)).toEqual(["SC-05", "SC-01", "SC-07", "SC-10", "SC-06", "SC-08"]);
    expect(ev.blocking.some((b) => b.type === "LEADER_FLAG")).toBe(true);
  });
  it("SC-12 matches only when all checks HIT, strength ≥ 10 and no negative eOS", () => {
    const f = fixture();
    const hit = { verdict: "HIT" as const };
    const obj = { ...f.obj, culture_strength: D("10.00"), eos: { Q1: 5, Q2: 0, Q3: 1, Q4: 2, Q5: 3, Q6: 4, Q7: 5, Q8: 6, index: D("3.3") }, perception_gap: null };
    expect(matchScenarios(obj, { C1: hit, C2: hit, C3: hit, C4: hit }).map((s) => s.scenario_id)).toContain("SC-12");
  });
  it("AC-4.4 release refuses unaccepted AI text or a report not drawn from the pinned score", () => {
    const base = { sections: { what_this_means: "x", what_to_do_next: "y" }, accepted: { what_this_means: {}, what_to_do_next: {} }, aiSections: ["judgement"], scorePayloadHash: "a", reportPayloadHash: "a", technicalAppendixPresent: true };
    expect(checkRelease(base)?.reasons).toEqual(["AI text not accepted: judgement"]);
    expect(checkRelease({ ...base, aiSections: [], reportPayloadHash: "b" })?.reasons).toEqual(["report is not drawn from the pinned score object"]);
    expect(checkRelease({ ...base, aiSections: [] })).toBeNull();
  });
  it("AC-4.6 / AC-5.7 exports: released only; never raw data; leader outputs blocked from prohibited contexts", () => {
    expect(checkExport({ released: false, kind: "REPORT" })?.status).toBe(403);
    expect(checkExport({ released: true, kind: "RAW_DATA" })?.code).toBe("EXPORT_FORBIDDEN");
    expect(checkExport({ released: true, kind: "LEADER_OUTPUT", context: "SUCCESSION" })?.code).toBe("EXPORT_FORBIDDEN");
    expect(checkExport({ released: true, kind: "LEADER_OUTPUT", context: "COACHING" })).toBeNull();
  });
  it("AI screens: causal language, attribution, traceability (uncited sentences stripped, unknown cites blocked)", () => {
    const o = { allowedNumbers: payloadNumbers(fixture().payload), findingIds: new Set(["fnd_0001", "fnd_0005"]), denyList: [], smallGroupNames: ["Finance team"] };
    expect(screenSection({ text: "The culture drove attrition. [fnd_0001]", cites: ["fnd_0001"] }, o).blocked).toContain("CAUSAL_LANGUAGE: use associational wording");
    expect(screenSection({ text: "The Finance team stands out. [fnd_0001]", cites: ["fnd_0001"] }, o).blocked[0]).toMatch(/ATTRIBUTION/);
    const t = screenSection({ text: "Executives and staff see different organisations. [fnd_0005] This is unsupported filler.", cites: ["fnd_0005"] }, o);
    expect(t.ok).toBe(true); expect(t.stripped).toEqual(["This is unsupported filler."]);
    expect(screenSection({ text: "x [fnd_0099]", cites: ["fnd_0099"] }, o).blocked[0]).toMatch(/TRACEABILITY/);
    expect(screenDraft({ sections: { a: { text: "TPS is 3.09. [fnd_0001]", cites: ["fnd_0001"] } } }, o).ok).toBe(true);
  });
  it("terminology build gate reports file and line", () => {
    expect(terminologyScan([{ path: "a.ts", content: "ok\nuses Forbidden term\n" }], ["forbidden"])).toEqual([{ path: "a.ts", line: 2 }]);
  });
});

describe("Stage 5 workflow", () => {
  const ALL: ActionStatus[] = ["DRAFT", "IN_REVIEW", "IN_CO_DESIGN", "APPROVED", "PUBLISHED", "IN_PROGRESS", "UNDER_REVIEW", "CLOSED", "RETIRED", "DISCARDED"];
  it("AC-5.4 every transition outside the table is 409 ILLEGAL_TRANSITION", () => {
    let illegal = 0;
    for (const a of ALL) for (const b of ALL) {
      if (TRANSITIONS.has(`${a}>${b}`)) continue;
      try { transition({ status: a }, b, "PAC_CONSULTANT"); throw new Error(`${a}→${b} allowed`); } catch (e) { expect((e as WorkflowError).code).toBe("ILLEGAL_TRANSITION"); expect((e as WorkflowError).status).toBe(409); illegal++; }
    }
    expect(illegal).toBe(ALL.length * ALL.length - TRANSITIONS.size);
  });
  it("happy path DRAFT → CLOSED with role checks and mandatory fields", () => {
    let a: Record<string, unknown> & { status: string } = { status: "DRAFT", horizon: "STRUCTURAL_12M_PLUS" };
    a = transition(a, "IN_REVIEW", "PAC_CONSULTANT"); a = transition(a, "IN_CO_DESIGN", "PAC_CONSULTANT");
    expect(() => transition(a, "APPROVED", "CLIENT_ADMIN")).toThrow(/FORBIDDEN/);
    try { transition({ ...a, owner: "p1", sponsor: "p2", kpi: "k", baseline_value: 1, target_value: 2, start_date: "2026-11-01", end_date: "2027-06-01" }, "APPROVED", "EXECUTIVE"); }
    catch (e) { expect((e as WorkflowError).extra.missing).toEqual(["budget_amount"]); }
    a = transition({ ...a, owner: "p1", sponsor: "p2", kpi: "k", baseline_value: 1, target_value: 2, start_date: "2026-11-01", end_date: "2027-06-01", budget_amount: "100000" }, "APPROVED", "EXECUTIVE");
    a = transition(a, "PUBLISHED", "PAC_CONSULTANT", { openGates: [] }); a = transition(a, "IN_PROGRESS", "PEOPLE_LEADER");
    a = transition(a, "UNDER_REVIEW", "PEOPLE_LEADER"); a = transition(a, "CLOSED", "EXECUTIVE", { evidenceCount: 1 });
    expect(a.status).toBe("CLOSED");
    expect(() => transition({ status: "DRAFT" }, "DISCARDED", "PAC_CONSULTANT")).toThrow(/reason/);
  });
  it("AC-5.6 generated plans always carry their mandatory companions; a stripped priority is refused and named", () => {
    for (const p of fixture().plan.priorities) expect(missingCompanions(p, p.actions)).toEqual([]);
    const p = fixture().plan.priorities[0];
    expect(missingCompanions(p, p.actions.filter((a) => !a.is_visible_signal))).toEqual(["VISIBLE_SIGNAL"]);
    expect(() => assertCompanions(p, p.actions.filter((a) => !a.objective.startsWith("Release")))).toThrow(/TRADE_OFF_ACTION/);
  });
  it("caps: ≤ 6 organisation actions per priority; ≤ 3 unit and ≤ 3 leader actions; tenant override", () => {
    expect(() => assertCap("UNIT", 3)).toThrow(/CAP_EXCEEDED/); expect(() => assertCap("ORGANISATION", 5)).not.toThrow();
    expect(() => config.withTenant({ "plan.action_caps": [6, 4, 3] }, () => assertCap("UNIT", 3))).not.toThrow();
    for (const p of fixture().plan.priorities) expect(p.actions.length).toBeLessThanOrEqual(6);
  });
  it("RAG computed rules (§5.6.1)", () => {
    const a = { status: "IN_PROGRESS", baseline_value: 28, target_value: 45, end_date: "2027-10-31" };
    expect(rag(a, "2027-01-01", { readings: [31] })).toBe("GREEN");
    expect(rag(a, "2027-01-01", { readings: [26] })).toBe("RED");
    expect(rag(a, "2027-01-01", { readings: [28.5], at90Review: true })).toBe("AMBER");
    expect(rag(a, "2027-01-01", { milestones: [{ due: "2026-12-20", status: "OPEN" }] })).toBe("AMBER");
    expect(rag(a, "2027-01-01", { milestones: [{ due: "2026-12-10", status: "OPEN" }] })).toBe("RED");
    expect(rag(a, "2027-11-01")).toBe("RED");
    expect(rag(a, "2027-01-01", { reviewPointsMissed: 2 })).toBe("RED");
    expect(kpiProgress(19, 13, 16)!.toFixed(2)).toBe("0.50");   // LOWER_IS_BETTER handled by sign
  });
  it("AC-5.5 escalation ladder: 7 / 14 / 21 / 28 and the undelivered visible signal reaches the CEO", () => {
    expect(escalation(0, 0, { daysUntilDue: 7 })).toBe("OWNER_REMINDER"); expect(escalation(3)).toBe("OWNER_DAILY");
    expect(escalation(14)).toBe("SPONSOR"); expect(escalation(21)).toBe("TIER_OWNER"); expect(escalation(0, 2)).toBe("TIER_OWNER");
    expect(escalation(0, 4)).toBe("EXCO_DECISION"); expect(escalation(0, 0, { visibleSignalMissed: true })).toBe("CEO_IMMEDIATE");
  });
  it("STRENGTHEN priorities get a real pathway, not the overplay narrative", () => {
    const f = fixture();
    const obj = { ...f.obj, classification: { ...f.obj.classification, ENGAGE: "STRENGTHEN" as const } };
    const plan = buildPlan(obj, f.ev, f.setup, "2026-11-02");
    const eng = plan.priorities.find((p) => p.orientation === "ENGAGE")!;
    expect(eng.pathway!.relationship).toBe("DIAGONAL"); expect(eng.trade_off_orientation).toBeNull();
  });
});

describe("Stage 6 re-assessment", () => {
  it("AC-6.2 pulse triggers at 0.5 / 15 / 8.0 and non-pulse triggers", () => {
    expect(pulseTriggers({ likert: { D8: "2.8" }, eos: { Q6: -14 }, scenario: { "D2 S2": 18 } }, { likert: { D8: "3.3" }, eos: { Q6: 2 }, scenario: { "D2 S2": "25.9" } }).map((t) => t.ref)).toEqual(["D8", "eOS Q6"]);
    expect(otherTriggers({ structuralActionsByPriority: { pri_01: ["CLOSED", "CLOSED"], pri_02: ["CLOSED", "IN_PROGRESS"] }, orgChanges: [{ type: "NEW_CEO" }, { type: "OTHER" }],
      baselineClosedOn: "2026-10-19", today: "2027-10-19" }).map((t) => t.type)).toEqual(["STRUCTURAL_COMPLETE", "ORG_CHANGE", "ANNUAL"]);
  });
  it("adjust-or-retire decision table (Table 103)", () => {
    expect(adjustOrRetire("TOWARDS", true)).toBe("CONTINUE"); expect(adjustOrRetire("FLAT", true)).toBe("ADJUST_INTERVENTION");
    expect(adjustOrRetire("FLAT", false)).toBe("ADJUST_RESOURCING"); expect(adjustOrRetire("AWAY", true)).toBe("SUSPEND_AND_REDIAGNOSE");
    expect(adjustOrRetire("TOWARDS", true, { preconditionOpen: true })).toBe("RETIRE_AND_REINSTATE_PRECONDITION");
    expect(adjustOrRetire("TOWARDS", true, { findingSupported: false })).toBe("RETIRE_SUPERSEDED");
    expect(adjustOrRetire("TOWARDS", true, { ownerPresent: false })).toBe("REASSIGN_WITHIN_14_DAYS");
    expect(adjustOrRetire("FLAT", true, { consecutiveAdjustmentsWithoutMovement: 2 })).toBe("RETIRE_NOT_ACHIEVED");
    expect(kpiDirection(D("0.06"))).toBe("TOWARDS"); expect(kpiDirection(D("0.05"))).toBe("FLAT"); expect(kpiDirection(D("-0.06"))).toBe("AWAY");
  });
  it("AC-6.6 rollover: setup back to DRAFT, closed actions dropped, system G5 entries recomputed", () => {
    const r = rolloverPlan({ setupSections: { B: { b1: "x" } }, openActions: [{ status: "IN_PROGRESS" }, { status: "CLOSED" }], backlog: [1], g5: [{ source: "WORKSHOP" }, { source: "SYSTEM" }] });
    expect(r.setup.B.status).toBe("DRAFT"); expect(r.actions).toHaveLength(1); expect(r.g5).toEqual([{ source: "WORKSHOP" }]);
  });
});
