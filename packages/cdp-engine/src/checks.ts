/**
 * Stage 4 rules engine (spec §4.5): requirements, C1–C4 with overrides, signals, severity, scenario library.
 * Mirrors oracle/cdp_oracle/checks.py. Evaluation order is fixed (§4.1).
 */
import { D, Decimal, q, mean, ORIENTATIONS, Orientation, Profile, Dimension } from "./num.js";
import * as cfg from "./config.js";
import { ranked, dominance, lowest, GapClass, ScoreObject } from "./scoring.js";
import type { Requirement, EngineSetup, SetupInput } from "./types.js";

export type Verdict = "HIT" | "PARTIAL_HIT" | "MISS" | "SYSTEMIC_MISS";
const ORDER: Record<string, number> = { MISS: 0, SYSTEMIC_MISS: 0, PARTIAL_HIT: 1, HIT: 2 };
const worse = (a: Verdict, b: Verdict): Verdict => (ORDER[a] <= ORDER[b] ? a : b);

// ---------------------------------------------------------------- requirements (§1.5)

export function c1Requirements(priorities: { ref: string; goal_type: string }[]): Requirement[] {
  const reqs = new Map<string, Requirement>();
  for (const p of priorities) {
    const spec = cfg.GOAL_TYPES[p.goal_type];
    if (!spec) throw new Error(`VALIDATION_FAILED: unknown goal_type ${p.goal_type}`);
    const [typ, ors, th] = spec;
    if (!reqs.has(p.goal_type)) reqs.set(p.goal_type, { requirement_id: `req_${String(reqs.size + 1).padStart(2, "0")}`, goal_type: p.goal_type,
      type: typ, orientations: [...ors], thresholds: { ...th }, source_refs: [] });
    reqs.get(p.goal_type)!.source_refs!.push(p.ref);
  }
  return [...reqs.values()];
}

export function c4Requirement(model: string, planned: string | null = null, transition = false): Requirement {
  if (transition || (planned && planned !== model)) {
    return { type: "BALANCED", orientations: [...ORIENTATIONS], thresholds: Object.fromEntries(ORIENTATIONS.map((o) => [o, cfg.BALANCED_THRESHOLD])),
      model, model_transition: true };
  }
  const spec = cfg.BUSINESS_MODELS[model];
  if (!spec) throw new Error(`VALIDATION_FAILED: unknown business model ${model}`);
  const [typ, ors] = spec;
  return { type: typ, orientations: [...ors], thresholds: Object.fromEntries(ors.map((o) => [o, cfg.SINGLE_THRESHOLD[o]])), model, model_transition: false };
}

/** Most frequent F1 tag; a tie must carry a consultant tie-break (§1.5.3, AC-1.4). */
export function leadershipTarget(tags: Orientation[], tieBreak: Orientation | null = null): Orientation {
  const counts = Object.fromEntries(ORIENTATIONS.map((o) => [o, tags.filter((t) => t === o).length])) as Record<Orientation, number>;
  const top = Math.max(...Object.values(counts));
  const winners = ORIENTATIONS.filter((o) => counts[o] === top);
  if (winners.length > 1) {
    if (!tieBreak || !winners.includes(tieBreak)) throw new Error("SETUP_TIE_UNRESOLVED: a tie in Section F tags must be resolved by the consultant");
    return tieBreak;
  }
  return winners[0];
}

/** Derive the engine setup from agreed Sections B and F (§1.5, output §1.7). */
export function deriveSetup(s: SetupInput): EngineSetup {
  return {
    leadership_target_orientation: leadershipTarget(s.f1_tags, s.tie_break ?? null),
    c1_requirements: c1Requirements(s.priorities),
    c4_requirement: c4Requirement(s.business_model, s.planned_model ?? null),
    kpi_for: s.kpi_for ?? {},
  };
}

// ---------------------------------------------------------------- C1 / C4 (§4.5.1)

export function alignmentVerdict(req: Requirement, now: Profile) {
  const R = req.orientations, T = req.thresholds;
  const subs = new Map<Orientation, Decimal>();
  for (const r of R) { const v = D(100).times(now[r]).div(T[r]!); subs.set(r, v.lt(100) ? v : D(100)); }
  const pct = q(mean(subs.values())!, 1);
  const [hit, partial] = cfg.get("checks.alignment_bands");
  let verdict: Verdict = pct.gte(hit) ? "HIT" : pct.gte(partial) ? "PARTIAL_HIT" : "MISS";
  const overrides: string[] = [];
  if (R.some((r) => now[r].lte(T[r]!))) {
    const nv = worse(verdict, "PARTIAL_HIT");
    if (nv !== verdict) overrides.push("OVERRIDE_1_BELOW_THRESHOLD");
    verdict = nv;
  }
  if (req.type !== "BALANCED" && R.some((r) => lowest(now).includes(r))) {
    overrides.push("OVERRIDE_2_LOWEST");
    verdict = "MISS";
  }
  if (req.type === "DOMINANT" && !dominance(now).dominant.includes(R[0])) {
    const nv = worse(verdict, "PARTIAL_HIT");
    if (nv !== verdict) overrides.push("OVERRIDE_3_NOT_DOMINANT");
    verdict = nv;
  }
  return { verdict, alignment_pct: pct, subs: Object.fromEntries([...subs].map(([k, v]) => [k, q(v, 1)])), overrides };
}

// ---------------------------------------------------------------- C2 (§4.5.2)

export function behaviourGap(dimNow: Partial<Record<Dimension, Profile>>, target: Orientation) {
  const prof = Object.fromEntries(ORIENTATIONS.map((o) => [o, q(mean([dimNow.D2![o], dimNow.D3![o]])!, 2)])) as Profile;
  const order = ranked(prof);
  const rank = 1 + ORIENTATIONS.filter((o) => prof[o].gt(prof[target])).length;
  const gap = q(prof[order[0]].minus(prof[target]), 2);
  const sharedLt = cfg.get("scoring.dominance.shared_lt");
  const v: Verdict = rank === 1 ? "HIT" : rank === 2 && gap.lt(sharedLt) ? "HIT" : rank === 2 ? "PARTIAL_HIT" : "MISS";
  const [lo, hi] = cfg.get("checks.c2_intensity");
  const intensity = gap.lt(lo) ? "MARGINAL" : gap.lt(hi) ? "SUBSTANTIVE" : "ENTRENCHED";
  return { verdict: v, rank, behaviour_gap_points: gap, intensity, profile: prof, shared_dominance: rank === 2 && gap.lt(sharedLt) };
}

// ---------------------------------------------------------------- C3 (§4.5.3)

export function stopStart(dimNow: Partial<Record<Dimension, Profile>>, classes: Record<Orientation, GapClass>) {
  const isMod = (d: Dimension) => dominance(dimNow[d]!).dominant.some((o) => classes[o] === "MODERATE");
  const m = (["D4", "D6"] as const).filter(isMod).length;
  const verdict = (["HIT", "PARTIAL_HIT", "SYSTEMIC_MISS"] as const)[m];
  const offending: Orientation[] = [];
  for (const d of ["D4", "D6"] as const) for (const o of dominance(dimNow[d]!).dominant) if (classes[o] === "MODERATE" && !offending.includes(o)) offending.push(o);
  return { verdict: verdict as Verdict, moderate_count: m, identity_risk: isMod("D4"), offending };
}

// ---------------------------------------------------------------- severity (§4.5.6)

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export function severityFor(kind: string, verdict: string, extra: Record<string, unknown> = {}): Severity {
  if ((kind === "C1" || kind === "C4") && verdict === "MISS") return "CRITICAL";
  if ((kind === "C1" || kind === "C4") && verdict === "PARTIAL_HIT") return extra.significant_build ? "HIGH" : "MEDIUM";
  if (kind === "C2") return verdict === "MISS" ? "HIGH" : verdict === "PARTIAL_HIT" ? "MEDIUM" : "LOW";
  if (kind === "C3") return verdict === "SYSTEMIC_MISS" ? "HIGH" : verdict === "PARTIAL_HIT" ? "MEDIUM" : "LOW";
  if (kind === "PERCEPTION") return verdict === "SHADOW_CULTURE" ? "CRITICAL" : "MEDIUM";
  if (kind === "EOS") return extra.organisation_wide ? "CRITICAL" : "MEDIUM";
  if (kind === "TPS") return verdict === "HIGH_RISK" ? "CRITICAL" : "LOW";
  if (kind === "SUBCULTURE") return verdict === "CONFIRMED" ? "HIGH" : "MEDIUM";
  if (kind === "LEADER_FLAG") return verdict === "INTEGRITY" ? "CRITICAL" : "HIGH";
  return "LOW";
}

// ---------------------------------------------------------------- scenario library (§4.5.5)

/** Strict accessor: a null in a match expression makes the scenario not match (mirrors the oracle's TypeError path). */
class Missing extends Error {}
const n = <T>(x: T | null | undefined): T => { if (x === null || x === undefined) throw new Missing(); return x; };
const num = (x: Decimal | number | null | undefined) => D(n(x));

export interface ScenarioContext {
  dom: Orientation; strength: Decimal; gap: Profile; eos: Record<string, number | null>; d7: Decimal | null; pg: Profile | null;
  tps: Decimal | null; c3: Verdict; cls: Record<Orientation, GapClass>; all_hit: boolean; pref_dom: Orientation;
  segments: SegmentFinding[]; leaders: LeaderFinding[];
}
export interface SegmentFinding { segment: string; significance: "CONFIRMED" | "INDICATIVE"; dominance_divergence: boolean; is_subculture?: boolean }
export interface LeaderFinding { assignment_id: string; lri: Decimal | null; fit: Decimal | null; classification: string;
  team_dominant?: Orientation | null; team_eos_differential?: Decimal | null }

type Scenario = [string, string, Severity, (c: ScenarioContext) => boolean, string, string[], string[]];
export const SCENARIOS: Scenario[] = [
  ["SC-01", "Delivery without belonging", "HIGH",
    (c) => c.dom === "PERFORM" && c.strength.gte(5) && c.gap.ENGAGE.gte(8) && (n(c.eos.Q6) < 0 || n(c.eos.Q4) < 0),
    "Results are funded from discretionary effort that is running out.",
    ["Attrition of key talent", "Burnout", "Service-quality decay", "Employer-brand damage"],
    ["Is the pace a deliberate strategic choice or an unmanaged default?", "Are managers rewarded for output only?",
      "Has headcount lagged volume growth?", "Is recognition exclusively individual and commercial?"]],
  ["SC-02", "Order without ideas", "HIGH",
    (c) => c.dom === "GOVERN" && c.gap.INNOVATE.gte(8) && num(c.d7).lte(D("3.0")),
    "Control has hardened into a brake.",
    ["Loss of relevance", "Slow product cycles", "Talent leaves for more latitude"],
    ["How many approval layers stand between an idea and a pilot?", "Is failure punished informally?",
      "Is there any unallocated experimentation budget?"]],
  ["SC-03", "Ideas without delivery", "HIGH",
    (c) => c.dom === "INNOVATE" && (c.gap.GOVERN.gte(8) || c.gap.PERFORM.gte(8)),
    "Creative energy scatters; few initiatives reach customers.",
    ["Cash burn without return", "Cynicism from unfinished initiatives", "Compliance exposure"],
    ["Is there a stop rule for initiatives?", "Who owns the portfolio?", "Are launches counted as success rather than adoption?"]],
  ["SC-04", "Care without accountability", "HIGH",
    (c) => c.dom === "ENGAGE" && c.strength.gte(10) && c.gap.PERFORM.gte(8),
    "Cohesion is protected at the cost of performance conversations.",
    ["Targets missed", "Strong performers leave", "Decisions slow to consensus"],
    ["Are difficult conversations avoided?", "Do managers lack the skill or the will?", "Does reward differentiate at all?"]],
  ["SC-05", "Shadow culture", "CRITICAL",
    (c) => c.pg !== null && ORIENTATIONS.some((o) => c.pg![o].gt(7)),
    "Executives and staff describe two different organisations.",
    ["Interventions read as out of touch", "Communication increases cynicism", "Programme fails before content"],
    ["Which channels do executives rely on?", "Is there an unfiltered upward route?", "Do middle managers translate or buffer?"]],
  ["SC-06", "Sub-culture divergence", "MEDIUM",
    (c) => c.segments.some((s) => s.significance === "CONFIRMED" && s.dominance_divergence),
    "A unit runs a different operating logic.",
    ["Friction at unit boundaries", "Organisation-wide programmes land unevenly"],
    ["Is the unit's logic a strength to protect or a drift to correct?", "What does the unit adopt and what does it do differently?"]],
  ["SC-07", "Leader misaligned with a healthy team", "HIGH",
    (c) => c.leaders.some((l) => l.fit !== null && l.fit.lt(55) && (l.classification === "CULTURE_BLOCKER" || l.classification === "CRITICAL_BLOCKER") &&
      !!l.team_dominant && c.pref_dom === l.team_dominant),
    "The team is where the organisation wants to go; the leader is not.",
    ["Team attrition", "Team energy exhausted by friction with the leader"],
    ["Has the leader been told how the team experiences them?", "Who sponsors the leader one level up?"]],
  ["SC-08", "Capable leader, constrained unit", "MEDIUM",
    (c) => c.leaders.some((l) => l.lri !== null && l.lri.gte(cfg.get("leaders.carrier_lri_min")) && l.team_eos_differential !== null && l.team_eos_differential !== undefined && l.team_eos_differential.lte(-10)),
    "The constraint sits above or around the leader.",
    ["A capable leader burns out", "Development spend aimed at the wrong person"],
    ["Which decision rights does the unit lack?", "Is the unit under-resourced relative to its demand?"]],
  ["SC-09", "Low transformation readiness", "CRITICAL",
    (c) => c.tps !== null && c.tps.lt(D("2.50")),
    "The organisation cannot yet sustain the change it has named.",
    ["Public failure of a programme", "Loss of leadership credibility"],
    ["Is the constraint safety, capacity or leadership alignment?", "How did the last change programme end?"]],
  ["SC-10", "Systems fighting the strategy", "HIGH",
    (c) => c.c3 === "SYSTEMIC_MISS",
    "Reward and recognition pay for the behaviour the organisation wants to stop.",
    ["Change agenda disbelieved", "Compliant staff disadvantaged", "Entrenched cynicism"],
    ["What genuinely gets people promoted?", "What was last publicly celebrated?", "Does variable pay reward the moderated orientation?"]],
  ["SC-11", "Everything at once", "MEDIUM",
    (c) => ORIENTATIONS.filter((o) => c.cls[o] === "BUILD" || c.cls[o] === "STRENGTHEN").length >= 3,
    "No strategic choice has been made.",
    ["Resource dilution", "Plan collapses at first budget round"],
    ["Were Sections B–D completed against the approved strategy?", "Which single KPI matters most?"]],
  ["SC-12", "Aligned and under-recognised", "LOW",
    (c) => c.all_hit && c.strength.gte(10) && Object.values(c.eos).every((v) => v === null || v >= 0),
    "The culture serves the strategy; the risk is erosion.",
    ["Drift as the organisation grows", "Loss of the rituals that sustain the profile"],
    ["Which rituals carry the culture?", "What would break it at twice the headcount?"]],
];

export const SEV_RANK: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function matchScenarios(score: ScoreObject, checks: { C1: { verdict: Verdict }; C2: { verdict: Verdict }; C3: { verdict: Verdict }; C4: { verdict: Verdict } },
  extra: { segments?: SegmentFinding[]; leaders?: LeaderFinding[] } = {}) {
  const eos = Object.fromEntries(Object.entries(score.eos).filter(([k]) => k.startsWith("Q"))) as Record<string, number | null>;
  const ctx: ScenarioContext = {
    dom: score.dominance.dominant[0], strength: score.culture_strength, gap: score.orientation_scores.gap, eos,
    d7: score.readiness.d7 !== null ? q(score.readiness.d7, 1) : null, pg: score.perception_gap, tps: score.readiness.tps,
    c3: checks.C3.verdict, cls: score.classification,
    all_hit: [checks.C1.verdict, checks.C2.verdict, checks.C3.verdict, checks.C4.verdict].every((v) => v === "HIT"),
    segments: extra.segments ?? [], leaders: extra.leaders ?? [], pref_dom: ranked(score.orientation_scores.preferred)[0],
  };
  const out: { scenario_id: string; name: string; severity: Severity; diagnosis: string; risks: string[]; hypotheses: string[] }[] = [];
  for (const [sid, name, sev, fn, diagnosis, risks, hypotheses] of SCENARIOS) {
    let ok = false;
    try { ok = fn(ctx); } catch (e) { if (!(e instanceof Missing)) throw e; ok = false; }
    if (ok) out.push({ scenario_id: sid, name, severity: sev, diagnosis, risks, hypotheses });
  }
  return out.sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || (a.scenario_id < b.scenario_id ? -1 : 1));
}

// ---------------------------------------------------------------- evaluate (§4.4–4.5)

export interface Finding {
  finding_id: string; type: string; verdict: string; severity: Severity; blocking: boolean;
  orientation?: Orientation[]; metrics?: Record<string, unknown>; evidence?: Record<string, unknown>; blocks?: Record<string, unknown> | null;
  [k: string]: unknown;
}

export interface Evaluation {
  findings: Finding[]; checks: { C1: Verdict; C2: Verdict; C3: Verdict; C4: Verdict };
  c1: Finding[]; c2: Finding; c3: Finding; c4: Finding; scenarios: ReturnType<typeof matchScenarios>; blocking: Finding[];
}

/**
 * Evaluate C1 → C4 → C2 → C3 → perception and engagement → readiness signals (§4.1 order), then scenarios.
 * Optional `extra` adds segment, sub-culture and leader signals (SC-06/07/08); they are appended after the
 * organisation-level findings so organisation finding IDs never depend on segment queries.
 */
export function evaluate(score: ScoreObject, setup: EngineSetup, extra: {
  segments?: (SegmentFinding & { eos_negative?: string[]; capacity_subculture?: boolean })[]; leaders?: (LeaderFinding & { flags?: string[] })[];
} = {}): Evaluation {
  const now = score.orientation_scores.now;
  const classes = score.classification;
  const target = setup.leadership_target_orientation;
  const findings: Finding[] = [];
  let seq = 0;
  const add = (f: Omit<Finding, "finding_id" | "blocking"> & { blocking?: boolean }): Finding => {
    seq++;
    const out = { blocking: false, ...f, finding_id: `fnd_${String(seq).padStart(4, "0")}` } as Finding;
    findings.push(out);
    return out;
  };

  const c1s: Finding[] = [];
  for (const req of setup.c1_requirements) {
    const r = alignmentVerdict(req, now);
    const sigb = req.orientations.some((o) => classes[o] === "BUILD");
    c1s.push(add({ type: "C1_PERFORMANCE_ALIGNMENT", orientation: req.orientations, verdict: r.verdict,
      severity: severityFor("C1", r.verdict, { significant_build: sigb }),
      metrics: { alignment_pct: r.alignment_pct, subs: r.subs },
      evidence: { requirement: req, now: Object.fromEntries(req.orientations.map((o) => [o, now[o]])), overrides: r.overrides } }));
  }
  const c1Head: Verdict = c1s.length ? c1s.map((f) => f.verdict as Verdict).reduce((a, b) => (ORDER[b] < ORDER[a] ? b : a)) : "HIT";
  const c4req = setup.c4_requirement;
  const c4r = alignmentVerdict(c4req, now);
  const c4 = add({ type: "C4_MODEL_READINESS", orientation: c4req.orientations, verdict: c4r.verdict,
    severity: severityFor("C4", c4r.verdict, { significant_build: c4req.orientations.some((o) => classes[o] === "BUILD") }),
    metrics: { alignment_pct: c4r.alignment_pct, subs: c4r.subs }, evidence: { requirement: c4req, overrides: c4r.overrides } });
  const c2r = behaviourGap(score.dimension_now, target);
  const pf = score.perception_flags ?? ({} as Record<Orientation, string>);
  const c2 = add({ type: "C2_BEHAVIOUR_GAP", orientation: [target], verdict: c2r.verdict, severity: severityFor("C2", c2r.verdict),
    metrics: { rank: c2r.rank, behaviour_gap_points: c2r.behaviour_gap_points, intensity: c2r.intensity, shared_dominance: c2r.shared_dominance },
    evidence: { profile: c2r.profile, target },
    escalated_with: c2r.verdict === "MISS" && pf[target] === "SHADOW_CULTURE" ? "SHADOW_CULTURE" : null });
  const c3r = stopStart(score.dimension_now, classes);
  const c3 = add({ type: "C3_STOP_START", orientation: c3r.offending, verdict: c3r.verdict, severity: severityFor("C3", c3r.verdict),
    metrics: { moderate_count: c3r.moderate_count, identity_risk: c3r.identity_risk }, evidence: { offending: c3r.offending } });
  if (score.perception_gap) {
    for (const o of ORIENTATIONS) {
      const fl = pf[o];
      if (fl !== "NONE") add({ type: "PERCEPTION_GAP", orientation: [o], verdict: fl, severity: severityFor("PERCEPTION", fl),
        metrics: { perception_gap: score.perception_gap[o] }, blocking: fl === "SHADOW_CULTURE", blocks: fl === "SHADOW_CULTURE" ? { orientation: o } : null });
    }
  }
  for (const [k, v] of Object.entries(score.eos)) {
    if (k.startsWith("Q") && v !== null && typeof v === "number" && v < 0) {
      add({ type: "ENGAGEMENT_MISS", category: k, verdict: "FLAG", severity: severityFor("EOS", "FLAG", { organisation_wide: true }),
        metrics: { score: v }, blocking: true, blocks: { cohort: "ORGANISATION", category: k } });
    }
  }
  const rd = score.readiness;
  if (rd.tps !== null) {
    add({ type: "READINESS_SIGNAL", signal: "TPS_BAND", verdict: "FLAG", severity: severityFor("TPS", rd.tps_band!),
      metrics: { value: rd.tps, band: rd.tps_band, provisional: rd.provisional, coverage: rd.coverage } });
  }
  const gate = cfg.get("gates.readiness_le");
  const gates: [("d8" | "d9" | "d7"), Record<string, unknown>][] = [["d8", { orientations: ["ENGAGE", "INNOVATE"], class: "BUILD" }], ["d9", { content: true }], ["d7", { technology: true }]];
  for (const [dim, scope] of gates) {
    const v = rd[dim];
    if (v !== null && q(v, 1).lte(gate)) add({ type: "READINESS_SIGNAL", signal: `${dim.toUpperCase()}_LE_3`, verdict: "FLAG", severity: "HIGH",
      metrics: { value: q(v, 1) }, blocking: true, blocks: scope });
  }
  // Segment and leader signals (§4.5.4) — appended; organisation-level IDs above are stable.
  for (const s of extra.segments ?? []) {
    if (s.is_subculture || s.significance === "CONFIRMED") add({ type: "SUBCULTURE", segment_definition: s.segment, verdict: s.significance,
      severity: severityFor("SUBCULTURE", s.significance), metrics: { dominance_divergence: s.dominance_divergence } });
    for (const cat of s.eos_negative ?? []) add({ type: "ENGAGEMENT_MISS", category: cat, segment_definition: s.segment, verdict: "FLAG",
      severity: severityFor("EOS", "FLAG", { organisation_wide: false }), metrics: {}, blocking: true, blocks: { cohort: s.segment, category: cat } });
  }
  for (const l of extra.leaders ?? []) {
    for (const f of l.flags ?? []) add({ type: "LEADER_FLAG", leader: l.assignment_id, verdict: f, severity: severityFor("LEADER_FLAG", f),
      metrics: {}, blocking: f === "INTEGRITY" || f === "SAFETY", blocks: { unit_of_leader: l.assignment_id, flag: f } });
    if (l.classification === "CRITICAL_BLOCKER") add({ type: "LEADER_FLAG", leader: l.assignment_id, verdict: "CRITICAL_BLOCKER", severity: "CRITICAL",
      metrics: {}, blocking: true, blocks: { unit_of_leader: l.assignment_id, flag: "CRITICAL_BLOCKER" } });
  }
  const checks = { C1: { verdict: c1Head }, C2: c2 as unknown as { verdict: Verdict }, C3: c3 as unknown as { verdict: Verdict }, C4: c4 as unknown as { verdict: Verdict } };
  const scenarios = matchScenarios(score, checks, extra);
  return { findings, checks: { C1: c1Head, C2: c2.verdict as Verdict, C3: c3.verdict as Verdict, C4: c4.verdict as Verdict },
    c1: c1s, c2, c3, c4, scenarios, blocking: findings.filter((f) => f.blocking) };
}
