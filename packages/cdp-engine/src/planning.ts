/**
 * Stage 5 advisory engine (spec §5.5–§5.6): priority zero, selection under the readiness cap, trade-offs,
 * pathways and stepping stones, draft actions, prioritisation, workflow, RAG and escalation.
 * Mirrors oracle/cdp_oracle/planning.py. The engine drafts; people decide: it never fills owner, sponsor, budget or target as commitments.
 */
import { D, Decimal, q, ORIENTATIONS, Orientation, Profile } from "./num.js";
import * as cfg from "./config.js";
import { priorityCap, ranked, ScoreObject, GapClass, LeaderResult, SECTION_OF, Section } from "./scoring.js";
import type { Evaluation, Finding } from "./checks.js";
import type { EngineSetup } from "./types.js";
import { RULES_2_0 } from "./rules-data.js";
import { addDays, daysBetween, ISODate } from "./dates.js";

const R = RULES_2_0;
export const NEIGHBOURS: Record<Orientation, [Orientation, Orientation]> = { ENGAGE: ["INNOVATE", "GOVERN"], INNOVATE: ["ENGAGE", "PERFORM"], PERFORM: ["INNOVATE", "GOVERN"], GOVERN: ["ENGAGE", "PERFORM"] };
export const DIAGONAL: Record<Orientation, Orientation> = { ENGAGE: "PERFORM", PERFORM: "ENGAGE", INNOVATE: "GOVERN", GOVERN: "INNOVATE" };
const POLE = (a: Orientation, b: Orientation) => {
  const s = new Set([a, b]);
  if (s.has("ENGAGE") && s.has("INNOVATE")) return "ADAPTIVE";
  if (s.has("PERFORM") && s.has("GOVERN")) return "STRUCTURED";
  if (s.has("INNOVATE") && s.has("PERFORM")) return "OUTWARD";
  return "INWARD";
};
const ADAPTIVE = new Set<Orientation>(["ENGAGE", "INNOVATE"]);
const PATHWAY = (a: Orientation, b: Orientation) => R.pathways.find((p) => p.from === a && p.to === b)!;
export const PLAYBOOK = R.playbook as unknown as Record<Orientation, { signal: string; levers: { lever: string; text: string }[]; medium: string; watch: string[] }>;
export type UrgencyTier = keyof typeof R.tiers;
export const TIER = R.tiers as Record<UrgencyTier, { owner_role: string; due_days: number; urgency: number }>;

// ---------------------------------------------------------------- urgency (§5.5.3)

export function urgencyTier(o: Orientation, ev: Evaluation, target: Orientation, classes: Record<Orientation, GapClass>): UrgencyTier {
  const c1Miss = ev.c1.some((f) => f.verdict === "MISS" && f.orientation!.includes(o));
  const c1Partial = ev.c1.some((f) => f.verdict === "PARTIAL_HIT" && f.orientation!.includes(o));
  const c4 = ev.c4;
  if (c1Miss) return "STRATEGIC_MISS";
  if (c4.verdict === "MISS" && c4.orientation!.includes(o)) return "MODEL_READINESS";
  if (o === target && (ev.c2.verdict === "MISS" || ev.c2.verdict === "PARTIAL_HIT")) return "BEHAVIOUR_GAP";
  if (c1Partial) return "STRATEGIC_MISS";
  if (ev.c3.orientation!.includes(o) || classes[o] === "MODERATE") return "PROCESS_CONTRADICTION";
  if (c4.verdict === "PARTIAL_HIT" && c4.orientation!.includes(o)) return "MODEL_READINESS";
  return "PROCESS_CONTRADICTION";
}

export function linkedToCheck(o: Orientation, ev: Evaluation): boolean {
  if (ev.c1.some((f) => f.verdict !== "HIT" && f.orientation!.includes(o))) return true;
  return [ev.c2, ev.c3, ev.c4].some((f) => f.verdict !== "HIT" && f.orientation!.includes(o));
}

// ---------------------------------------------------------------- pathways (§5.5.5)

export interface Pathway { from?: Orientation; to?: Orientation; relationship: string; difficulty?: string; narrative: string; interventions?: string;
  stepping_stone?: Orientation | null; stepping_narrative?: string }

/** The neighbour a diagonal shift is routed through (spec 6.5.1): of the two orientations that border both ends, the one already stronger in today's
 *  profile; on a tie, the one on the same adaptive or structured side as the target. A move is never drawn or planned straight across a diagonal. */
export function steppingStone(origin: Orientation, target: Orientation, now: Profile): Orientation {
  const [a, b] = NEIGHBOURS[origin].filter((x) => NEIGHBOURS[target].includes(x));
  return !now[a].eq(now[b]) ? (now[a].gt(now[b]) ? a : b) : (ADAPTIVE.has(a) === ADAPTIVE.has(target) ? a : b);
}

export function pathway(origin: Orientation, target: Orientation, score: ScoreObject): Pathway | null {
  if (origin === target) return null;
  const rel = DIAGONAL[origin] === target ? "DIAGONAL" : "ADJACENT_" + POLE(origin, target);
  const p = PATHWAY(origin, target);
  const out: Pathway = { from: origin, to: target, relationship: rel, difficulty: rel === "DIAGONAL" ? "HIGH" : "MODERATE",
    narrative: p.narrative, interventions: p.interventions, stepping_stone: null };
  const rd = score.readiness;
  const gate = cfg.get("gates.readiness_le");
  const low = (rd.tps !== null && rd.tps.lt(cfg.get("scoring.tps.bands")[1])) || (rd.d8 !== null && q(rd.d8, 1).lte(gate)) || (rd.d9 !== null && q(rd.d9, 1).lte(gate));
  if (rel === "DIAGONAL" && low) {
    const stone = steppingStone(origin, target, score.orientation_scores.now);
    out.stepping_stone = stone;
    out.stepping_narrative = PATHWAY(origin, stone).narrative;
  }
  return out;
}

// ---------------------------------------------------------------- selection (§5.5.4)

export interface Action {
  action_id: string; level: "ORGANISATION" | "UNIT" | "LEADER"; priority_id: string; linked_finding_id: string | null; orientation: Orientation;
  classification_at_creation: GapClass; objective: string; intervention: string; horizon: "QUICK_WIN_0_3M" | "MEDIUM_3_12M" | "STRUCTURAL_12M_PLUS";
  is_visible_signal: boolean; system_lever: string; owner: string | null; sponsor: string | null; start_date: ISODate; end_date: ISODate; status: string;
  generated_by: string; impact: Decimal; urgency: number; effort: number; priority_score: Decimal; kpi: string | null;
  baseline_value: number | string | null; target_value: number | string | null; watchlist: string[]; review_points: string[];
  [k: string]: unknown;
}
export interface Priority {
  priority_id: string; sequence: number; orientation: Orientation; classification: GapClass; gap: Decimal; urgency_tier: UrgencyTier; owner_role: string;
  due: ISODate; linked_findings: string[]; trade_off_orientation: Orientation | null; pathway: Pathway | null; c3_levers: boolean; actions: Action[]; blocked_by: string[];
}
export interface PriorityZeroItem { item_id: string; gate: string; item: string; finding_ids: string[] }
export interface Plan {
  priority_zero: { priority_id: "pri_00"; sequence: 0; urgency_tier: "PRE_CONDITION"; owner_role: string; due: ISODate; items: PriorityZeroItem[] } | null;
  priorities: Priority[]; backlog: { orientation: Orientation; reason: string; gap: Decimal }[]; cap: number;
}

export function buildPlan(score: ScoreObject, ev: Evaluation, setup: EngineSetup, start: ISODate): Plan {
  const classes = score.classification, gap = score.orientation_scores.gap;
  const target = setup.leadership_target_orientation;
  const build = cfg.get("scoring.gap.build");
  const cand = ORIENTATIONS.filter((o) => classes[o] === "BUILD" || (classes[o] === "STRENGTHEN" && linkedToCheck(o, ev)) || (classes[o] === "MODERATE" && gap[o].lte(build.neg())));
  const key = (o: Orientation): (number | Decimal)[] => {
    const c1c4 = ev.c1.some((f) => f.verdict === "MISS" && f.orientation!.includes(o)) || (ev.c4.verdict === "MISS" && ev.c4.orientation!.includes(o));
    const c2 = o === target && ev.c2.verdict === "MISS";
    const c3 = ev.c3.verdict === "SYSTEMIC_MISS" && ev.c3.orientation!.includes(o);
    return [c1c4 ? 0 : 1, c2 ? 0 : 1, c3 ? 0 : 1, gap[o].abs().neg(), ORIENTATIONS.indexOf(o)];
  };
  cand.sort((a, b) => {
    const ka = key(a), kb = key(b);
    for (let i = 0; i < ka.length; i++) {
      const x = ka[i], y = kb[i];
      const c = x instanceof Decimal ? x.comparedTo(y as Decimal) : (x as number) - (y as number);
      if (c !== 0) return c;
    }
    return 0;
  });
  if (score.readiness.tps === null) throw new Error("INSUFFICIENT_DATA: TPS is required to set the readiness cap");
  const cap = priorityCap(score.readiness.tps);
  const selected = cand.slice(0, cap);
  const backlog = cand.slice(cap).map((o) => ({ orientation: o, reason: "readiness cap", gap: gap[o] }));
  const origin = ranked(score.orientation_scores.now)[0];
  const negatives = ORIENTATIONS.filter((o) => gap[o].lt(0)).sort((a, b) => gap[a].comparedTo(gap[b]));
  const used = new Set<Orientation>();
  const priorities: Priority[] = [];
  selected.forEach((o, idx) => {
    const i = idx + 1;
    const tier = urgencyTier(o, ev, target, classes);
    const t = TIER[tier];
    const p: Priority = { priority_id: `pri_${String(i).padStart(2, "0")}`, sequence: i, orientation: o, classification: classes[o], gap: gap[o],
      urgency_tier: tier, owner_role: t.owner_role, due: addDays(start, t.due_days),
      linked_findings: ev.findings.filter((f) => f.orientation && f.orientation.length && f.orientation.includes(o)).map((f) => f.finding_id),
      trade_off_orientation: null, pathway: null, c3_levers: false, actions: [], blocked_by: [] };
    if (classes[o] === "BUILD") {
      const free = negatives.filter((x) => !used.has(x) && x !== o);
      const pool = free.length ? free : negatives.filter((x) => x !== o);
      if (!pool.length) throw new Error("PLAN_INCOHERENT: a BUILD priority has no negative-gap orientation to release");
      p.trade_off_orientation = pool[0];
      used.add(pool[0]);
      p.pathway = pathway(origin, o, score);
    } else if (classes[o] === "STRENGTHEN") {
      p.pathway = pathway(origin, o, score);
    } else {
      p.pathway = { relationship: "MODERATE_OVERPLAY", narrative: "Moderate the overplay; keep what protects the organisation." };
    }
    priorities.push(p);
  });
  if (ev.c3.verdict === "PARTIAL_HIT" || ev.c3.verdict === "SYSTEMIC_MISS") {
    for (const off of ev.c3.orientation!) {
      const host = priorities.find((p) => p.trade_off_orientation === off) ?? priorities.find((p) => p.orientation === off);
      if (host) host.c3_levers = true;
    }
  }
  const groups = new Map<string, Finding[]>();
  for (const f of ev.blocking) {
    const g = f.type === "PERCEPTION_GAP" ? "SHADOW_CULTURE" : f.type === "ENGAGEMENT_MISS" && !f.segment_definition ? "EOS_NEGATIVE"
      : ["D8_LE_3", "D9_LE_3", "D7_LE_3"].includes(String(f.signal)) ? String(f.signal) : null;
    if (g) { if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(f); }
  }
  const items: PriorityZeroItem[] = [];
  for (const gate of ["SHADOW_CULTURE", "EOS_NEGATIVE", "D8_LE_3", "D9_LE_3", "D7_LE_3"]) {
    const fs = groups.get(gate);
    if (!fs) continue;
    const text = gate === "SHADOW_CULTURE" ? "Perception-gap workshop (" + fs.map((f) => f.orientation![0]).join(" and ") + " SHADOW CULTURE)"
      : gate === "EOS_NEGATIVE" ? "Structured listening sessions on eOS " + fs.map((f) => f.category).join(" and ") + " with the affected cohorts"
      : gate === "D8_LE_3" ? "Launch the psychological-safety workstream (D8 ≤ 3.0)"
      : gate === "D9_LE_3" ? "Build change infrastructure before content (D9 ≤ 3.0)"
      : "Digital adoption plan and executive sponsor for technology-dependent priorities";
    items.push({ item_id: `p0_${String(items.length + 1).padStart(2, "0")}`, gate, item: text, finding_ids: fs.map((f) => f.finding_id) });
  }
  const zero = items.length ? { priority_id: "pri_00" as const, sequence: 0 as const, urgency_tier: "PRE_CONDITION" as const, owner_role: "CEO+CHRO",
    due: addDays(start, cfg.get("plan.visible_signal_days")), items } : null;
  for (const p of priorities) { p.actions = generateActions(p, ev, setup, start); p.blocked_by = blockedBy(p, ev); }
  return { priority_zero: zero, priorities, backlog, cap };
}

/** Open blocking findings that prevent publication of this priority's actions (§5.6, AC-5.3). */
export function blockedBy(priority: Pick<Priority, "orientation" | "classification">, ev: Pick<Evaluation, "blocking">): string[] {
  const o = priority.orientation;
  const out: string[] = [];
  for (const f of ev.blocking) {
    const b = (f.blocks ?? {}) as Record<string, unknown>;
    if (b.orientation === o) out.push(f.finding_id);
    else if (Array.isArray(b.orientations) && b.orientations.includes(o) && priority.classification === b.class) out.push(f.finding_id);
    else if (b.cohort === "ORGANISATION" || b.content) out.push(f.finding_id);
  }
  return out;
}

// ---------------------------------------------------------------- action generation and scoring (§5.5.6–5.5.7)

export function impactRating(p: Pick<Priority, "orientation" | "classification" | "gap" | "c3_levers">, ev: Evaluation, hasKpi: boolean): Decimal {
  const o = p.orientation;
  const c1c4Miss = ev.c1.some((f) => f.verdict === "MISS" && f.orientation!.includes(o)) || (ev.c4.verdict === "MISS" && ev.c4.orientation!.includes(o));
  let base: Decimal;
  if (c1c4Miss && p.classification === "BUILD" && hasKpi) base = D(5);
  else if (c1c4Miss || (ev.c2.verdict === "MISS" && ev.c2.orientation!.includes(o)) || (ev.c3.verdict === "SYSTEMIC_MISS" && p.c3_levers)) base = D(4);
  else if (linkedToCheck(o, ev) || p.gap.abs().gte(8)) base = D(3);
  else if (p.classification === "STRENGTHEN") base = D(2);
  else base = D(1);
  if (p.gap.abs().gte(12)) { const b2 = base.plus(D("0.5")); base = b2.lt(D(5)) ? b2 : D(5); }
  return base;
}

export const priorityScore = (impact: Decimal | number | string, urgency: Decimal | number | string, effort: Decimal | number | string) => q(D(impact).times(D(urgency)).div(D(effort)), 2);

const HORIZON_DAYS = { QUICK_WIN_0_3M: 90, MEDIUM_3_12M: 365, STRUCTURAL_12M_PLUS: 540 } as const;

export function generateActions(p: Priority, ev: Evaluation, setup: EngineSetup, start: ISODate): Action[] {
  const o = p.orientation;
  const pb = PLAYBOOK[o];
  const kpi = setup.kpi_for?.[o];
  const urg = TIER[p.urgency_tier].urgency;
  const imp = impactRating(p, ev, kpi !== undefined && kpi !== null);
  const acts: Action[] = [];
  const add = (objective: string, intervention: string, horizon: Action["horizon"], lever: string, effort: number, signal = false, days?: number) => {
    const n = acts.length + 1;
    acts.push({ action_id: `act_${p.sequence}${String(n).padStart(2, "0")}`, level: "ORGANISATION", priority_id: p.priority_id,
      linked_finding_id: p.linked_findings[0] ?? null, orientation: o, classification_at_creation: p.classification, objective, intervention, horizon,
      is_visible_signal: signal, system_lever: lever, owner: null, sponsor: null, start_date: start, end_date: addDays(start, days || HORIZON_DAYS[horizon]),
      status: "DRAFT", generated_by: "RULES_ENGINE", impact: imp, urgency: urg, effort, priority_score: priorityScore(imp, urg, effort),
      kpi: kpi ? kpi.name : null, baseline_value: kpi ? kpi.baseline : null, target_value: kpi ? kpi.target : null,
      watchlist: [...pb.watch], review_points: ["+30d", "+90d", "+180d"] });
  };
  const verb = p.classification === "BUILD" || p.classification === "STRENGTHEN" ? "Build" : "Moderate";
  add(`Make the ${o} shift visible within 30 days`, pb.signal, "QUICK_WIN_0_3M", "RECOGNITION_RITUAL", 1, true, cfg.get("plan.visible_signal_days"));
  add(`${verb} ${o} capability where it matters for the strategy`, pb.medium, "MEDIUM_3_12M", pb.levers[pb.levers.length - 1].lever, 3);
  const lever = pb.levers[0];
  add(`Change the system that sets ${o} behaviour`, lever.text, "STRUCTURAL_12M_PLUS", lever.lever, 4);
  if (p.trade_off_orientation) {
    const t = p.trade_off_orientation;
    add(`Release ${t} to make room for ${o}`, `Name and reduce the ${t} overplay that competes with ${o}; agree what stops.`, "MEDIUM_3_12M", "PERFORMANCE_MANAGEMENT", 2);
  }
  if (p.c3_levers) {
    add("Stop paying for the behaviour the organisation wants to stop",
      "HR systems redesign within 90 days: performance management, promotion criteria, incentives and onboarding.", "MEDIUM_3_12M", "REWARD", 4, false, 90);
  }
  const sig = acts.filter((a) => a.is_visible_signal);
  const rest = acts.filter((a) => !a.is_visible_signal).sort((a, b) => b.priority_score.comparedTo(a.priority_score));
  return [...sig, ...rest.slice(0, cfg.get("plan.action_caps")[0] - 1)];
}

// ---------------------------------------------------------------- plan integrity (§5.5.6, §5.5.9; UT-23, AC-5.6)

export class WorkflowError extends Error {
  constructor(public code: string, public detail: string, public status = 409, public extra: Record<string, unknown> = {}) { super(`${code}: ${detail}`); }
}

/** Refuse an edit that leaves a BUILD priority without a trade-off (422 PLAN_INCOHERENT). */
export function validatePriorityEdit(p: Pick<Priority, "classification" | "trade_off_orientation" | "orientation">, gaps: Record<Orientation, Decimal>): void {
  if (p.classification === "BUILD") {
    if (!p.trade_off_orientation) throw new WorkflowError("PLAN_INCOHERENT", "A BUILD priority must name the orientation it releases", 422);
    if (!gaps[p.trade_off_orientation].lt(0)) throw new WorkflowError("PLAN_INCOHERENT", "The trade-off orientation must have a negative gap", 422);
  }
}

/** Mandatory companions per priority: visible signal ≤ 30 days, a system lever, and (BUILD) a trade-off action (AC-5.6). */
export function missingCompanions(p: Pick<Priority, "classification" | "trade_off_orientation">, actions: Pick<Action, "is_visible_signal" | "horizon" | "system_lever" | "objective" | "start_date" | "end_date">[]): string[] {
  const missing: string[] = [];
  const signals = actions.filter((a) => a.is_visible_signal);
  if (signals.length !== 1 || daysBetween(signals[0].start_date, signals[0].end_date) > cfg.get("plan.visible_signal_days")) missing.push("VISIBLE_SIGNAL");
  if (!actions.some((a) => a.horizon !== "QUICK_WIN_0_3M" && a.system_lever !== "NONE")) missing.push("SYSTEM_LEVER");
  if (p.classification === "BUILD" && !actions.some((a) => p.trade_off_orientation && a.objective.startsWith(`Release ${p.trade_off_orientation}`))) missing.push("TRADE_OFF_ACTION");
  return missing;
}

export function assertCompanions(p: Parameters<typeof missingCompanions>[0], actions: Parameters<typeof missingCompanions>[1]): void {
  const m = missingCompanions(p, actions);
  if (m.length) throw new WorkflowError("MANDATORY_COMPANION_MISSING", "Priority is missing: " + m.join(", "), 422, { missing: m });
}

/** Caps per level (D-05): ≤ 6 organisation actions per priority, ≤ 3 unit actions per unit per cycle, ≤ 3 leader development actions per 6 months. */
export function assertCap(level: "ORGANISATION" | "UNIT" | "LEADER", existingCount: number): void {
  const [org, unit, leader] = cfg.get("plan.action_caps");
  const cap = level === "ORGANISATION" ? org : level === "UNIT" ? unit : leader;
  if (existingCount >= cap) throw new WorkflowError("CAP_EXCEEDED", `${level} cap of ${cap} reached; move the action to the backlog`, 422, { cap });
}

// ---------------------------------------------------------------- Leader Development Plan (§5.6.2)

export interface DevelopmentAction { orientation: Orientation | null; section: Section | null; basis: "GROWTH" | "TARGET" | "BLIND_SPOT";
  start_stop_keep: "START" | "STOP" | "KEEP" | null; behaviour: string | null; visible_change_30d: string | null; support: string; linked_action_id: string | null }

/** Draft up to three development actions: growth orientation, leadership target orientation, one BLIND_SPOT section. */
export function draftDevelopmentPlan(leader: LeaderResult, target: Orientation, urgencyTier?: UrgencyTier): DevelopmentAction[] {
  if (!leader.valid || !leader.growth) return [];
  const support = urgencyTier === "BEHAVIOUR_GAP" ? "COACHING_MIN_8_SESSIONS" : "COACHING";
  const out: DevelopmentAction[] = [{ orientation: leader.growth, section: SECTION_OF[leader.growth], basis: "GROWTH", start_stop_keep: null, behaviour: null, visible_change_30d: null, support, linked_action_id: null }];
  if (target !== leader.growth) out.push({ orientation: target, section: SECTION_OF[target], basis: "TARGET", start_stop_keep: null, behaviour: null, visible_change_30d: null, support, linked_action_id: null });
  const blind = (Object.entries(leader.self_other ?? {}) as [Section, { tier: string }][]).find(([s, v]) => v.tier === "BLIND_SPOT" && !out.some((a) => a.section === s));
  if (blind) out.push({ orientation: null, section: blind[0], basis: "BLIND_SPOT", start_stop_keep: null, behaviour: null, visible_change_30d: null, support, linked_action_id: null });
  return out.slice(0, cfg.get("plan.action_caps")[2]);
}

// ---------------------------------------------------------------- workflow (§5.6)

export type ActionStatus = "DRAFT" | "IN_REVIEW" | "IN_CO_DESIGN" | "APPROVED" | "PUBLISHED" | "IN_PROGRESS" | "UNDER_REVIEW" | "CLOSED" | "RETIRED" | "DISCARDED";
export const TRANSITIONS = new Map<string, Set<string>>(R.transitions.map((t) => [`${t.from}>${t.to}`, new Set<string>(t.roles)]));
/** Rules 2.2 (owner ruling 22 Oct 2026, Erick Ngala comment 67; design docs/designs/J4b-client-owned-plan.md): the client owns the plan. The system proposes every
 *  action (Draft to In review to In co design, role SYSTEM, at report release), the client accepts (to Approved), publishes, and may discard a draft. The consultant
 *  no longer moves actions, except the review moves after publication, which stay as they are. Plans on 2.0 and 2.1 keep the table above. */
export const TRANSITIONS_2_2 = new Map<string, Set<string>>([...TRANSITIONS].map(([k, v]) => [k, new Set(v)]));
for (const [k, roles] of Object.entries({
  "DRAFT>IN_REVIEW": ["SYSTEM"], "DRAFT>DISCARDED": ["CLIENT_ADMIN", "EXECUTIVE"], "IN_REVIEW>IN_CO_DESIGN": ["SYSTEM"],
  "IN_CO_DESIGN>APPROVED": ["CLIENT_ADMIN", "EXECUTIVE", "PEOPLE_LEADER"], "APPROVED>PUBLISHED": ["CLIENT_ADMIN", "EXECUTIVE"],
})) TRANSITIONS_2_2.set(k, new Set(roles));
/** The transition table a plan runs under, by the rules version pinned on its assessment. */
export const transitionsFor = (rules?: string | null) => (rules === "2.2" ? TRANSITIONS_2_2 : TRANSITIONS);

export const MANDATORY_FOR_APPROVAL = R.mandatory_for_approval as readonly string[];

/** Enforce one action state transition; any transition not in the table is 409 ILLEGAL_TRANSITION (AC-5.4). */
export function transition<T extends { status: string; horizon?: string; [k: string]: unknown }>(action: T, to: ActionStatus, role: string,
  opts: { openGates?: string[]; evidenceCount?: number; reason?: string | null; closureOutcome?: string | null; rules?: string | null } = {}): T {
  const frm = action.status;
  const roles = transitionsFor(opts.rules).get(`${frm}>${to}`);
  if (!roles) throw new WorkflowError("ILLEGAL_TRANSITION", `${frm} → ${to} is not allowed`);
  if (!roles.has(role)) throw new WorkflowError("FORBIDDEN", `${role} cannot perform ${frm} → ${to}`, 403);
  if (to === "DISCARDED" && !opts.reason) throw new WorkflowError("VALIDATION_FAILED", "A discard needs a recorded reason", 422);
  if (to === "APPROVED") {
    const missing = MANDATORY_FOR_APPROVAL.filter((k) => action[k] === null || action[k] === undefined || action[k] === "");
    if (action.horizon === "STRUCTURAL_12M_PLUS" && !action.budget_amount) missing.push("budget_amount");
    if (missing.length) throw new WorkflowError("VALIDATION_FAILED", "Missing mandatory fields: " + missing.join(", "), 422, { missing });
  }
  if (to === "PUBLISHED" && opts.openGates && opts.openGates.length) throw new WorkflowError("BLOCKING_GATE_OPEN", "Pre-condition open: " + opts.openGates.join(", "), 409, { gates: opts.openGates });
  if (to === "CLOSED" && !opts.evidenceCount) throw new WorkflowError("EVIDENCE_REQUIRED", "Upload evidence before closing (document, minutes or KPI report)", 409, { evidence_type: "DOCUMENT_OR_KPI_READING" });
  return { ...action, status: to };
}

// ---------------------------------------------------------------- RAG and escalation (§5.6.1, §5.6.3)

export type Rag = "GREEN" | "AMBER" | "RED";
export interface Milestone { due: ISODate; status: string }

/** Sign-adjusted progress towards target: (latest − baseline) ÷ (target − baseline). */
export function kpiProgress(baseline: Decimal | number | string, target: Decimal | number | string, latest: Decimal | number | string): Decimal | null {
  const b = D(baseline), t = D(target);
  if (t.eq(b)) return null;
  return D(latest).minus(b).div(t.minus(b));
}

export function rag(action: { status: string; baseline_value?: unknown; target_value?: unknown; end_date?: ISODate | null }, today: ISODate,
  opts: { milestones?: Milestone[]; readings?: (number | string | Decimal)[]; reviewPointsMissed?: number; at90Review?: boolean } = {}): Rag {
  const over = (opts.milestones ?? []).filter((m) => m.status !== "DONE" && m.due < today).map((m) => daysBetween(m.due, today));
  const readings = opts.readings ?? [];
  let prog: Decimal | null = null;
  if (readings.length && action.target_value !== null && action.target_value !== undefined && action.baseline_value !== null && action.baseline_value !== undefined) {
    prog = kpiProgress(action.baseline_value as number, action.target_value as number, readings[readings.length - 1]);
  }
  const band = cfg.get("tracking.rag_flat_band");
  const missed = opts.reviewPointsMissed ?? 0;
  const ended = !!action.end_date && today > action.end_date && !["CLOSED", "RETIRED"].includes(action.status);
  if (over.some((d) => d > 14) || (prog !== null && prog.lt(band.neg())) || ended || missed >= 2) return "RED";
  if (over.length || (opts.at90Review && prog !== null && prog.abs().lte(band)) || missed === 1) return "AMBER";
  return "GREEN";
}

export type Escalation = "OWNER_REMINDER" | "OWNER_DAILY" | "SPONSOR" | "TIER_OWNER" | "EXCO_DECISION" | "CEO_IMMEDIATE" | null;

/** Escalation ladder (Table 94, D-05). `daysUntilDue` > 0 means not yet due. */
export function escalation(daysOverdue: number, redWeeks = 0, opts: { visibleSignalMissed?: boolean; daysUntilDue?: number } = {}): Escalation {
  const [d1, d2, d3] = cfg.get("tracking.escalation_days");
  if (opts.visibleSignalMissed) return "CEO_IMMEDIATE";
  if (redWeeks >= 4) return "EXCO_DECISION";
  if (daysOverdue >= d3 || redWeeks >= 2) return "TIER_OWNER";
  if (daysOverdue >= d2) return "SPONSOR";
  if (daysOverdue > 0) return "OWNER_DAILY";
  if (opts.daysUntilDue !== undefined && opts.daysUntilDue === d1) return "OWNER_REMINDER";
  return null;
}
