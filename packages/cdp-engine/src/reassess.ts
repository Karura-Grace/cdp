/**
 * Stage 6 re-assessment (spec §6.5–§6.6): pulse validation and triggers, before/after comparison,
 * trade-off verification, adjust-or-retire, version comparability, rollover and retention dates.
 */
import { D, Decimal, q, ORIENTATIONS, Orientation, Profile, sum } from "./num.js";
import * as cfg from "./config.js";
import type { GapClass } from "./scoring.js";
import { addDays, ISODate } from "./dates.js";

/** Pulse short forms (D-12), zero-based item indices within each 12-item block. */
export const SHORT_FORMS: Record<"D7" | "D8" | "D9", number[]> = { D7: [0, 2, 3, 7], D8: [1, 2, 4, 10], D9: [0, 4, 8, 9] };
export const SHORT_FORM_ITEM_IDS = Object.fromEntries(Object.entries(SHORT_FORMS).map(([d, ix]) => [d, ix.map((i) => `${d}-${String(i + 1).padStart(2, "0")}`)]));

export function validatePulse(items: string[], watchlist: string[]): string[] {
  const errs: string[] = [];
  if (items.length > cfg.get("pulse.max_items")) errs.push("More than ten items");
  const off = items.filter((i) => !watchlist.includes(i));
  if (off.length) errs.push("Items outside the watch-list: " + off.join(", "));
  return errs;
}

export interface PulseReading { likert?: Record<string, Decimal | number | string>; eos?: Record<string, number>; scenario?: Record<string, Decimal | number | string> }
export function pulseTriggers(baseline: PulseReading, current: PulseReading): { type: "PULSE_MOVEMENT"; ref: string }[] {
  const [lik, eos, sc] = cfg.get("pulse.triggers");
  const out: { type: "PULSE_MOVEMENT"; ref: string }[] = [];
  for (const [k, v] of Object.entries(current.likert ?? {})) if (q(v, 1).minus(q(baseline.likert![k], 1)).abs().gte(lik)) out.push({ type: "PULSE_MOVEMENT", ref: k });
  for (const [k, v] of Object.entries(current.eos ?? {})) if (D(v).minus(D(baseline.eos![k])).abs().gte(eos)) out.push({ type: "PULSE_MOVEMENT", ref: "eOS " + k });
  for (const [k, v] of Object.entries(current.scenario ?? {})) if (D(v).minus(D(baseline.scenario![k])).abs().gte(sc)) out.push({ type: "PULSE_MOVEMENT", ref: k });
  return out;
}

export type TriggerType = "PULSE_MOVEMENT" | "STRUCTURAL_COMPLETE" | "ORG_CHANGE" | "BOARD_REQUEST" | "ANNUAL";
/** Non-pulse triggers (Table 102). A trigger opens a consultant review, never an automatic survey (D-06). */
export function otherTriggers(o: { structuralActionsByPriority?: Record<string, string[]>; orgChanges?: { type: string }[]; boardRequest?: boolean;
  baselineClosedOn?: ISODate; today?: ISODate }): { type: TriggerType; ref: string }[] {
  const out: { type: TriggerType; ref: string }[] = [];
  for (const [pri, statuses] of Object.entries(o.structuralActionsByPriority ?? {})) if (statuses.length && statuses.every((s) => s === "CLOSED")) out.push({ type: "STRUCTURAL_COMPLETE", ref: pri });
  for (const c of o.orgChanges ?? []) if (["RESTRUCTURE", "MERGER", "NEW_CEO", "MODEL_TRANSITION_LIVE"].includes(c.type)) out.push({ type: "ORG_CHANGE", ref: c.type });
  if (o.boardRequest) out.push({ type: "BOARD_REQUEST", ref: "board" });
  if (o.baselineClosedOn && o.today) {
    const [y, m, d] = o.baselineClosedOn.split("-").map(Number);
    const anniversary = `${y + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (o.today >= anniversary) out.push({ type: "ANNUAL", ref: anniversary });
  }
  return out;
}

export function tradeOffVerification(baseNow: Profile, curNow: Profile,
  priorities: { priority_id: string; orientation: Orientation; classification: string; trade_off_orientation?: Orientation | null }[],
  baseClasses: Partial<Record<Orientation, GapClass>>) {
  const out: { priority: string; target: Orientation; trade_off: Orientation; rise: Decimal; share_trade_off: Decimal | null; verdict: "INTENDED_RELEASE" | "MIXED_RELEASE" | "NO_MOVEMENT" }[] = [];
  const unintended: Orientation[] = [];
  for (const p of priorities) {
    if (p.classification !== "BUILD" || !p.trade_off_orientation) continue;
    const t = p.orientation, r = p.trade_off_orientation;
    const rise = q(D(curNow[t]).minus(D(baseNow[t])), 2);
    const falls = Object.fromEntries(ORIENTATIONS.filter((o) => o !== t).map((o) => { const f = D(baseNow[o]).minus(D(curNow[o])); return [o, f.gt(0) ? f : D(0)]; })) as Record<Orientation, Decimal>;
    const tot = sum(Object.values(falls));
    const share = tot.isZero() ? null : q(falls[r].div(tot), 2);
    const verdict = rise.lte(0) ? "NO_MOVEMENT" : share !== null && share.gte(D("0.50")) ? "INTENDED_RELEASE" : "MIXED_RELEASE";
    out.push({ priority: p.priority_id, target: t, trade_off: r, rise, share_trade_off: share, verdict });
  }
  for (const o of ORIENTATIONS) if (baseClasses[o] === "KEEP_AND_PROTECT" && D(baseNow[o]).minus(D(curNow[o])).gte(4)) unintended.push(o);
  return { verification: out, unintended_release: unintended };
}

/** Before/after deltas for comparable assessments (§6.5.2). */
export function compareProfiles(base: Profile, cur: Profile): Profile {
  return Object.fromEntries(ORIENTATIONS.map((o) => [o, q(D(cur[o]).minus(D(base[o])), 2)])) as Profile;
}

export type AdjustDecision = "CONTINUE" | "ADJUST_INTERVENTION" | "ADJUST_RESOURCING" | "SUSPEND_AND_REDIAGNOSE" | "RETIRE_AND_REINSTATE_PRECONDITION"
  | "RETIRE_SUPERSEDED" | "REASSIGN_WITHIN_14_DAYS" | "RETIRE_NOT_ACHIEVED";
export function adjustOrRetire(kpiDirection: "TOWARDS" | "FLAT" | "AWAY", milestonesOnTrack: boolean, o: { preconditionOpen?: boolean; findingSupported?: boolean;
  ownerPresent?: boolean; consecutiveAdjustmentsWithoutMovement?: number } = {}): AdjustDecision {
  if (o.preconditionOpen) return "RETIRE_AND_REINSTATE_PRECONDITION";
  if (o.findingSupported === false) return "RETIRE_SUPERSEDED";
  if (o.ownerPresent === false) return "REASSIGN_WITHIN_14_DAYS";
  if ((o.consecutiveAdjustmentsWithoutMovement ?? 0) >= 2) return "RETIRE_NOT_ACHIEVED";
  if (kpiDirection === "AWAY") return "SUSPEND_AND_REDIAGNOSE";
  if (kpiDirection === "TOWARDS" && milestonesOnTrack) return "CONTINUE";
  if (kpiDirection === "FLAT" && milestonesOnTrack) return "ADJUST_INTERVENTION";
  return "ADJUST_RESOURCING";
}

/** KPI direction from progress ratio using the flat band (§5.6.1). */
export function kpiDirection(progress: Decimal | null): "TOWARDS" | "FLAT" | "AWAY" {
  const band = cfg.get("tracking.rag_flat_band");
  if (progress === null) return "FLAT";
  return progress.gt(band) ? "TOWARDS" : progress.lt(band.neg()) ? "AWAY" : "FLAT";
}

/** Instrument comparability (§6.6.1): 1.0 ≡ 1.1; a major change refuses comparison (409); a minor change warns. */
export function comparability(baseVersion: string, curVersion: string): "SAME" | "MINOR" | "MAJOR" {
  if (baseVersion.split(".")[0] !== curVersion.split(".")[0]) return "MAJOR";
  const eq = new Set(["1.0", "1.1"]);
  if (eq.has(baseVersion) && eq.has(curVersion)) return "SAME";
  return baseVersion !== curVersion ? "MINOR" : "SAME";
}

/** Retention schedule (§6.6.3): destruction 24 months after window close; notices at 90 and 30 days. */
export function retentionSchedule(windowClose: ISODate, months = cfg.get("retention.response_months") as number) {
  const [y, m, d] = windowClose.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12), nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  const destroyOn = `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
  return { destroy_on: destroyOn, notice_90: addDays(destroyOn, -90), notice_30: addDays(destroyOn, -30) };
}

/** What carries into the next cycle (Table 104). Pure shaping; persistence is the caller's. */
export function rolloverPlan<A extends { status: string }>(o: { setupSections: Record<string, unknown>; openActions: A[]; backlog: unknown[]; g5: { source: string }[] }) {
  return {
    setup: Object.fromEntries(Object.entries(o.setupSections).map(([k, v]) => [k, { payload: v, status: "DRAFT" }])),
    actions: o.openActions.filter((a) => !["CLOSED", "RETIRED", "DISCARDED"].includes(a.status)),
    backlog: o.backlog,
    g5: o.g5.filter((e) => e.source !== "SYSTEM"),   // system entries are recomputed from the new classification
  };
}
