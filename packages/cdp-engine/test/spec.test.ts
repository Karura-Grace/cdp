/**
 * Appendix D unit tests UT-01 … UT-62, by ID. Every value is the specification's own worked example.
 */
import { describe, it, expect } from "vitest";
import {
  D, q, ORIENTATIONS, profileOf, validateAllocation, gaps, classifyGap, significant, cultureStrength, lensProfiles, congruence, dominance, eosCategory,
  tps, band15, priorityCap, config, laInstrument, leadershipAlignment, alignmentVerdict, c1Requirements, c4Requirement, behaviourGap, stopStart,
  perceptionFlag, buildPlan, validatePriorityEdit, transition, WorkflowError, checkFloor, Suppressed, resolveSegment, differencingSuppressed,
  scoreLeader, computeLeaderReadings, fitIndex, fitBand, carrierClass, leaderProfile, scoreAssessment, RULES_VERSION, screenSection, payloadNumbers,
  checkRelease, validatePulse, comparability, retentionSchedule, readinessBandIndex, sectionAvg, classifyResponse, withRules, rulesVersion, evaluate, priorityScore,
  tradeOffVerification, urgencyTier, leadershipTarget, deriveSetup, perceptionGap,
} from "../src/index.js";
import type { SectionMap, Profile, Dimension, ResponseInput, RaterInput } from "../src/index.js";
import { fixture, loadCase } from "./helpers.js";
import { illustrativeRatings, fixtureDims } from "./data.js";

const NOW = profileOf([22, 14, 34, 30]);
const PREF = profileOf([31, 25, 28, 16]);
const DIMS = fixtureDims();
const sec = (v: Record<string, number | string>) => Object.fromEntries(Object.entries(v).map(([k, x]) => [k, D(x)])) as SectionMap;
const CLS = { ENGAGE: "BUILD", INNOVATE: "BUILD", PERFORM: "MODERATE", GOVERN: "MODERATE" } as const;

describe("Appendix D", () => {
  it("UT-01 constant-sum rejection: 30/30/30/20 → 422", () => {
    const p = validateAllocation({ ENGAGE: 30, INNOVATE: 30, PERFORM: 30, GOVERN: 20 }, "D2-S1", "NOW");
    expect(p?.code).toBe("CONSTANT_SUM_VIOLATION"); expect(p?.status).toBe(422); expect(p?.received).toBe(110);
  });
  it("UT-02 constant-sum acceptance: 40/30/20/10", () => {
    expect(validateAllocation({ ENGAGE: 40, INNOVATE: 30, PERFORM: 20, GOVERN: 10 }, "D2-S1", "NOW")).toBeNull();
    expect(validateAllocation({ ENGAGE: 40.5, INNOVATE: 29.5, PERFORM: 20, GOVERN: 10 }, "x", "NOW")?.code).toBe("CONSTANT_SUM_VIOLATION");
    expect(validateAllocation({ ENGAGE: -10, INNOVATE: 60, PERFORM: 30, GOVERN: 20 }, "x", "NOW")?.code).toBe("CONSTANT_SUM_VIOLATION");
  });
  it("UT-03 gaps +9, +11, −6, −14 sum to zero", () => {
    const g = gaps(NOW, PREF);
    expect(ORIENTATIONS.map((o) => g[o].toFixed(2))).toEqual(["9.00", "11.00", "-6.00", "-14.00"]);
    expect(ORIENTATIONS.reduce((s, o) => s.plus(g[o]), D(0)).isZero()).toBe(true);
  });
  it.each([["8.00", "BUILD", true], ["7.99", "STRENGTHEN", false], ["4.00", "STRENGTHEN", false], ["3.99", "KEEP_AND_PROTECT", false],
    ["-3.99", "KEEP_AND_PROTECT", false], ["-4.00", "MODERATE", false], ["-8.00", "MODERATE", true]] as const)("UT-04 gap %s → %s", (g, c, s) => {
    expect(classifyGap(g)).toBe(c); expect(significant(g)).toBe(s);
  });
  it("UT-05 culture strength 34.00 → 9.0 MODERATE", () => {
    const [s, b] = cultureStrength(NOW); expect(s.toFixed(1)).toBe("9.0"); expect(b).toBe("MODERATE");
  });
  it("UT-06 congruence 4 of 6, 66.7%, MODERATELY_CONGRUENT, lenses 2 of 3", () => {
    const c = congruence(NOW, DIMS, lensProfiles(DIMS));
    expect(c.dimension_count).toBe(4); expect(c.dimension_pct.toFixed(1)).toBe("66.7"); expect(c.band).toBe("MODERATELY_CONGRUENT");
    expect(c.lens.agreement).toBe(2); expect(c.lens.PRACTICE).toBe("GOVERN"); expect(c.lens.STRATEGY).toBe("PERFORM");
  });
  it("UT-07 shared dominance PERFORM 30.40 / GOVERN 30.00", () => {
    const d = dominance(profileOf([20, "19.6", "30.4", 30]));
    expect(d.shared).toBe(true); expect(d.dominant).toEqual(["PERFORM", "GOVERN"]);
  });
  it("UT-08 eOS category: 30 advocates, 25 neutrals, 45 critics → −15", () => {
    expect(eosCategory([...Array(30).fill(9), ...Array(25).fill(7), ...Array(45).fill(3)])).toBe(-15);
  });
  it("UT-09 eOS index 7.125 → 7.1", () => {
    expect(q(D(18 + 9 - 8 + 6 + 11 - 14 + 21 + 14).div(8), 1).toFixed(1)).toBe("7.1");
    expect(fixture().obj.eos.index!.toFixed(1)).toBe("7.1");
  });
  it("UT-10 TPS 3.085 → 3.09 (decimal half-up; a binary float gives 3.08)", () => {
    const t = tps("3.2", "2.8", "3.1", "3.40");
    expect(t.toFixed()).toBe("3.085"); expect(q(t, 2).toFixed(2)).toBe("3.09");
    expect((3.085).toFixed(2)).toBe("3.08");                              // why floats are banned
    expect(band15(t)).toBe("ENABLEMENT_REQUIRED"); expect(priorityCap(t)).toBe(3);
  });
  it.each([["2.49", "HIGH_RISK"], ["2.50", "ENABLEMENT_REQUIRED"], ["3.49", "ENABLEMENT_REQUIRED"], ["3.50", "TARGETED_SUPPORT"], ["3.99", "TARGETED_SUPPORT"], ["4.00", "STRONG_READINESS"]])(
    "UT-11 TPS %s → %s", (v, b) => expect(band15(v)).toBe(b));
  it("UT-12 weights sum to 1.00; any other vector is a configuration error", () => {
    expect(() => config.assertWeights(config.GLOBAL["scoring.tps.weights"])).not.toThrow();
    expect(() => config.assertWeights([D("0.35"), D("0.30"), D("0.20"), D("0.20")])).toThrow(/CONFIGURATION_ERROR/);
  });
  it("UT-13 leadership alignment blend: 1.365 + 1.972 = 3.337 → 3.34", () => {
    const laI = laInstrument(18, "ENGAGE"); expect(laI.toFixed(2)).toBe("3.40");
    expect(q(leadershipAlignment("0.42", "3.25", laI), 2).toFixed(2)).toBe("3.34");
  });
  it("UT-14 C1 INNOVATE > 28 at 14 (lowest) → 50.0% MISS via OVERRIDE_2", () => {
    const r = alignmentVerdict(c1Requirements([{ ref: "B3.1", goal_type: "INNOVATION_NEW_MODELS" }])[0], NOW);
    expect(r.verdict).toBe("MISS"); expect(r.alignment_pct.toFixed(1)).toBe("50.0"); expect(r.overrides).toContain("OVERRIDE_2_LOWEST");
  });
  it("UT-15 C4 SERVICE_B2C on 22 / 34 → 86.7% PARTIAL_HIT via OVERRIDE_1", () => {
    const r = alignmentVerdict(c4Requirement("SERVICE_B2C"), NOW);
    expect(r.verdict).toBe("PARTIAL_HIT"); expect(r.alignment_pct.toFixed(1)).toBe("86.7"); expect(r.overrides).toEqual(["OVERRIDE_1_BELOW_THRESHOLD"]);
  });
  it("UT-16 C1 capping: PERFORM 45 → sub 100.0, HIT", () => {
    const r = alignmentVerdict(c1Requirements([{ ref: "x", goal_type: "RESULTS_GROWTH" }])[0], profileOf([20, 15, 45, 20]));
    expect(r.alignment_pct.toFixed(1)).toBe("100.0"); expect(r.verdict).toBe("HIT");
  });
  it("UT-17 C4 transition: 87.5% PARTIAL_HIT, OVERRIDE_2 never applied to BALANCED", () => {
    const r = alignmentVerdict(c4Requirement("SERVICE_B2C", "PLATFORM_DIGITAL"), NOW);
    expect(Object.values(r.subs).map((v) => v.toFixed(1))).toEqual(["91.7", "58.3", "100.0", "100.0"]);
    expect(r.alignment_pct.toFixed(1)).toBe("87.5"); expect(r.verdict).toBe("PARTIAL_HIT"); expect(r.overrides).not.toContain("OVERRIDE_2_LOWEST");
  });
  it("UT-18 C2: rank 3, 14.0, SUBSTANTIVE → MISS", () => {
    const r = behaviourGap(DIMS, "ENGAGE");
    expect([r.verdict, r.rank, r.behaviour_gap_points.toFixed(1), r.intensity]).toEqual(["MISS", 3, "14.0", "SUBSTANTIVE"]);
  });
  it("UT-19 C3 systemic: D4 and D6 dominant PERFORM (MODERATE)", () => {
    const g = gaps(NOW, PREF); const cls = Object.fromEntries(ORIENTATIONS.map((o) => [o, classifyGap(g[o])])) as Record<string, never>;
    const r = stopStart(DIMS, cls);
    expect(r.verdict).toBe("SYSTEMIC_MISS"); expect(r.identity_risk).toBe(true); expect(r.offending).toEqual(["PERFORM"]);
  });
  it.each([["5.0", "NONE"], ["5.1", "WATCH"], ["7.0", "WATCH"], ["7.1", "SHADOW_CULTURE"]])("UT-20 perception %s → %s", (g, f) => expect(perceptionFlag(g)).toBe(f));
  it("UT-21 perception floor: executive n = 4 → not computed, reason stated, no flag", () => {
    const c = loadCase("fixture");
    let k = 0;
    const responses = (c.input.responses as ResponseInput[]).map((r) => ({ ...r, snapshot: { ...r.snapshot, is_executive: r.snapshot.is_executive ? k++ < 4 : false } }));
    const s = scoreAssessment(responses, deriveSetup(c.input.setup));
    expect(s.obj.perception_gap).toBeNull(); expect(s.obj.perception_flags).toBeNull();
    expect(s.obj.perception_not_computed_reason).toBe("EXECUTIVE_COHORT_BELOW_FLOOR");
    expect(evaluate(s.obj, deriveSetup(c.input.setup)).findings.some((f) => f.type === "PERCEPTION_GAP")).toBe(false);
  });
  it("UT-22 priority cap at TPS 2.40: INNOVATE, ENGAGE selected; GOVERN deferred; P0 outside the cap", () => {
    const f = fixture();
    const obj = { ...f.obj, readiness: { ...f.obj.readiness, tps: D("2.40") } };
    const plan = buildPlan(obj, f.ev, f.setup, "2026-11-02");
    expect(plan.priorities.map((p) => p.orientation)).toEqual(["INNOVATE", "ENGAGE"]);
    expect(plan.backlog).toHaveLength(1); expect(plan.backlog[0].orientation).toBe("GOVERN"); expect(plan.backlog[0].reason).toBe("readiness cap");
    expect(plan.priority_zero!.items).toHaveLength(3);
  });
  it("UT-23 removing a BUILD's trade-off → 422 PLAN_INCOHERENT", () => {
    const p = fixture().plan.priorities[0];
    expect(() => validatePriorityEdit({ ...p, trade_off_orientation: null }, fixture().obj.orientation_scores.gap)).toThrowError(/PLAN_INCOHERENT/);
    expect(() => validatePriorityEdit({ ...p, trade_off_orientation: "ENGAGE" }, fixture().obj.orientation_scores.gap)).toThrowError(/negative gap/);
    try { validatePriorityEdit({ ...p, trade_off_orientation: null }, fixture().obj.orientation_scores.gap); } catch (e) { expect((e as WorkflowError).status).toBe(422); }
  });
  it("UT-24 diagonal stepping stone: PERFORM → ENGAGE via GOVERN (30 > 14)", () => {
    const eng = fixture().plan.priorities.find((p) => p.orientation === "ENGAGE")!;
    expect(eng.pathway!.relationship).toBe("DIAGONAL"); expect(eng.pathway!.difficulty).toBe("HIGH"); expect(eng.pathway!.stepping_stone).toBe("GOVERN");
  });
  it("UT-25 adjacent pathway: PERFORM → INNOVATE outward, no stepping stone", () => {
    const inn = fixture().plan.priorities.find((p) => p.orientation === "INNOVATE")!;
    expect(inn.pathway!.relationship).toBe("ADJACENT_OUTWARD"); expect(inn.pathway!.stepping_stone).toBeNull();
    expect(inn.pathway!.narrative).toContain("Tomorrow’s targets depend on today’s experiments.");
  });
  it("UT-26 publish over an open SHADOW gate → 409 BLOCKING_GATE_OPEN naming the pre-condition", () => {
    const eng = fixture().plan.priorities.find((p) => p.orientation === "ENGAGE")!;
    const shadow = fixture().ev.findings.find((f) => f.type === "PERCEPTION_GAP" && f.orientation![0] === "ENGAGE")!;
    expect(eng.blocked_by).toContain(shadow.finding_id);
    try { transition({ status: "APPROVED" }, "PUBLISHED", "PAC_CONSULTANT", { openGates: eng.blocked_by }); throw new Error("no throw"); }
    catch (e) { expect((e as WorkflowError).code).toBe("BLOCKING_GATE_OPEN"); expect((e as WorkflowError).status).toBe(409); expect((e as WorkflowError).extra.gates).toContain(shadow.finding_id); }
  });
  it("UT-27 primary floor: n = 4 → suppressed", () => {
    expect(() => checkFloor(4)).toThrow(Suppressed);
    expect(() => checkFloor(5)).not.toThrow();
  });
  it("UT-28 combination floor: department n = 30, department × female n = 3 → combination suppressed, department returned", () => {
    const mk = (i: number, g: string) => ({ id: `r${i}`, snapshot: { department: "dep_11", gender: g }, alloc: {} }) as ResponseInput;
    const rs = [...Array(27)].map((_, i) => mk(i, "M")).concat([...Array(3)].map((_, i) => mk(100 + i, "F")));
    expect(resolveSegment(rs, { department: "dep_11" })).toHaveLength(30);
    try { resolveSegment(rs, { department: "dep_11", gender: "F" }); throw new Error("no throw"); }
    catch (e) { expect((e as Suppressed).rule).toBe("COMBINATION_FLOOR"); expect((e as Suppressed).rollup?.segment).toEqual({ department: "dep_11" }); }
  });
  it("UT-29 differencing: department 22, team A 18, team B 4 → both teams suppressed", () => {
    expect([...differencingSuppressed(22, { team_a: 18, team_b: 4 })].sort()).toEqual(["team_a", "team_b"]);
    expect([...differencingSuppressed(30, { a: 10, b: 10, c: 10 })]).toEqual([]);
  });
  it("UT-30 360 group floor: peers n = 2 merge into ALL_OTHERS", () => {
    const { self, other } = illustrativeRatings();
    const raters: RaterInput[] = ([...Array(2)].map(() => ({ group: "PEER", ratings: other })) as RaterInput[]).concat([...Array(3)].map(() => ({ group: "DIRECT_REPORT" as const, ratings: other })), [{ group: "SUPERIOR" as const, ratings: other }]);
    const r = scoreLeader(self, raters, "ENGAGE");
    expect(r.groups_published).toContain("ALL_OTHERS"); expect(r.groups_published).not.toContain("PEER"); expect(r.groups_published).not.toContain("SUPERIOR");
  });
  it("UT-31 LRI 1.26 + 0.96 + 0.58 + 0.51 = 3.31 → ENABLEMENT_REQUIRED", () => {
    const o = sec({ A: "2.9", B: 3, C: 3, D: 3, E: 4, F: "3.2", G: "3.4", H: "3.6" });
    const r = computeLeaderReadings(o, o, "ENGAGE");
    expect(q(r.lri, 2).toFixed(2)).toBe("3.31"); expect(r.lri_band).toBe("ENABLEMENT_REQUIRED");
  });
  it.each([["0.50", "ALIGNED"], ["0.51", "WATCH"], ["1.00", "WATCH"], ["1.01", "BLIND_SPOT"]])("UT-32 self–other gap %s → %s", (g, t) => {
    const base = sec({ A: 3, B: 3, C: 3, D: 3, E: 3, F: 3, G: 3, H: 3 });
    expect(computeLeaderReadings({ ...base, A: D(3).plus(g) }, base, "ENGAGE").self_other.A!.tier).toBe(t);
  });
  it("UT-33 integrity flag at E 3.95", () => {
    const o = sec({ A: 4, B: 4, C: 4, D: 4, E: "3.95", F: 4, G: 4, H: 4 });
    expect(computeLeaderReadings(o, o, "ENGAGE").flags).toContain("INTEGRITY");
  });
  it("UT-34 fit index: leader 40/20/25/15 vs team 22/14/34/30 → 76.0 ALIGNED", () => {
    const f = fitIndex(profileOf([40, 20, 25, 15]), NOW); expect(f.toFixed(1)).toBe("76.0"); expect(fitBand(f)).toBe("ALIGNED");
  });
  it("UT-35 CULTURE_BLOCKER: leader 15 vs org 22, default PERFORM (MODERATE), LRI 3.0", () => {
    expect(carrierClass(15, 22, [], "3.0", ["PERFORM"], CLS)).toBe("CULTURE_BLOCKER");
  });
  it("UT-36 determinism: score 100 times → one hash (AC-3.2)", () => {
    const c = loadCase("fixture"); const setup = deriveSetup(c.input.setup);
    const hashes = new Set<string>();
    for (let i = 0; i < 100; i++) hashes.add(scoreAssessment(c.input.responses, setup, [], c.input.scope).hash);
    expect(hashes.size).toBe(1); expect([...hashes][0]).toBe(c.expected.hash);
  });
  it("UT-37 version pinning: payload carries instrument 1.1 / rules 2.0 and the frozen hash", () => {
    const f = fixture();
    expect(f.payload.rules_version).toBe(RULES_VERSION); expect(f.payload.instrument_version).toBe("1.1");
    expect(f.hash).toBe(loadCase("fixture").expected.hash);
  });
  it("UT-38 AI numeric integrity: a number absent from the payload blocks the draft", () => {
    const allowed = payloadNumbers(fixture().payload);
    const ok = screenSection({ text: "The Transformation Probability Score is 3.09. [fnd_0009]", cites: ["fnd_0009"] }, { allowedNumbers: allowed, findingIds: new Set(["fnd_0009"]), denyList: [] });
    expect(ok.ok).toBe(true);
    const bad = screenSection({ text: "The Transformation Probability Score is 3.41. [fnd_0009]", cites: ["fnd_0009"] }, { allowedNumbers: allowed, findingIds: new Set(["fnd_0009"]), denyList: [] });
    expect(bad.ok).toBe(false); expect(bad.blocked[0]).toMatch(/NUMERIC_INTEGRITY: 3.41/);
  });
  it("UT-39 AI terminology: a deny-listed term blocks the draft", () => {
    const r = screenSection({ text: "This looks like a classic Widgetometer quadrant. [fnd_0001]", cites: ["fnd_0001"] }, { allowedNumbers: new Set(), findingIds: new Set(["fnd_0001"]), denyList: ["widgetometer"] });
    expect(r.ok).toBe(false); expect(r.blocked).toContain("TERMINOLOGY: deny-listed term");
  });
  it("UT-40 release gate: empty “What this means” → 422", () => {
    const p = checkRelease({ sections: { what_this_means: "", what_to_do_next: "Do x." }, accepted: { what_to_do_next: {} }, aiSections: [], scorePayloadHash: "h", reportPayloadHash: "h", technicalAppendixPresent: true });
    expect(p?.code).toBe("RELEASE_INCOMPLETE"); expect(p?.status).toBe(422); expect(p?.missing).toEqual(["what_this_means"]);
  });
  it("UT-41 closure without evidence → 409 naming the evidence type", () => {
    try { transition({ status: "UNDER_REVIEW" }, "CLOSED", "EXECUTIVE", { evidenceCount: 0 }); throw new Error("no throw"); }
    catch (e) { expect((e as WorkflowError).code).toBe("EVIDENCE_REQUIRED"); expect((e as WorkflowError).status).toBe(409); expect((e as WorkflowError).extra.evidence_type).toBeTruthy(); }
  });
  it("UT-42 pulse: 12 items, 2 off the watch-list → refused on both counts", () => {
    const watch = [...Array(10)].map((_, i) => `i${i}`);
    const errs = validatePulse([...watch, "x1", "x2"], watch);
    expect(errs).toHaveLength(2); expect(errs[1]).toContain("x1");
  });
  it("UT-43 comparability: 1.x vs 2.x MAJOR (409); 1.0 vs 1.1 equivalent", () => {
    expect(comparability("1.1", "2.0")).toBe("MAJOR"); expect(comparability("1.0", "1.1")).toBe("SAME"); expect(comparability("2.0", "2.1")).toBe("MINOR");
  });
  it("UT-44 retention: destruction 24 months after close, notices at 90 and 30 days", () => {
    expect(retentionSchedule("2026-10-19")).toEqual({ destroy_on: "2028-10-19", notice_90: "2028-07-21", notice_30: "2028-09-19" });
    expect(retentionSchedule("2026-02-29".replace("29", "28")).destroy_on).toBe("2028-02-28");
  });
  it("UT-45 zero coverage: LA 3.40, TPS 3.09, PROVISIONAL, instrument term only", () => {
    const rd = fixture().obj.readiness;
    expect(rd.coverage.isZero()).toBe(true); expect(rd.leadership_alignment.toFixed(2)).toBe("3.40"); expect(rd.tps!.toFixed(2)).toBe("3.09");
    expect(rd.provisional).toBe(true); expect(rd.leadership_alignment_source).toBe("INSTRUMENT_TERM_ONLY");
  });
  it("UT-46 full coverage: LA = LRI_weighted 3.60", () => expect(leadershipAlignment(1, "3.60", D("2.10")).toFixed(2)).toBe("3.60"));
  it("UT-47 continuity at the 60% label: difference < 0.01", () => {
    const a = leadershipAlignment("0.599", "3.6", D("2.1")), b = leadershipAlignment("0.601", "3.6", D("2.1"));
    expect(a.minus(b).abs().lt("0.01")).toBe(true);
  });
  it.each([["4.9", "MARGINAL"], ["5.0", "SUBSTANTIVE"], ["14.9", "SUBSTANTIVE"], ["15.0", "ENTRENCHED"]])("UT-48 C2 intensity %s → %s, verdict unchanged", (g, i) => {
    const p = profileOf([10, D(10).plus(g), 40, D(40).minus(g)]);
    const r = behaviourGap({ D2: p, D3: p } as Record<Dimension, Profile>, "GOVERN");
    expect(r.intensity).toBe(i);
  });
  it("UT-49 C2 shared dominance: rank 2 gap 0.8 → HIT; gap 1.0 → PARTIAL_HIT", () => {
    const a = profileOf(["30.8", 20, "31.6", "17.6"]), b = profileOf(["30.6", 20, "31.6", "17.8"]);
    expect(behaviourGap({ D2: a, D3: a } as Record<Dimension, Profile>, "ENGAGE").verdict).toBe("HIT");
    expect(behaviourGap({ D2: b, D3: b } as Record<Dimension, Profile>, "ENGAGE").verdict).toBe("PARTIAL_HIT");
  });
  it("UT-50 requirement margins: 30/+5, 28/+3, 26/+1 JOINT, paired at single thresholds, 24/−1 BALANCED", () => {
    const req = (g: string) => c1Requirements([{ ref: "x", goal_type: g }])[0];
    expect(req("RESULTS_GROWTH").thresholds.PERFORM!.toNumber()).toBe(30);
    expect(req("INNOVATION_NEW_MODELS").thresholds.INNOVATE!.toNumber()).toBe(28);
    expect(req("PEOPLE_TALENT").thresholds.ENGAGE!.toNumber()).toBe(30);
    expect(req("COMPLIANCE_PROCESS").thresholds.GOVERN!.toNumber()).toBe(28);
    const t = req("TRANSFORMATION"); expect(t.type).toBe("JOINT"); expect([t.thresholds.ENGAGE!.toNumber(), t.thresholds.INNOVATE!.toNumber()]).toEqual([26, 26]);
    const pb = c4Requirement("PRODUCT_B2B"); expect([pb.thresholds.PERFORM!.toNumber(), pb.thresholds.INNOVATE!.toNumber()]).toEqual([30, 28]);
    const rg = c4Requirement("REGULATED"); expect([rg.thresholds.GOVERN!.toNumber(), rg.thresholds.PERFORM!.toNumber()]).toEqual([28, 30]);
    const bal = c4Requirement("REGULATED", "PLATFORM_DIGITAL"); expect(bal.type).toBe("BALANCED"); expect(ORIENTATIONS.every((o) => bal.thresholds[o]!.eq(24))).toBe(true);
    expect(c1Requirements([{ ref: "B3.1", goal_type: "RESULTS_GROWTH" }, { ref: "B3.2", goal_type: "RESULTS_GROWTH" }])[0].source_refs).toEqual(["B3.1", "B3.2"]);
  });
  it("UT-51 C3 partial: D4 dominant ENGAGE (BUILD), D6 PERFORM (MODERATE)", () => {
    const r = stopStart({ ...DIMS, D4: profileOf([40, 10, 30, 20]) }, CLS);
    expect(r.verdict).toBe("PARTIAL_HIT"); expect(r.identity_risk).toBe(false);
  });
  it("UT-52 Override 3: PLATFORM_DIGITAL, INNOVATE 30 but PERFORM 34 highest → 100.0%, capped PARTIAL_HIT", () => {
    const r = alignmentVerdict(c4Requirement("PLATFORM_DIGITAL"), profileOf([20, 30, 34, 16]));
    expect(r.alignment_pct.toFixed(1)).toBe("100.0"); expect(r.verdict).toBe("PARTIAL_HIT"); expect(r.overrides).toEqual(["OVERRIDE_3_NOT_DOMINANT"]);
  });
  it("UT-53 LAGGING: leader 15 vs org 22, default INNOVATE (BUILD), LRI 3.2", () => expect(carrierClass(15, 22, [], "3.2", ["INNOVATE"], CLS)).toBe("LAGGING"));
  it("UT-54 D7–D9 banding on the 1 dp value: 3.04 → band 2; 3.05 → band 3; 2.96 → band 2", () => {
    expect([readinessBandIndex("3.04"), readinessBandIndex("3.05"), readinessBandIndex("2.96")]).toEqual([1, 2, 1]);
    expect(q("3.04", 1).lte(config.get("gates.readiness_le"))).toBe(true); expect(q("2.96", 1).lte(config.get("gates.readiness_le"))).toBe(true);
  });
  it("UT-55 360 observed minimum: 5 of 10 observed in A → excluded from A only", () => {
    const rat = [...Array(5).fill(null), ...Array(55).fill(3)];
    expect(sectionAvg(rat, "A")).toBeNull(); expect(sectionAvg(rat, "B")!.toNumber()).toBe(3);
  });
  it("UT-56 quality exclusion: SPEEDING + UNIFORM → INSUFFICIENT; UNIFORM + DUPLICATION alone retained", () => {
    const base = loadCase("fixture").input.responses[0] as ResponseInput;
    const uni = Object.fromEntries(["D1", "D2", "D3", "D4", "D5", "D6"].map((d) => [d, [0, 1, 2].map(() => ({ ENGAGE: 25, INNOVATE: 25, PERFORM: 25, GOVERN: 25 }))]));
    const [st, fl] = classifyResponse({ ...base, duration: 100, alloc: { NOW: uni, PREFERRED: base.alloc.PREFERRED } }, 2500);
    expect(st).toBe("INSUFFICIENT"); expect(fl).toEqual(expect.arrayContaining(["SPEEDING", "UNIFORM_ALLOCATION"]));
    const [st2, fl2] = classifyResponse({ ...base, duration: 2500, alloc: { NOW: uni, PREFERRED: JSON.parse(JSON.stringify(uni)) } }, 2500);
    expect(st2).toBe("COMPLETE"); expect(fl2).toEqual(["UNIFORM_ALLOCATION", "PERSPECTIVE_DUPLICATION"]);
  });
  it("rules 2.1 (V-02, V-05): any two flags exclude; speeding below 40% of median; 3 observed items per section", () => {
    const base = loadCase("fixture").input.responses[0] as ResponseInput;
    const uni = Object.fromEntries(["D1", "D2", "D3", "D4", "D5", "D6"].map((d) => [d, [0, 1, 2].map(() => ({ ENGAGE: 25, INNOVATE: 25, PERFORM: 25, GOVERN: 25 }))]));
    const twoFlags = { ...base, duration: 2500, alloc: { NOW: uni, PREFERRED: JSON.parse(JSON.stringify(uni)) } };
    withRules("2.1", () => {
      expect(classifyResponse(twoFlags, 2500)[0]).toBe("INSUFFICIENT");
      expect(classifyResponse({ ...base, duration: 1900 }, 5000)[1]).toContain("SPEEDING");    // 1900 < 0.40 × 5000
      expect(sectionAvg([...Array(7).fill(null), ...Array(53).fill(3)], "A")!.toNumber()).toBe(3);   // 3 of 10 observed
      expect(sectionAvg([...Array(8).fill(null), ...Array(52).fill(3)], "A")).toBeNull();
      expect(rulesVersion()).toBe("2.1");
    });
    expect(classifyResponse({ ...base, duration: 1900 }, 5000)[1]).not.toContain("SPEEDING");   // 2.0: 1/3 of median
    expect(rulesVersion()).toBe("2.0");
  });
  it("UT-57 C1 multiple requirements: RESULTS_GROWTH and INNOVATION → two findings, headline MISS", () => {
    const f = fixture();
    const s2 = { ...f.setup, c1_requirements: c1Requirements([{ ref: "B3.1", goal_type: "RESULTS_GROWTH" }, { ref: "B3.2", goal_type: "INNOVATION_NEW_MODELS" }]) };
    const ev = evaluate(f.obj, s2);
    expect(ev.c1).toHaveLength(2); expect(ev.c1[0].verdict).toBe("HIT"); expect(ev.checks.C1).toBe("MISS");
  });
  it("UT-58 urgency tiers: INNOVATE STRATEGIC_MISS; ENGAGE BEHAVIOUR_GAP; GOVERN PROCESS_CONTRADICTION", () => {
    const f = fixture();
    expect((["INNOVATE", "ENGAGE", "GOVERN"] as const).map((o) => urgencyTier(o, f.ev, "ENGAGE", f.obj.classification))).toEqual(["STRATEGIC_MISS", "BEHAVIOUR_GAP", "PROCESS_CONTRADICTION"]);
  });
  it("UT-59 plan skeleton: P0 with 3 items; INNOVATE, ENGAGE, GOVERN; trade-offs GOVERN, PERFORM; C3 levers on ENGAGE (AC-5.1)", () => {
    const plan = fixture().plan;
    expect(plan.priority_zero!.items.map((i) => i.gate)).toEqual(["SHADOW_CULTURE", "EOS_NEGATIVE", "D8_LE_3"]);
    expect(plan.priorities.map((p) => [p.orientation, p.trade_off_orientation])).toEqual([["INNOVATE", "GOVERN"], ["ENGAGE", "PERFORM"], ["GOVERN", null]]);
    expect(plan.priorities.find((p) => p.orientation === "ENGAGE")!.c3_levers).toBe(true);
    expect(plan.backlog).toEqual([]); expect(plan.cap).toBe(3);
  });
  it("UT-60 illustrative leader: LRI 2.92, safety flag, F BLIND_SPOT, fit 91.44, NEUTRAL", () => {
    const other = sec({ A: "2.6", B: "3.0", C: "4.2", D: "3.5", E: "4.3", F: "2.8", G: "3.4", H: "3.0" });
    const self = sec({ A: "3.4", B: "3.1", C: "4.4", D: "3.8", E: "4.6", F: "4.0", G: "3.6", H: "3.5" });
    const r = computeLeaderReadings(self, other, "ENGAGE");
    expect(q(r.lri, 2).toFixed(2)).toBe("2.92"); expect(r.lri_band).toBe("ENABLEMENT_REQUIRED"); expect(r.flags).toEqual(["SAFETY"]);
    expect(r.self_other.F!.tier).toBe("BLIND_SPOT"); expect(r.self_other.A!.tier).toBe("WATCH"); expect(r.default).toEqual(["PERFORM"]); expect(r.growth).toBe("ENGAGE");
    const lp = leaderProfile(other);
    expect(ORIENTATIONS.map((o) => q(lp[o], 2).toFixed(2))).toEqual(["19.55", "22.56", "31.58", "26.32"]);
    expect(fitIndex(lp, NOW).toFixed(2)).toBe("91.44"); expect(fitBand(fitIndex(lp, NOW))).toBe("MIRRORED");
    expect(carrierClass(lp.ENGAGE, 22, r.flags, r.lri, r.default, CLS)).toBe("NEUTRAL");
  });
  it("UT-61 trade-off verification: INNOVATE INTENDED (0.67); ENGAGE MIXED (0.33)", () => {
    const { verification } = tradeOffVerification(NOW, profileOf([26, 19, 31, 24]), [
      { priority_id: "pri_01", orientation: "INNOVATE", classification: "BUILD", trade_off_orientation: "GOVERN" },
      { priority_id: "pri_02", orientation: "ENGAGE", classification: "BUILD", trade_off_orientation: "PERFORM" }], {});
    expect(verification.map((v) => [v.verdict, v.share_trade_off!.toFixed(2)])).toEqual([["INTENDED_RELEASE", "0.67"], ["MIXED_RELEASE", "0.33"]]);
  });
  it("UT-62 action score: impact 5 × urgency 5 ÷ effort 3 = 8.33", () => {
    expect(priorityScore(5, 5, 3).toFixed(2)).toBe("8.33");
    expect(fixture().plan.priorities[0].actions.find((a) => a.effort === 3)!.priority_score.toFixed(2)).toBe("8.33");
  });
});

describe("Fixture headline values (§3.7, §4.9, Appendix F)", () => {
  it("score object", () => {
    const o = fixture().obj;
    expect(ORIENTATIONS.map((x) => o.orientation_scores.now[x].toFixed(2))).toEqual(["22.00", "14.00", "34.00", "30.00"]);
    expect(ORIENTATIONS.map((x) => o.orientation_scores.preferred[x].toFixed(2))).toEqual(["31.00", "25.00", "28.00", "16.00"]);
    expect(o.classification).toEqual({ ENGAGE: "BUILD", INNOVATE: "BUILD", PERFORM: "MODERATE", GOVERN: "MODERATE" });
    expect(o.significant).toEqual({ ENGAGE: true, INNOVATE: true, PERFORM: false, GOVERN: true });
    // §3.5.12 worked example on the spec's cohort profiles. NOTE: spec Table 9's cohort rows do not reconcile with its
    // organisation row ((11×30 + 430×19) ÷ 441 ≠ 22), so the demo dataset (which reproduces the organisation row exactly)
    // yields executive–staff gaps of 8.2 / 2.0 / 2.0 / 8.2. Both give SHADOW_CULTURE on ENGAGE and GOVERN only.
    expect(ORIENTATIONS.map((x) => perceptionGap(profileOf([30, 16, 32, 22]), profileOf([19, 13, 35, 33]))[x].toFixed(1))).toEqual(["11.0", "3.0", "3.0", "11.0"]);
    expect(ORIENTATIONS.map((x) => o.perception_gap![x].toFixed(1))).toEqual(["8.2", "2.0", "2.0", "8.2"]);
    expect(o.perception_flags).toEqual({ ENGAGE: "SHADOW_CULTURE", INNOVATE: "NONE", PERFORM: "NONE", GOVERN: "SHADOW_CULTURE" });
    expect(["d7", "d8", "d9"].map((k) => q((o.readiness as unknown as Record<string, string>)[k], 1).toFixed(1))).toEqual(["3.2", "2.8", "3.1"]);
    expect(Object.values(o.eos).slice(0, 8)).toEqual([18, 9, -8, 6, 11, -14, 21, 14]);
    expect((o.quality as { states: Record<string, number> }).states).toEqual({ COMPLETE: 441, PARTIAL_CULTURE: 22, INSUFFICIENT: 12 });
  });
  it("checks and scenarios", () => {
    const ev = fixture().ev;
    expect(ev.checks).toEqual({ C1: "MISS", C2: "MISS", C3: "SYSTEMIC_MISS", C4: "PARTIAL_HIT" });
    expect(ev.c2.escalated_with).toBe("SHADOW_CULTURE");
    expect(ev.scenarios.map((s) => s.scenario_id)).toEqual(["SC-05", "SC-01", "SC-10"]);
    expect(ev.blocking.map((f) => f.type)).toEqual(["PERCEPTION_GAP", "PERCEPTION_GAP", "ENGAGEMENT_MISS", "ENGAGEMENT_MISS", "READINESS_SIGNAL"]);
  });
  it("leadership target from F1 tags; tie requires a consultant tie-break (AC-1.4)", () => {
    expect(leadershipTarget(["ENGAGE", "ENGAGE", "ENGAGE", "PERFORM", "ENGAGE"])).toBe("ENGAGE");
    expect(() => leadershipTarget(["ENGAGE", "ENGAGE", "PERFORM", "PERFORM", "GOVERN"])).toThrow(/SETUP_TIE_UNRESOLVED/);
    expect(leadershipTarget(["ENGAGE", "ENGAGE", "PERFORM", "PERFORM", "GOVERN"], "PERFORM")).toBe("PERFORM");
  });
});
