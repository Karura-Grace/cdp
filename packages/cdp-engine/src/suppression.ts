/**
 * Anonymity floors, combination floor, differencing protection and roll-up (spec §2.6.5, §3.5.12, Table 54).
 * No role can lower these floors; callers return 409 BELOW_REPORTING_THRESHOLD, never an empty payload.
 */
import * as cfg from "./config.js";
import type { ResponseInput } from "./types.js";

export class Suppressed extends Error {
  constructor(public rule: string, public minimum: number, public rollup: { segment: Predicates; label?: string } | null = null) {
    super(`BELOW_REPORTING_THRESHOLD: ${rule} (minimum ${minimum})`);
  }
}
export type Predicates = Record<string, string | number | boolean>;

export function checkFloor(n: number, rule = "PRIMARY_FLOOR", rollup: Suppressed["rollup"] = null): void {
  const f = cfg.get("segments.floor");
  if (n < f) throw new Suppressed(rule, f, rollup);
}

/** children: {name: n} within a reported parent. Returns child segments that must be suppressed (UT-29). */
export function differencingSuppressed(parentN: number, children: Record<string, number>): Set<string> {
  const f = cfg.get("segments.floor");
  let out = new Set(Object.entries(children).filter(([, n]) => n < f).map(([c]) => c));
  const names = Object.keys(children);
  if (names.length === 2 && out.size) out = new Set(names);
  else if (out.size) {
    const residual = parentN - Object.entries(children).filter(([c]) => !out.has(c)).reduce((s, [, n]) => s + n, 0);
    if (residual > 0 && residual < f) out = new Set(names);
  }
  return out;
}

export const matches = (r: ResponseInput, p: Predicates) => Object.entries(p).every(([k, v]) => r.snapshot?.[k] === v);

/**
 * Resolve a (possibly multi-axis) segment against responses the metric uses. Suppressed → throws with the
 * nearest passing parent (predicates dropped right to left) as the roll-up (Table 54).
 */
export function resolveSegment<T extends ResponseInput>(responses: T[], predicates: Predicates, opts: { floor?: number } = {}): T[] {
  const f = opts.floor ?? cfg.get("segments.floor");
  const seg = responses.filter((r) => matches(r, predicates));
  if (seg.length >= f) return seg;
  const keys = Object.keys(predicates);
  let rollup: Suppressed["rollup"] = null;
  for (let i = keys.length - 1; i >= 0; i--) {
    const parent = Object.fromEntries(keys.slice(0, i).map((k) => [k, predicates[k]]));
    if (responses.filter((r) => matches(r, parent)).length >= f) { rollup = { segment: parent }; break; }
  }
  throw new Suppressed(keys.length > 1 ? "COMBINATION_FLOOR" : "PRIMARY_FLOOR", f, rollup);
}

/** Qualitative floor (§2.6.5): verbatims only with ≥ 8 valid qualitative responses; otherwise themes with counts. */
export const verbatimAllowed = (n: number) => n >= cfg.get("segments.qual_floor");

/** Response-rate visibility: cohorts with fewer than 5 invited people are never shown (AC-2.7). */
export const cohortVisible = (invited: number) => invited >= cfg.get("segments.floor");

/** 360 rater-group publication (Table 49): ≥ 3 raters, SUPERIOR always merges. */
export const raterGroupPublishable = (group: string, n: number) => group !== "SUPERIOR" && n >= cfg.get("scoring.360.min_raters");
