/**
 * Segment engine (spec §3.5.12–§3.5.13): permitted-segment metrics, perception gap, sub-culture tests,
 * heatmaps with differencing protection, and the leader–culture link. Every function takes the scored
 * (classified) response set and the frozen organisation score object; nothing here reads a database.
 */
import { D, Decimal, q, ORIENTATIONS, Orientation, Profile } from "./num.js";
import * as cfg from "./config.js";
import {
  included, orientationProfile, gaps, classifyGap, dimensionProfiles, likertDimension, eosScores, laInstrument, leadershipAlignment, tps, band15,
  subculture, sdi, dominance, leaderProfile, fitIndex, fitBand, carrierClass, ScoreObject, LeaderResult, GapClass, SubcultureResult,
} from "./scoring.js";
import { resolveSegment, differencingSuppressed, Predicates, Suppressed, matches } from "./suppression.js";
import type { ScoredResponse } from "./types.js";

export interface SegmentMetrics {
  predicates: Predicates; n: number; n_preferred: number;
  now: Profile; diff: Profile; sdi: Decimal; dominance: ReturnType<typeof dominance>;
  preferred: Profile | null; gap: Profile | null; classification: Record<Orientation, GapClass> | null;
  readiness: { d7: Decimal | null; d8: Decimal | null; d9: Decimal | null; tps: Decimal | null; tps_band: string | null; coverage: Decimal };
  eos: Record<string, number | null>; eos_index: Decimal | null; eos_negative: string[];
  subculture: SubcultureResult;
}

/**
 * Metrics for one permitted segment. Throws Suppressed (→ 409 BELOW_REPORTING_THRESHOLD) when the segment,
 * counted on the responses each metric uses, is below the floor. PREFERRED-based metrics are null, not
 * reported, when the PREFERRED subset alone falls below the floor.
 */
export function segmentMetrics(scored: ScoredResponse[], predicates: Predicates, org: ScoreObject, opts: { target?: Orientation;
  leaders?: (LeaderResult & { in_segment?: boolean })[]; leadersInScope?: { headcount_led: number; in_segment?: boolean }[] } = {}): SegmentMetrics {
  const leaders = opts.leaders ?? [], leadersInScope = opts.leadersInScope ?? [];
  const floor = cfg.get("segments.floor");
  const Rnow = scored.filter((r) => included(r, "NOW"));
  const seg = resolveSegment(Rnow, predicates);
  const rest = Rnow.filter((r) => !matches(r, predicates));
  const now = orientationProfile(seg, "NOW")!;
  const orgNow = org.orientation_scores.now;
  const segPref = seg.filter((r) => included(r, "PREFERRED"));
  let preferred: Profile | null = null, gap: Profile | null = null, classification: Record<Orientation, GapClass> | null = null;
  if (segPref.length >= floor) {
    preferred = orientationProfile(segPref, "PREFERRED")!;
    gap = gaps(orientationProfile(segPref, "NOW")!, preferred);
    classification = Object.fromEntries(ORIENTATIONS.map((o) => [o, classifyGap(gap![o])])) as Record<Orientation, GapClass>;
  }
  const lik = seg.filter((r) => included(r, "LIKERT"));
  const d7 = likertDimension(lik, "D7"), d8 = likertDimension(lik, "D8"), d9 = likertDimension(lik, "D9");
  // Segment TPS: segment D7–D9, segment D2 for the instrument term, coverage over leaders whose teams lie inside the segment.
  const target = opts.target;
  const scope = leadersInScope.filter((l) => l.in_segment);
  const tot = scope.reduce((s, l) => s.plus(l.headcount_led), D(0));
  const valid = leaders.filter((l) => l.valid && l.in_segment);
  const vhc = valid.reduce((s, l) => s.plus(l.headcount_led ?? 0), D(0));
  const cov = tot.isZero() ? D(0) : vhc.div(tot);
  let segTps: Decimal | null = null;
  if (target && d7 && d8 && d9) {
    const dims = dimensionProfiles(seg, "NOW");
    const lriW = valid.length ? valid.reduce((s, l) => s.plus(D(l.lri!).times(l.headcount_led ?? 0)), D(0)).div(vhc) : null;
    segTps = tps(d7, d8, d9, leadershipAlignment(cov, lriW, laInstrument(dims.D2[target], target)));
  }
  const [eos, eosIdx] = eosScores(seg.filter((r) => (r.eos ?? []).length > 0));
  const orgEos = org.eos as Record<string, unknown>;
  const eosNegative = Object.entries(eos).filter(([k, v]) => v !== null && v < 0 && !((orgEos[k] as number | null) !== null && (orgEos[k] as number) < 0)).map(([k]) => k);
  const sub = subculture(seg, rest, now, orgNow, d8, org.readiness.d8, d9, org.readiness.d9);
  return {
    predicates, n: seg.length, n_preferred: segPref.length, now,
    diff: Object.fromEntries(ORIENTATIONS.map((o) => [o, q(now[o].minus(orgNow[o]), 2)])) as Profile,
    sdi: sdi(now, orgNow), dominance: dominance(now), preferred, gap, classification,
    readiness: { d7, d8, d9, tps: segTps ? q(segTps, 2) : null, tps_band: segTps ? band15(segTps) : null, coverage: q(cov, 4) },
    eos, eos_index: eosIdx, eos_negative: eosNegative, subculture: sub,
  };
}

/** Executive vs staff perception gap for any cohort split (§3.5.12), or the reason it is not computed (UT-21). */
export function perceptionForSplit(scored: ScoredResponse[], isExec: (r: ScoredResponse) => boolean) {
  const floor = cfg.get("segments.floor");
  const R = scored.filter((r) => included(r, "NOW"));
  const e = R.filter(isExec), s = R.filter((r) => !isExec(r));
  if (e.length < floor) return { computed: false as const, reason: "EXECUTIVE_COHORT_BELOW_FLOOR" };
  if (s.length < floor) return { computed: false as const, reason: "STAFF_COHORT_BELOW_FLOOR" };
  const ep = orientationProfile(e, "NOW")!, sp = orientationProfile(s, "NOW")!;
  return { computed: true as const, executive: { n: e.length, now: ep }, staff: { n: s.length, now: sp },
    gap: Object.fromEntries(ORIENTATIONS.map((o) => [o, q(ep[o].minus(sp[o]).abs(), 2)])) as Profile };
}

export interface HeatmapCell { value: string; n: number | null; suppressed: boolean; reason?: string; rollup_label?: string; metrics?: SegmentMetrics }

/**
 * One axis × orientation heatmap within an optional parent segment, with primary floor and differencing
 * protection across the complementary set (Table 54, UT-29). Suppressed cells carry the roll-up label.
 */
export function heatmap(scored: ScoredResponse[], axis: string, org: ScoreObject, parent: Predicates = {}, parentLabel = "organisation", target?: Orientation): HeatmapCell[] {
  const R = scored.filter((r) => included(r, "NOW") && matches(r, parent));
  const counts: Record<string, number> = {};
  for (const r of R) { const v = String(r.snapshot?.[axis] ?? "UNKNOWN"); counts[v] = (counts[v] ?? 0) + 1; }
  const suppressed = differencingSuppressed(R.length, counts);
  return Object.keys(counts).sort().map((v) => {
    if (suppressed.has(v)) {
      return { value: v, n: null, suppressed: true, reason: counts[v] < cfg.get("segments.floor") ? "PRIMARY_FLOOR" : "DIFFERENCING_PROTECTION",
        rollup_label: `merged into ${parentLabel}` };
    }
    try {
      return { value: v, n: counts[v], suppressed: false, metrics: segmentMetrics(scored, { ...parent, [axis]: valueOf(R, axis, v) }, org, { target }) };
    } catch (e) {
      if (e instanceof Suppressed) return { value: v, n: null, suppressed: true, reason: e.rule, rollup_label: `merged into ${parentLabel}` };
      throw e;
    }
  });
}
const valueOf = (R: ScoredResponse[], axis: string, s: string) => (R.find((r) => String(r.snapshot?.[axis]) === s)?.snapshot?.[axis] ?? s) as string;

// ---------------------------------------------------------------- leader–culture link (§3.5.13)

export interface LeaderLink {
  assignment_id: string; leader_profile: Profile; team_basis: Predicates; team_basis_note: string | null; team_now: Profile;
  fit_index: Decimal; fit_band: string; lead_target: Decimal; org_target: Decimal; classification: string;
  team_eos_differential: Decimal | null; team_tps_differential: Decimal | null; contribution_quadrant: string | null; team_dominant: Orientation;
}

/**
 * Link one valid leader to their team culture. `teamChain` lists predicates from the leader's own team up to
 * the root; the first that meets the floor is used, and the output says so when it is not the team itself.
 */
export function leaderCultureLink(leader: LeaderResult, teamChain: Predicates[], scored: ScoredResponse[], org: ScoreObject, target: Orientation): LeaderLink {
  if (!leader.valid || !leader.other_avg) throw new Error("INVALID_360: a valid 360 is required for the leader–culture link");
  const lp = leaderProfile(leader.other_avg);
  let basis: Predicates = {}, metrics: SegmentMetrics | null = null;
  for (const p of teamChain) { try { metrics = segmentMetrics(scored, p, org, { target }); basis = p; break; } catch (e) { if (!(e instanceof Suppressed)) throw e; } }
  const teamNow = metrics ? metrics.now : org.orientation_scores.now;
  const fit = fitIndex(lp, teamNow);
  const orgTarget = org.orientation_scores.now[target];
  const cls = carrierClass(lp[target], orgTarget, leader.flags ?? [], leader.lri!, leader.default ?? [], org.classification);
  const orgEos = org.eos.index as Decimal | null;
  const eosDiff = metrics && metrics.eos_index !== null && orgEos !== null ? q(metrics.eos_index.minus(orgEos), 1) : null;
  const tpsDiff = metrics && metrics.readiness.tps !== null && org.readiness.tps !== null ? q(metrics.readiness.tps.minus(org.readiness.tps), 2) : null;
  const quadrant = eosDiff === null ? null : q(leader.lri!, 2).gte(cfg.get("leaders.carrier_lri_min")) ? (eosDiff.gte(0) ? "EXEMPLAR" : "STRUCTURAL_CONSTRAINT") : (eosDiff.gte(0) ? "TEAM_CARRYING_LEADER" : "PRIORITY_INTERVENTION");
  const isTeam = teamChain.length > 0 && basis === teamChain[0];
  return {
    assignment_id: leader.assignment_id!, leader_profile: Object.fromEntries(ORIENTATIONS.map((o) => [o, q(lp[o], 2)])) as Profile,
    team_basis: basis, team_basis_note: isTeam ? null : `computed against ${Object.keys(basis).length ? Object.values(basis).join(" / ") : "the organisation"} because the team is below the reporting threshold`,
    team_now: teamNow, fit_index: fit, fit_band: fitBand(fit), lead_target: q(lp[target], 2), org_target: orgTarget, classification: cls,
    team_eos_differential: eosDiff, team_tps_differential: tpsDiff, contribution_quadrant: quadrant, team_dominant: dominance(teamNow).dominant[0],
  };
}

/** Leadership population signal (§4.5.4): only with ≥ 5 valid results; counts by class, never names. */
export function leadershipPopulation(leaders: LeaderResult[], links: LeaderLink[]) {
  const valid = leaders.filter((l) => l.valid);
  if (valid.length < cfg.get("segments.floor")) return { computed: false as const, reason: "FEWER_THAN_FIVE_VALID_RESULTS", n: valid.length };
  const bands: Record<string, number> = {}, classes: Record<string, number> = {}, defaults: Record<string, number> = {}, blind: Record<string, number> = {};
  for (const l of valid) {
    bands[l.lri_band!] = (bands[l.lri_band!] ?? 0) + 1;
    for (const o of l.default ?? []) defaults[o] = (defaults[o] ?? 0) + 1;
    for (const [s, v] of Object.entries(l.self_other ?? {})) if (v.tier === "BLIND_SPOT") blind[s] = (blind[s] ?? 0) + 1;
  }
  for (const k of links) classes[k.classification] = (classes[k.classification] ?? 0) + 1;
  const tot = valid.reduce((s, l) => s + (l.headcount_led ?? 0), 0);
  const meanLri = tot ? q(valid.reduce((s, l) => s.plus(D(l.lri!).times(l.headcount_led ?? 0)), D(0)).div(tot), 2) : null;
  const collective = Object.entries(blind).filter(([, c]) => c * 2 >= valid.length).map(([s]) => s);
  return { computed: true as const, n: valid.length, weighted_mean_lri: meanLri, lri_band_counts: bands, classification_counts: classes,
    default_orientation_spread: defaults, collective_blind_spots: collective };
}
