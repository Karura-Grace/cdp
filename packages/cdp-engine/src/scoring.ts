/**
 * Stage 3 scoring (spec §3.5). Pure, deterministic, Decimal-only. No AI, randomness, clock or I/O.
 * Mirrors oracle/cdp_oracle/scoring.py; tests/oracle.test.ts proves byte-identical payload hashes.
 */
import { D, Decimal, q, mean, sum, ORIENTATIONS, DIMENSIONS_CS, LIKERT_DIMS, Orientation, Dimension, LikertDim, Profile } from "./num.js";
import * as cfg from "./config.js";
import { welchP } from "./stats.js";
import { payloadHash, toJsonable } from "./canonical.js";
import type { ResponseInput, ScoredResponse, CompletionState, QualityFlag, Perspective, EngineSetup, RaterInput, Allocation } from "./types.js";

const QUALITY_FLAGS: QualityFlag[] = ["SPEEDING", "STRAIGHT_LINING", "UNIFORM_ALLOCATION", "PERSPECTIVE_DUPLICATION"];

// ---------------------------------------------------------------- completion and quality (§2.6.3–2.6.4)

function sets(resp: ResponseInput, persp: Perspective): number {
  const a = resp.alloc?.[persp] ?? {};
  let n = 0;
  for (const d of DIMENSIONS_CS) for (const s of a[d] ?? []) if (s !== null && s !== undefined) n++;
  return n;
}

export function completionState(resp: ResponseInput): CompletionState {
  const nowSets = sets(resp, "NOW"), prefSets = sets(resp, "PREFERRED");
  const lik = resp.likert ?? {};
  const likertAll = LIKERT_DIMS.every((d) => (lik[d] ?? Array(12).fill(null)).every((v) => v !== null && v !== undefined)) &&
    LIKERT_DIMS.every((d) => (lik[d] ?? []).length === 12);
  const eos = resp.eos ?? [];
  const eosAll = eos.length === 8 && eos.every((v) => v !== null && v !== undefined);
  if (nowSets < 18) return "INSUFFICIENT";
  if (prefSets < 18) return "PARTIAL_CULTURE";
  if (likertAll && eosAll) return "COMPLETE";
  return "SUBSTANTIALLY_COMPLETE";
}

const sameAlloc = (a: Allocation | null | undefined, b: Allocation | null | undefined) => {
  if (!a || !b) return false;
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && (a as Record<string, number>)[k] === (b as Record<string, number>)[k]);
};
const truthyAlloc = (s: Allocation | null | undefined): s is Allocation => !!s && Object.keys(s).length > 0;

export function qualityFlags(resp: ResponseInput, medianDuration: Decimal | number | null): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const byMedian = D(medianDuration || 0).times(cfg.get("survey.speeding_median_fraction"));
  const minS = D(cfg.get("survey.speeding_min_seconds"));
  const thr = byMedian.gt(minS) ? byMedian : minS;
  if (resp.duration !== null && resp.duration !== undefined && D(resp.duration).lt(thr)) flags.push("SPEEDING");
  const vals: number[] = [];
  for (const d of LIKERT_DIMS) for (const v of resp.likert?.[d] ?? []) if (v !== null && v !== undefined) vals.push(v);
  if (vals.length && new Set(vals).size === 1) flags.push("STRAIGHT_LINING");
  const now = resp.alloc?.NOW ?? {};
  let uniform = 0;
  for (const d of DIMENSIONS_CS) for (const s of now[d] ?? []) if (truthyAlloc(s) && ORIENTATIONS.every((o) => s[o] === 25)) uniform++;
  if (uniform >= cfg.get("quality.uniform_min")) flags.push("UNIFORM_ALLOCATION");
  const pref = resp.alloc?.PREFERRED ?? {};
  let dup = 0;
  for (const d of DIMENSIONS_CS) {
    const ns = now[d] ?? [], ps = pref[d];
    ns.forEach((s, i) => { if (truthyAlloc(s) && ps && ps.length && i < ps.length && sameAlloc(ps[i], s)) dup++; });
  }
  if (dup >= cfg.get("quality.duplicate_min")) flags.push("PERSPECTIVE_DUPLICATION");
  return flags;
}

/** Completion state after quality exclusion → INSUFFICIENT. Rules 2.0: SPEEDING together with any other flag (D-10);
 *  rules 2.1: any two flags (V-02). */
export function classifyResponse(resp: ResponseInput, medianDuration: Decimal | number | null): [CompletionState, QualityFlag[]] {
  const flags = qualityFlags(resp, medianDuration);
  let state = completionState(resp);
  const anyTwo = cfg.get("quality.exclusion_rule") === "ANY_TWO";
  if (flags.length > 1 && (anyTwo || flags.includes("SPEEDING"))) state = "INSUFFICIENT";
  return [state, flags];
}

export type Purpose = "NOW" | "PREFERRED" | "DOMINANCE" | "LIKERT";
export function included(r: ScoredResponse, purpose: Purpose): boolean {
  const st = r._state, fl = r._flags;
  if (st === "INSUFFICIENT" || r.voided) return false;
  if (purpose === "NOW") return ["COMPLETE", "SUBSTANTIALLY_COMPLETE", "PARTIAL_CULTURE"].includes(st);
  if (purpose === "PREFERRED") return ["COMPLETE", "SUBSTANTIALLY_COMPLETE"].includes(st);
  if (purpose === "DOMINANCE") return ["COMPLETE", "SUBSTANTIALLY_COMPLETE", "PARTIAL_CULTURE"].includes(st) && !fl.includes("UNIFORM_ALLOCATION");
  if (purpose === "LIKERT") return !(fl.includes("STRAIGHT_LINING") && fl.includes("SPEEDING"));
  return true;
}

/** Median of active durations of COMPLETE responses (§2.5); integer when odd, exact Decimal mean of the middle pair when even. */
export function medianDuration(responses: ResponseInput[]): Decimal | number {
  const ds = responses.filter((r) => r.duration !== null && r.duration !== undefined && completionState(r) === "COMPLETE")
    .map((r) => r.duration as number).sort((a, b) => a - b);
  if (!ds.length) return 0;
  if (ds.length % 2 === 0) return D(ds[ds.length / 2 - 1]).plus(D(ds[ds.length / 2])).div(2);
  return ds[Math.floor(ds.length / 2)];
}

export function classifyAll(responses: ResponseInput[]): { scored: ScoredResponse[]; median: Decimal | number } {
  const median = medianDuration(responses);
  return { scored: responses.map((r) => { const [s, f] = classifyResponse(r, median); return { ...r, _state: s, _flags: f }; }), median };
}

// ---------------------------------------------------------------- orientation scores (§3.5.2)

export function orientationProfile(responses: ResponseInput[], persp: Perspective, dims: readonly Dimension[] = DIMENSIONS_CS): Profile | null {
  if (!responses.length) return null;
  const totals = Object.fromEntries(ORIENTATIONS.map((o) => [o, D(0)])) as Profile;
  let nSets = 0;
  for (const r of responses) {
    const a = r.alloc[persp]!;
    for (const d of dims) for (const s of a[d]!) {
      for (const o of ORIENTATIONS) totals[o] = totals[o].plus(D(s![o]));
      nSets++;
    }
  }
  return Object.fromEntries(ORIENTATIONS.map((o) => [o, q(totals[o].div(nSets), 2)])) as Profile;
}

export function respondentScore(r: ResponseInput, o: Orientation, persp: Perspective = "NOW"): Decimal {
  const a = r.alloc[persp]!;
  return sum(DIMENSIONS_CS.flatMap((d) => a[d]!.map((s) => D(s![o])))).div(18);
}

export function dimensionProfiles(responses: ResponseInput[], persp: Perspective): Record<Dimension, Profile> {
  return Object.fromEntries(DIMENSIONS_CS.map((d) => [d, orientationProfile(responses, persp, [d])])) as Record<Dimension, Profile>;
}

// ---------------------------------------------------------------- gap and classification (§3.5.3)

export type GapClass = "BUILD" | "STRENGTHEN" | "KEEP_AND_PROTECT" | "MODERATE";

export function gaps(now: Profile, pref: Profile): Profile {
  return Object.fromEntries(ORIENTATIONS.map((o) => [o, q(pref[o].minus(now[o]), 2)])) as Profile;
}

export function classifyGap(g: Decimal | number | string): GapClass {
  const v = D(g);
  if (v.gte(cfg.get("scoring.gap.build"))) return "BUILD";
  if (v.gte(cfg.get("scoring.gap.strengthen"))) return "STRENGTHEN";
  if (v.gt(cfg.get("scoring.gap.strengthen").neg())) return "KEEP_AND_PROTECT";
  return "MODERATE";
}

export const significant = (g: Decimal | number | string) => D(g).abs().gte(cfg.get("scoring.gap.build"));

// ---------------------------------------------------------------- dominance, strength, congruence, lenses (§3.5.4–3.5.7)

/** Orientations high → low; ties resolved by the fixed orientation order (never arbitrary). */
export function ranked(profile: Profile): Orientation[] {
  return [...ORIENTATIONS].sort((a, b) => {
    const c = profile[b].comparedTo(profile[a]);
    return c !== 0 ? c : ORIENTATIONS.indexOf(a) - ORIENTATIONS.indexOf(b);
  });
}

export interface Dominance { dominant: Orientation[]; secondary: Orientation; shared: boolean }
export function dominance(profile: Profile): Dominance {
  const r = ranked(profile);
  const shared = profile[r[0]].minus(profile[r[1]]).lt(cfg.get("scoring.dominance.shared_lt"));
  return { dominant: shared ? [r[0], r[1]] : [r[0]], secondary: r[1], shared };
}

/** Every orientation less than 1.0 above the minimum (mirrors shared dominance). */
export function lowest(profile: Profile): Orientation[] {
  const m = ORIENTATIONS.map((o) => profile[o]).reduce((a, b) => (b.lt(a) ? b : a));
  return ORIENTATIONS.filter((o) => profile[o].minus(m).lt(cfg.get("scoring.dominance.shared_lt")));
}

export type StrengthBand = "DIFFUSE" | "MODERATE" | "STRONG" | "HIGHLY_CONCENTRATED";
export function cultureStrength(profile: Profile): [Decimal, StrengthBand] {
  const mx = ORIENTATIONS.map((o) => profile[o]).reduce((a, b) => (b.gt(a) ? b : a));
  const s = q(mx.minus(25), 2);
  const [b1, b2, b3] = cfg.get("scoring.strength.bands");
  return [s, s.lt(b1) ? "DIFFUSE" : s.lt(b2) ? "MODERATE" : s.lt(b3) ? "STRONG" : "HIGHLY_CONCENTRATED"];
}

export const LENSES = { STRATEGY: ["D5", "D6"], PRACTICE: ["D1", "D3", "D4"], LEADERSHIP: ["D2"] } as const;
export type Lens = keyof typeof LENSES;

export function lensProfiles(dims: Record<Dimension, Profile>): Record<Lens, Profile> {
  return Object.fromEntries((Object.keys(LENSES) as Lens[]).map((L) => [L,
    Object.fromEntries(ORIENTATIONS.map((o) => [o, q(mean(LENSES[L].map((d) => dims[d][o]))!, 2)]))])) as Record<Lens, Profile>;
}

export type CongruenceBand = "HIGHLY_CONGRUENT" | "MODERATELY_CONGRUENT" | "FRAGMENTED";
export function congruence(org: Profile, dims: Record<Dimension, Profile>, lenses: Record<Lens, Profile>) {
  const orgDom = ranked(org)[0];
  const count = DIMENSIONS_CS.filter((d) => dominance(dims[d]).dominant.includes(orgDom)).length;
  const [hi, mid] = cfg.get("scoring.congruence.bands");
  const band: CongruenceBand = count >= hi ? "HIGHLY_CONGRUENT" : count >= mid ? "MODERATELY_CONGRUENT" : "FRAGMENTED";
  const lensDom = Object.fromEntries((Object.keys(lenses) as Lens[]).map((L) => [L, ranked(lenses[L])[0]])) as Record<Lens, Orientation>;
  const agreement = (Object.keys(lenses) as Lens[]).filter((L) => dominance(lenses[L]).dominant.includes(orgDom)).length;
  return { dimension_count: count, dimension_pct: q(D(count).div(D(6)).times(100), 1), band, lens: { ...lensDom, agreement } };
}

// ---------------------------------------------------------------- D7–D9 (§3.5.8)

export const READINESS_BANDS: Record<LikertDim, string[]> = {
  D7: ["Digitally resistant", "Digitally cautious", "Moderately ready", "Digitally capable", "Digitally advanced"],
  D8: ["Fear-based culture", "Cautious / selective candour", "Moderate safety", "Open culture", "Challenge culture: highly safe"],
  D9: ["Critical resistance", "Significant barriers", "Moderate readiness", "Good readiness", "Strong readiness"],
};

export function likertDimension(responses: ResponseInput[], dim: LikertDim): Decimal | null {
  const per: Decimal[] = [];
  for (const r of responses) {
    const vals = (r.likert?.[dim] ?? []).filter((v): v is number => v !== null && v !== undefined);
    if (vals.length >= cfg.get("scoring.likert.min_answered")) per.push(mean(vals)!);
  }
  return per.length ? q(mean(per)!, 4) : null;
}

/** Band index on the value rounded half-up to 1 dp (3.04 → 3.0 → band 2). */
export function readinessBandIndex(value: Decimal | number | string): number {
  const v = q(value, 1);
  const edges = cfg.get("scoring.readiness.band_edges");
  for (let i = 0; i < edges.length; i++) if (v.lte(edges[i])) return i;
  return 4;
}
export const readinessBand = (dim: LikertDim, value: Decimal) => READINESS_BANDS[dim][readinessBandIndex(value)];

export function cronbachAlpha(responses: ResponseInput[], dim: LikertDim): Decimal | null {
  const rows = responses.filter((r) => r.likert && dim in r.likert && r.likert[dim]!.every((v) => v !== null && v !== undefined))
    .map((r) => r.likert![dim] as number[]);
  if (rows.length < 3) return null;
  const k = rows[0].length;
  const variance = (xs: (number | Decimal)[]) => {
    const m = mean(xs)!;
    return sum(xs.map((x) => { const d = D(x).minus(m); return d.times(d); })).div(xs.length - 1);
  };
  let itemVar = D(0);
  for (let i = 0; i < k; i++) itemVar = itemVar.plus(variance(rows.map((row) => row[i])));
  const totalVar = variance(rows.map((row) => row.reduce((a, b) => a + b, 0)));
  if (totalVar.isZero()) return null;
  return q(D(k).div(D(k - 1)).times(D(1).minus(itemVar.div(totalVar))), 2);
}

// ---------------------------------------------------------------- eOS (§3.5.9)

export function eosCategory(values: (number | null | undefined)[]): number | null {
  const vals = values.filter((v): v is number => v !== null && v !== undefined);
  if (!vals.length) return null;
  const adv = vals.filter((v) => v >= cfg.get("scoring.eos.advocate_min")).length;
  const crit = vals.filter((v) => v <= cfg.get("scoring.eos.critic_max")).length;
  return q(D(100).times(D(adv - crit)).div(D(vals.length)), 0).toNumber();
}

export type EosBand = "NEGATIVE" | "ACCEPTABLE" | "GOOD" | "EXCELLENT";
export const eosBand = (s: number): EosBand => {
  const [e0, e1, e2] = cfg.get("scoring.eos.band_edges");
  return s < e0 ? "NEGATIVE" : s <= e1 ? "ACCEPTABLE" : s <= e2 ? "GOOD" : "EXCELLENT";
};

/** eOS routing (spec Table 48): where a weak category is most likely to be moved. A routing suggestion, not a diagnosis: read it with D1 to D9.
 *  Q2 routes to the leadership target orientation, so it is passed in. secondary is an orientation, "ALL" (Q1) or the note's orientation. */
export const EOS_ROUTING: Record<string, { primary: Orientation | "TARGET"; secondary: Orientation | "ALL"; why: string }> = {
  Q1: { primary: "ENGAGE", secondary: "ALL", why: "overall health" }, Q2: { primary: "TARGET", secondary: "ENGAGE", why: "quality of leadership" },
  Q3: { primary: "INNOVATE", secondary: "ENGAGE", why: "safety" }, Q4: { primary: "ENGAGE", secondary: "GOVERN", why: "fair processes" },
  Q5: { primary: "ENGAGE", secondary: "GOVERN", why: "transparency" }, Q6: { primary: "ENGAGE", secondary: "PERFORM", why: "moderate pace" },
  Q7: { primary: "ENGAGE", secondary: "GOVERN", why: "consistent standards" }, Q8: { primary: "PERFORM", secondary: "GOVERN", why: "role clarity" },
};
export function eosRoute(category: string, target: Orientation | null): { primary: Orientation | null; secondary: Orientation | "ALL"; why: string } | null {
  const r = EOS_ROUTING[category];
  return r ? { primary: r.primary === "TARGET" ? target : r.primary, secondary: r.secondary, why: r.why } : null;
}

export function eosScores(responses: ResponseInput[]): [Record<string, number | null>, Decimal | null] {
  const cats: Record<string, number | null> = {};
  for (let i = 0; i < 8; i++) cats[`Q${i + 1}`] = eosCategory(responses.filter((r) => (r.eos ?? []).length > i).map((r) => r.eos![i]));
  const valid = Object.values(cats).filter((v): v is number => v !== null);
  return [cats, valid.length ? q(mean(valid)!, 1) : null];
}

// ---------------------------------------------------------------- TPS (§3.5.11)

export function laInstrument(d2NowTarget: Decimal | number | string, target: Orientation): Decimal {
  const r = D(d2NowTarget).div(cfg.SINGLE_THRESHOLD[target]);
  return D(1).plus(D(4).times(r.lt(1) ? r : D(1)));
}

export function leadershipAlignment(coverage: Decimal | number | string, lriWeighted: Decimal | number | string | null, laInstr: Decimal): Decimal {
  const c = D(coverage);
  if (c.isZero()) return q(laInstr, 4);
  return q(c.times(D(lriWeighted!)).plus(D(1).minus(c).times(laInstr)), 4);
}

export function tps(d7: Decimal | number | string, d8: Decimal | number | string, d9: Decimal | number | string, la: Decimal | number | string): Decimal {
  const [w9, w8, wla, w7] = cfg.get("scoring.tps.weights");
  return w9.times(D(d9)).plus(w8.times(D(d8))).plus(wla.times(D(la))).plus(w7.times(D(d7)));
}

export type Band15 = "HIGH_RISK" | "ENABLEMENT_REQUIRED" | "TARGETED_SUPPORT" | "STRONG_READINESS";
/** TPS and LRI share band edges; banded on the 2 dp value. */
export function band15(value: Decimal | number | string): Band15 {
  const [b1, b2, b3] = cfg.get("scoring.tps.bands");
  const v = q(value, 2);
  return v.lt(b1) ? "HIGH_RISK" : v.lt(b2) ? "ENABLEMENT_REQUIRED" : v.lt(b3) ? "TARGETED_SUPPORT" : "STRONG_READINESS";
}
export const LRI_BANDS: Record<Band15, string> = { HIGH_RISK: "HIGH_RISK", ENABLEMENT_REQUIRED: "ENABLEMENT_REQUIRED", TARGETED_SUPPORT: "READY_WITH_SUPPORT", STRONG_READINESS: "STRONG" };

export function priorityCap(tpsValue: Decimal | number | string): number {
  const [c1, c2, c3] = cfg.get("plan.priority_caps");
  const b = band15(tpsValue);
  return b === "HIGH_RISK" ? c1 : b === "ENABLEMENT_REQUIRED" ? c2 : c3;
}

// ---------------------------------------------------------------- segments (§3.5.12)

export function perceptionGap(exec: Profile, staff: Profile): Profile {
  return Object.fromEntries(ORIENTATIONS.map((o) => [o, q(exec[o].minus(staff[o]).abs(), 2)])) as Profile;
}

export type PerceptionFlag = "NONE" | "WATCH" | "SHADOW_CULTURE";
export function perceptionFlag(g: Decimal | number | string): PerceptionFlag {
  const [w, s] = cfg.get("segments.perception");
  const v = D(g);
  return v.gt(s) ? "SHADOW_CULTURE" : v.gt(w) ? "WATCH" : "NONE";
}

export function sdi(seg: Profile, org: Profile): Decimal {
  return q(sum(ORIENTATIONS.map((o) => seg[o].minus(org[o]).abs())).div(D(2)), 2);
}

export interface SubcultureResult {
  divergent: Orientation[]; sdi: Decimal; profile_divergence: boolean; dominance_divergence: boolean;
  significance: "CONFIRMED" | "INDICATIVE"; is_subculture: boolean; capacity_subculture: boolean; p_values: Partial<Record<Orientation, number | null>>;
}

export function subculture(seg: ResponseInput[], rest: ResponseInput[], segProfile: Profile, orgProfile: Profile,
  segD8: Decimal | null = null, orgD8: Decimal | null = null, segD9: Decimal | null = null, orgD9: Decimal | null = null): SubcultureResult {
  const divergent = ORIENTATIONS.filter((o) => segProfile[o].minus(orgProfile[o]).abs().gte(cfg.get("segments.single_divergence")));
  const s = sdi(segProfile, orgProfile);
  const segDom = dominance(segProfile), orgDom = dominance(orgProfile);
  const profileDiv = s.gte(cfg.get("segments.sdi_candidate"));
  const domDiv = !segDom.shared && !orgDom.dominant.includes(segDom.dominant[0]);
  const tested: Orientation[] = divergent.length ? divergent : domDiv ? [segDom.dominant[0]] : [];
  let confirmed = false;
  const p_values: Partial<Record<Orientation, number | null>> = {};
  const floor = cfg.get("segments.floor");
  if (seg.length >= floor && rest.length >= floor) {
    for (const o of tested) {
      const p = welchP(seg.map((r) => respondentScore(r, o).toNumber()), rest.map((r) => respondentScore(r, o).toNumber()));
      p_values[o] = p;
      if (p !== null && p < cfg.get("segments.significance_alpha").toNumber()) confirmed = true;
    }
  }
  const rd = cfg.get("segments.readiness_divergence");
  const capacity = ([[segD8, orgD8], [segD9, orgD9]] as const).some(([x, y]) => x !== null && y !== null && x.minus(y).abs().gte(rd));
  return { divergent, sdi: s, profile_divergence: profileDiv, dominance_divergence: domDiv, significance: confirmed ? "CONFIRMED" : "INDICATIVE",
    is_subculture: (profileDiv || domDiv) && confirmed, capacity_subculture: capacity, p_values };
}

// ---------------------------------------------------------------- Leadership 360 (§3.5.10)

export const SECTION_KEYS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export type Section = (typeof SECTION_KEYS)[number];
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
export const SECTIONS: Record<Section, number[]> = { A: range(0, 10), B: range(10, 20), C: range(20, 30), D: range(30, 40),
  E: range(40, 45), F: range(45, 50), G: range(50, 55), H: range(55, 60) };
export const SECTION_OF: Record<Orientation, Section> = { ENGAGE: "A", INNOVATE: "B", PERFORM: "C", GOVERN: "D" };
export const ORIENT_OF: Record<string, Orientation> = { A: "ENGAGE", B: "INNOVATE", C: "PERFORM", D: "GOVERN" };

/** Rater section mean; null when fewer than 60% of the section's items were observed (D-16), or under rules 2.1 fewer than
 *  three observed items (V-05). */
export function sectionAvg(ratings: (number | null)[], sec: Section): Decimal | null {
  const idx = SECTIONS[sec];
  const vals = idx.map((i) => ratings[i]).filter((v): v is number => v !== null && v !== undefined);
  const items = cfg.get("scoring.360.min_observed_items");
  if (D(vals.length).lt(items !== null ? D(items) : cfg.get("scoring.360.min_observed").times(D(idx.length)))) return null;
  return mean(vals);
}

export type SectionMap = Record<Section, Decimal | null>;
export interface LeaderReadings {
  self_avg: SectionMap; other_avg: SectionMap; default: Orientation[]; growth: Orientation; range: boolean; flags: string[];
  self_other: Partial<Record<Section, { gap: Decimal; tier: "ALIGNED" | "WATCH" | "BLIND_SPOT" }>>; lri: Decimal; lri_band: string;
}
export interface LeaderResult extends Partial<LeaderReadings> {
  valid: boolean; rater_count: number; groups_published?: string[]; assignment_id?: string; headcount_led?: number; invalid_reason?: string;
}

export function computeLeaderReadings(selfAvg: SectionMap, other: SectionMap, target: Orientation): LeaderReadings {
  const ad = { A: other.A!, B: other.B!, C: other.C!, D: other.D! };
  const abcd = ["A", "B", "C", "D"] as const;
  const order = [...abcd].sort((x, y) => { const c = ad[y].comparedTo(ad[x]); return c !== 0 ? c : abcd.indexOf(x) - abcd.indexOf(y); });
  const def: Orientation[] = [ORIENT_OF[order[0]]];
  if (ad[order[0]].minus(ad[order[1]]).lt(cfg.get("scoring.360.default_shared_lt"))) def.push(ORIENT_OF[order[1]]);
  const growth = ORIENT_OF[[...abcd].sort((x, y) => { const c = ad[x].comparedTo(ad[y]); return c !== 0 ? c : abcd.indexOf(x) - abcd.indexOf(y); })[0]];
  const vals = abcd.map((s) => ad[s]);
  const mx = vals.reduce((a, b) => (b.gt(a) ? b : a)), mn = vals.reduce((a, b) => (b.lt(a) ? b : a));
  const rng = mx.minus(mn).lt(cfg.get("scoring.360.range_lt"));
  const flags: string[] = [];
  if (other.E!.lt(cfg.get("scoring.360.flag.integrity_lt"))) flags.push("INTEGRITY");
  if (other.F!.lt(cfg.get("scoring.360.flag.safety_lt"))) flags.push("SAFETY");
  if (other.H!.lt(cfg.get("scoring.360.flag.change_lt"))) flags.push("CHANGE_CAPACITY");
  const [w, b] = cfg.get("scoring.360.gap_tiers");
  const selfOther: LeaderReadings["self_other"] = {};
  for (const s of Object.keys(selfAvg) as Section[]) {
    if (selfAvg[s] === null || other[s] === null || selfAvg[s] === undefined || other[s] === undefined) continue;
    const g = q(selfAvg[s]!.minus(other[s]!), 2);
    selfOther[s] = { gap: g, tier: g.abs().gt(b) ? "BLIND_SPOT" : g.abs().gt(w) ? "WATCH" : "ALIGNED" };
  }
  const lw = cfg.get("scoring.lri.weights");
  const lri = q(lw[0].times(other.H!).plus(lw[1].times(other.F!)).plus(lw[2].times(other[SECTION_OF[target]]!)).plus(lw[3].times(other.G!)), 4);
  return { self_avg: selfAvg, other_avg: other, default: def, growth, range: rng, flags, self_other: selfOther, lri, lri_band: LRI_BANDS[band15(lri)] };
}

/** Score one leader's 360 (§3.5.10). Raters carry no identity; groups below 3 merge (SUPERIOR always merges). */
export function scoreLeader(selfRatings: (number | null)[] | null, raters: RaterInput[], target: Orientation): LeaderResult {
  const mr = cfg.get("scoring.360.min_raters");
  const result: LeaderResult = { valid: raters.length >= mr && selfRatings !== null && selfRatings !== undefined, rater_count: raters.length };
  if (!result.valid) return result;
  const groups = new Map<string, RaterInput[]>();
  for (const r of raters) { if (!groups.has(r.group)) groups.set(r.group, []); groups.get(r.group)!.push(r); }
  const published = new Map<string, RaterInput[]>();
  const merged: RaterInput[] = [];
  for (const [g, rs] of groups) { if (g !== "SUPERIOR" && rs.length >= mr) published.set(g, rs); else merged.push(...rs); }
  if (merged.length) {
    if (merged.length >= mr) published.set("ALL_OTHERS", merged);
    else { if (!published.has("_FOLDED")) published.set("_FOLDED", []); published.get("_FOLDED")!.push(...merged); }
  }
  const groupAvg = new Map<string, SectionMap>();
  for (const [g, rs] of published) {
    const m = {} as SectionMap;
    for (const sec of SECTION_KEYS) {
      const vals = rs.map((r) => sectionAvg(r.ratings, sec)).filter((v): v is Decimal => v !== null);
      m[sec] = vals.length ? mean(vals) : null;
    }
    groupAvg.set(g, m);
  }
  const other = {} as SectionMap;
  for (const sec of SECTION_KEYS) {
    const vals = [...groupAvg.values()].map((m) => m[sec]).filter((v): v is Decimal => v !== null);
    other[sec] = vals.length ? q(mean(vals)!, 4) : null;
  }
  if (SECTION_KEYS.some((s) => other[s] === null)) {
    return { ...result, valid: false, invalid_reason: "INSUFFICIENT_OBSERVATIONS" };
  }
  const selfAvg = Object.fromEntries(SECTION_KEYS.map((s) => [s, q(mean(SECTIONS[s].map((i) => selfRatings![i] as number))!, 4)])) as SectionMap;
  return { ...result, ...computeLeaderReadings(selfAvg, other, target), groups_published: [...groupAvg.keys()].filter((g) => g !== "_FOLDED").sort() };
}

/** Strongest and weakest behaviours as raters see them: the mean of observed rater ratings per item (1 to 60), items observed by at
 *  least the rater floor only, ranked high to low with ties by item order; self rating beside each. Read time only, never in the payload. */
export function leaderHighlights(selfRatings: (number | null)[] | null, raters: RaterInput[], n = 5) {
  const mr = cfg.get("scoring.360.min_raters");
  if (raters.length < mr) return null;
  const items = Array.from({ length: 60 }, (_, i) => {
    const vals = raters.map((r) => r.ratings[i]).filter((v): v is number => v !== null && v !== undefined);
    return { item: i + 1, others: vals.length >= mr ? q(mean(vals)!, 2) : null, observed: vals.length, self: selfRatings?.[i] ?? null };
  }).filter((x): x is { item: number; others: Decimal; observed: number; self: number | null } => x.others !== null);
  const high = [...items].sort((a, b) => { const c = b.others.comparedTo(a.others); return c !== 0 ? c : a.item - b.item; });
  const low = [...items].sort((a, b) => { const c = a.others.comparedTo(b.others); return c !== 0 ? c : a.item - b.item; });
  return { top: high.slice(0, n), bottom: low.slice(0, n) };
}

// ---------------------------------------------------------------- leader–culture link (§3.5.13)

export function leaderProfile(other: SectionMap): Profile {
  const tot = sum((["A", "B", "C", "D"] as const).map((s) => other[s]!));
  return Object.fromEntries(ORIENTATIONS.map((o) => [o, other[SECTION_OF[o]]!.div(tot).times(D(100))])) as Profile;
}

export function fitIndex(lp: Profile, teamNow: Profile): Decimal {
  return q(D(100).minus(sum(ORIENTATIONS.map((o) => lp[o].minus(teamNow[o]).abs())).div(D(2))), 2);
}

export type FitBand = "MIRRORED" | "ALIGNED" | "DIVERGENT" | "COUNTER_CULTURAL";
export function fitBand(f: Decimal): FitBand {
  const [b1, b2, b3] = cfg.get("leaders.fit_bands");
  return f.gte(b1) ? "MIRRORED" : f.gte(b2) ? "ALIGNED" : f.gte(b3) ? "DIVERGENT" : "COUNTER_CULTURAL";
}

export type CarrierClass = "CRITICAL_BLOCKER" | "CULTURE_BLOCKER" | "LAGGING" | "CULTURE_CARRIER" | "EMERGING_CARRIER" | "NEUTRAL";
/** Exhaustive carrier/blocker classification, evaluated top-down, first match wins (Table 56). */
export function carrierClass(leadTarget: Decimal | number | string, orgTarget: Decimal | number | string, flags: string[], lri: Decimal | number | string,
  defaultOrients: Orientation[], classes: Partial<Record<Orientation, GapClass>>): CarrierClass {
  const m = cfg.get("leaders.carrier_margin");
  const low = D(leadTarget).lte(D(orgTarget).minus(m));
  const high = D(leadTarget).gte(D(orgTarget).plus(m));
  const hard = flags.some((f) => f === "INTEGRITY" || f === "SAFETY");
  if (low && (hard || band15(lri) === "HIGH_RISK")) return "CRITICAL_BLOCKER";
  if (low && defaultOrients.some((o) => classes[o] === "MODERATE")) return "CULTURE_BLOCKER";
  if (low) return "LAGGING";
  if (high && !hard && q(lri, 2).gte(cfg.get("leaders.carrier_lri_min"))) return "CULTURE_CARRIER";
  if (high) return "EMERGING_CARRIER";
  return "NEUTRAL";
}

// ---------------------------------------------------------------- analytics from the PAC reference platform (CDP v6)
// Reading aids and indices beside the spec measures. Thresholds in config "analytics.*". See docs/REFERENCE_REVIEW_2026-10.md.

export type GapBand = "LOW" | "MODERATE" | "SIGNIFICANT" | "CRITICAL";
/** Plain reading band of a NOW to PREFERRED gap on its absolute size: under 4, 4 to 8, over 8, 16 and over. */
export function gapBand(g: Decimal | number | string): GapBand {
  const v = D(g).abs(), [m, s, c] = cfg.get("analytics.gap_bands");
  return v.gte(c) ? "CRITICAL" : v.gt(s) ? "SIGNIFICANT" : v.gte(m) ? "MODERATE" : "LOW";
}

export type Level4 = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
/** Cultural entropy: the mean absolute gap between NOW and PREFERRED, in points. */
export function entropy(gap: Profile): { score: Decimal; band: Level4 } {
  const score = q(mean(ORIENTATIONS.map((o) => gap[o].abs()))!, 2);
  const [m, h, c] = cfg.get("analytics.entropy_bands");
  return { score, band: score.gte(c) ? "CRITICAL" : score.gte(h) ? "HIGH" : score.gte(m) ? "MODERATE" : "LOW" };
}

function sampleSd(xs: Decimal[]): Decimal {
  const m = mean(xs)!;
  return sum(xs.map((x) => x.minus(m).times(x.minus(m)))).div(xs.length - 1).sqrt();
}

/** Spread of answers: per dimension and orientation, the sample standard deviation across respondents of their NOW points
 *  (each respondent's mean over the dimension's three scenarios). null below two respondents. */
export function dispersion(responses: ResponseInput[]): { dims: Record<Dimension, Record<Orientation | "avg", Decimal>>; overall: Decimal; raw: Decimal } | null {
  if (responses.length < 2) return null;
  const dims = {} as Record<Dimension, Record<Orientation | "avg", Decimal>>;
  const avgs: Decimal[] = [];
  for (const d of DIMENSIONS_CS) {
    const sds = ORIENTATIONS.map((o) => sampleSd(responses.map((r) => mean(r.alloc.NOW![d]!.map((x) => D(x![o])))!)));
    const avg = mean(sds)!;
    avgs.push(avg);
    dims[d] = { ...(Object.fromEntries(ORIENTATIONS.map((o, i) => [o, q(sds[i], 2)])) as Record<Orientation, Decimal>), avg: q(avg, 2) };
  }
  const raw = mean(avgs)!;
  return { dims, overall: q(raw, 2), raw };
}

export interface Tension { pair: "ENGAGE_PERFORM" | "INNOVATE_GOVERN"; a: Orientation; b: Orientation; score: Decimal; band: "LOW" | "MODERATE" | "HIGH" }
/** Tension between competing orientations, 0 to 10: high when people want one to grow while its opposite shrinks. */
export function tensions(gap: Profile): Tension[] {
  const [mod, high] = cfg.get("analytics.tension.bands");
  const pair = (a: Orientation, b: Orientation, name: Tension["pair"]): Tension => {
    const ga = gap[a], gb = gap[b];
    const raw = ga.abs().plus(gb.abs()).div(ga.gt(0) !== gb.gt(0) ? 1 : 2).times(cfg.get("analytics.tension.factor"));
    const score = q(Decimal.min(Decimal.max(raw, 0), 10), 1);
    return { pair: name, a, b, score, band: score.gte(high) ? "HIGH" : score.gte(mod) ? "MODERATE" : "LOW" };
  };
  return [pair("ENGAGE", "PERFORM", "ENGAGE_PERFORM"), pair("INNOVATE", "GOVERN", "INNOVATE_GOVERN")];
}

/** Culture Risk Index, 0 to 100: gap pressure, answer spread and executive to staff distance, each scaled to 100 and weighted.
 *  A PAC heuristic for prioritisation, not a benchmark. Misalignment falls back to a default when the perception gap is not computed. */
export function cultureRisk(gap: Profile, disp: Decimal | null, perception: Profile | null) {
  if (disp === null) return null;
  const [wg, wd, wm] = cfg.get("analytics.risk.weights"), [sg, sd, sm] = cfg.get("analytics.risk.scale"), [lo, mid] = cfg.get("analytics.risk.bands");
  const clamp = (x: Decimal) => Decimal.min(Decimal.max(x, 0), 100);
  const mis = perception ? mean(ORIENTATIONS.map((o) => perception[o]))! : cfg.get("analytics.risk.misalignment_default");
  const g = clamp(mean(ORIENTATIONS.map((o) => gap[o].abs()))!.div(sg).times(100)), d = clamp(disp.div(sd).times(100)), m = clamp(mis.div(sm).times(100));
  const index = q(g.times(wg).plus(d.times(wd)).plus(m.times(wm)), 0);
  return { index, band: index.lt(lo) ? "LOW" : index.lt(mid) ? "MEDIUM" : "HIGH", gap: q(g, 0), dispersion: q(d, 0), misalignment: q(m, 0),
    misalignment_source: perception ? "PERCEPTION_GAP" : "DEFAULT" };
}

/** Values against reality: the culture people describe as its character (D1, espoused) against what holds it together and
 *  how success is rewarded (mean of D4 and D6, lived), per orientation. Read from the frozen dimension_now. */
export function valuesReality(dimsNow: Record<Dimension, Profile | Record<Orientation, Decimal | string>>): Record<Orientation, { espoused: Decimal; lived: Decimal; delta: Decimal }> {
  return Object.fromEntries(ORIENTATIONS.map((o) => {
    const esp = D(dimsNow.D1[o]), lived = D(dimsNow.D4[o]).plus(D(dimsNow.D6[o])).div(2);
    return [o, { espoused: q(esp, 2), lived: q(lived, 2), delta: q(lived.minus(esp), 2) }];
  })) as Record<Orientation, { espoused: Decimal; lived: Decimal; delta: Decimal }>;
}

/** Employee voice per question: how many scored as promoters (advocate_min and above), passives, and detractors (critic_max and below). */
export function eosDetail(responses: ResponseInput[]): Record<string, { promoters: number; passives: number; detractors: number; n: number }> {
  const adv = cfg.get("scoring.eos.advocate_min"), crit = cfg.get("scoring.eos.critic_max");
  return Object.fromEntries(Array.from({ length: 8 }, (_, i) => {
    const vals = responses.map((r) => r.eos?.[i]).filter((v): v is number => v !== null && v !== undefined);
    const promoters = vals.filter((v) => v >= adv).length, detractors = vals.filter((v) => v <= crit).length;
    return [`Q${i + 1}`, { promoters, passives: vals.length - promoters - detractors, detractors, n: vals.length }];
  }));
}

/** Readiness statements: the mean of each of the 12 items per D7, D8, D9, for items answered by at least the reporting floor. */
export function readinessItems(responses: ResponseInput[]): Record<LikertDim, (Decimal | null)[]> {
  const floor = cfg.get("segments.floor");
  return Object.fromEntries(LIKERT_DIMS.map((d) => [d, Array.from({ length: 12 }, (_, i) => {
    const vals = responses.map((r) => r.likert?.[d]?.[i]).filter((v): v is number => v !== null && v !== undefined);
    return vals.length >= floor ? q(mean(vals)!, 2) : null;
  })])) as Record<LikertDim, (Decimal | null)[]>;
}

export function analytics(gap: Profile, responsesNow: ResponseInput[], perception: Profile | null) {
  const disp = dispersion(responsesNow);
  return {
    gap_bands: Object.fromEntries(ORIENTATIONS.map((o) => [o, gapBand(gap[o])])) as Record<Orientation, GapBand>,
    entropy: entropy(gap), tensions: tensions(gap),
    dispersion: disp ? { ...disp.dims, overall: disp.overall } : null,
    risk: cultureRisk(gap, disp ? disp.raw : null, perception),
  };
}

// ---------------------------------------------------------------- full assessment (§3.7)

export interface ScoreObject {
  [k: string]: unknown;
  orientation_scores: { now: Profile; preferred: Profile; gap: Profile };
  classification: Record<Orientation, GapClass>;
  significant: Record<Orientation, boolean>;
  dominance: Dominance;
  culture_strength: Decimal;
  strength_band: StrengthBand;
  dimension_now: Record<Dimension, Profile>;
  readiness: {
    d7: Decimal | null; d8: Decimal | null; d9: Decimal | null; coverage: Decimal; leadership_alignment: Decimal;
    tps: Decimal | null; tps_band: Band15 | null; provisional: boolean; [k: string]: unknown;
  };
  eos: Record<string, number | null | Decimal> & { index: Decimal | null };
  perception_gap: Profile | null;
  perception_flags: Record<Orientation, PerceptionFlag> | null;
}

/**
 * Compute the score object from a frozen response set. Returns the object (Decimals), its canonical JSON
 * payload and the payload hash. Re-running on the same input returns a byte-identical payload (UT-36).
 * Payload versions, so scores frozen earlier still reproduce their hash: 1 = original (also opts.analytics false), 2 = with the
 * analytics block (October 2026), 3 = also dimension_preferred, eos_detail and readiness_items (default).
 */
export function scoreAssessment(responses: ResponseInput[], setup: Pick<EngineSetup, "leadership_target_orientation">,
  leaderResults: LeaderResult[] = [], leadersInScope: { headcount_led: number }[] = [], opts: { analytics?: boolean; version?: 1 | 2 | 3 } = {}):
  { obj: ScoreObject; payload: Record<string, unknown>; hash: string; scored: ScoredResponse[] } {
  const version = opts.analytics === false ? 1 : opts.version ?? 3;
  const { scored, median } = classifyAll(responses);
  const Rnow = scored.filter((r) => included(r, "NOW"));
  const Rpref = scored.filter((r) => included(r, "PREFERRED"));
  const Rdom = scored.filter((r) => included(r, "DOMINANCE"));
  const Rlik = Rnow.filter((r) => included(r, "LIKERT"));
  if (!Rnow.length || !Rpref.length) throw new Error("INSUFFICIENT_DATA: at least one complete culture response is required to score");

  const now = orientationProfile(Rnow, "NOW")!;
  const pref = orientationProfile(Rpref, "PREFERRED")!;
  const g = gaps(orientationProfile(Rpref, "NOW")!, pref);
  const classes = Object.fromEntries(ORIENTATIONS.map((o) => [o, classifyGap(g[o])])) as Record<Orientation, GapClass>;
  const dimsNow = dimensionProfiles(Rnow, "NOW");
  const domProfile = orientationProfile(Rdom, "NOW") ?? now;
  const dom = dominance(domProfile);
  const [strength, sband] = cultureStrength(domProfile);
  const lenses = lensProfiles(dimsNow);
  const cong = congruence(domProfile, Rdom.length ? dimensionProfiles(Rdom, "NOW") : dimsNow, lenses);

  const d = { D7: likertDimension(Rlik, "D7"), D8: likertDimension(Rlik, "D8"), D9: likertDimension(Rlik, "D9") };
  const target = setup.leadership_target_orientation;
  const tot = sum(leadersInScope.map((l) => D(l.headcount_led)));
  const valid = leaderResults.filter((l) => l.valid);
  const validHc = sum(valid.map((l) => D(l.headcount_led ?? 0)));
  const cov = tot.isZero() ? D(0) : validHc.div(tot);
  const lriW = valid.length ? sum(valid.map((l) => D(l.lri!).times(D(l.headcount_led ?? 0)))).div(validHc) : null;
  const laI = laInstrument(dimsNow.D2[target], target);
  const la = leadershipAlignment(cov, lriW, laI);
  const tpsRaw = d.D7 !== null && d.D8 !== null && d.D9 !== null ? tps(d.D7, d.D8, d.D9, la) : null;

  const [eos, eosIdx] = eosScores(Rnow.filter((r) => (r.eos ?? []).length > 0));
  const floor = cfg.get("segments.floor");
  const execs = Rnow.filter((r) => r.snapshot?.is_executive);
  const staff = Rnow.filter((r) => !r.snapshot?.is_executive);
  let cohorts: Record<string, unknown> = {};
  let pg: Profile | null = null;
  let pgReason: string | null = null;
  if (execs.length < floor) pgReason = "EXECUTIVE_COHORT_BELOW_FLOOR";
  else if (staff.length < floor) pgReason = "STAFF_COHORT_BELOW_FLOOR";
  if (execs.length >= floor && staff.length >= floor) {
    const ep = orientationProfile(execs, "NOW")!, sp = orientationProfile(staff, "NOW")!;
    cohorts = { executive: { n: execs.length, now: ep }, staff: { n: staff.length, now: sp } };
    pg = perceptionGap(ep, sp);
  }
  const states: Record<string, number> = {};
  for (const r of scored) states[r._state] = (states[r._state] ?? 0) + 1;
  const sortedLeaders = [...leaderResults].sort((a, b) => (String(a.assignment_id ?? "") < String(b.assignment_id ?? "") ? -1 : String(a.assignment_id ?? "") > String(b.assignment_id ?? "") ? 1 : 0));

  const obj: ScoreObject = {
    instrument_version: cfg.INSTRUMENT_VERSION, rules_version: cfg.rulesVersion(),
    orientation_scores: { now, preferred: pref, gap: g },
    classification: classes, significant: Object.fromEntries(ORIENTATIONS.map((o) => [o, significant(g[o])])) as Record<Orientation, boolean>,
    dominance: dom, culture_strength: strength, strength_band: sband, congruence: cong,
    dimension_now: dimsNow, lenses_now: lenses,
    readiness: {
      d7: d.D7, d8: d.D8, d9: d.D9,
      d7_band: d.D7 && !d.D7.isZero() ? readinessBand("D7", d.D7) : null,
      d8_band: d.D8 && !d.D8.isZero() ? readinessBand("D8", d.D8) : null,
      d9_band: d.D9 && !d.D9.isZero() ? readinessBand("D9", d.D9) : null,
      coverage: q(cov, 4), leadership_alignment: la,
      leadership_alignment_source: cov.isZero() ? "INSTRUMENT_TERM_ONLY" : "BLENDED",
      tps: tpsRaw !== null ? q(tpsRaw, 2) : null,
      tps_band: tpsRaw !== null ? band15(tpsRaw) : null,
      provisional: cov.lt(cfg.get("scoring.tps.provisional_coverage_lt")),
      alpha: { D7: cronbachAlpha(Rlik, "D7"), D8: cronbachAlpha(Rlik, "D8"), D9: cronbachAlpha(Rlik, "D9") },
    },
    eos: { ...eos, index: eosIdx },
    cohorts, perception_gap: pg,
    perception_flags: pg ? (Object.fromEntries(ORIENTATIONS.map((o) => [o, perceptionFlag(pg![o])])) as Record<Orientation, PerceptionFlag>) : null,
    perception_not_computed_reason: pgReason,
    leader_results: sortedLeaders,
    quality: { states, median_duration: median,
      flags: Object.fromEntries(QUALITY_FLAGS.map((f) => [f, scored.filter((r) => r._flags.includes(f)).length])) },
    counts: { now: Rnow.length, preferred: Rpref.length },
    ...(version >= 2 ? { analytics: analytics(g, Rnow, pg) } : {}),
    ...(version >= 3 ? { dimension_preferred: dimensionProfiles(Rpref, "PREFERRED"), eos_detail: eosDetail(Rnow), readiness_items: readinessItems(Rlik) } : {}),
  };
  const payload = toJsonable(obj) as Record<string, unknown>;
  return { obj, payload, hash: payloadHash(payload), scored };
}

/** Score every leader in scope for a given leadership target orientation. */
export function scoreLeaders(leaders: { assignment_id: string; headcount_led: number; self: (number | null)[] | null; raters: RaterInput[] }[], target: Orientation): LeaderResult[] {
  return leaders.map((l) => ({ ...scoreLeader(l.self, l.raters, target), assignment_id: l.assignment_id, headcount_led: l.headcount_led }));
}
