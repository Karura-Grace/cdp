import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";

type Prof = Record<string, string>;
type Score = {
  instrument_version: string;
  orientation_scores: { now: Prof; preferred: Prof; gap: Prof };
  classification: Record<string, string>;
  readiness: { d7: string | null; d8: string | null; d9: string | null; tps: string | null };
  eos: { index: string | null };
};
export interface Deltas {
  relation: "SAME" | "MINOR";
  baseline: { assessment_id: string; score_version: number; instrument_version: string };
  current: { assessment_id: string; score_version: number; instrument_version: string };
  now: Prof; preferred: Prof; gap: Prof;
  baseline_now: Prof; current_now: Prof; baseline_gap: Prof; current_gap: Prof;
  classification: { baseline: Record<string, string>; current: Record<string, string> };
  readiness: Record<string, { baseline: string | null; current: string | null; delta: string | null }>;
  eos_index: { baseline: string | null; current: string | null; delta: string | null };
  trade_off: ReturnType<typeof E.toJsonable>;
}

const dec = (p: Prof) => Object.fromEntries(E.ORIENTATIONS.map((o) => [o, E.D(p[o])])) as E.Profile;
const diff = (a: string | null, b: string | null) => (a === null || b === null ? null : E.q(E.D(b).minus(E.D(a)), 2).toString());

/** The two latest cycles of an organisation: the engagement, its previous cycle, and each one's assessment and frozen score version. */
export async function cyclePair(engagementId: string) {
  const db = admin();
  const { data: cur } = await db.from("engagement").select("engagement_id, tenant_id, cycle_no, previous_engagement_id").eq("engagement_id", engagementId).maybeSingle();
  if (!cur) return null;
  const load = async (eid: string | null) => {
    if (!eid) return null;
    const { data: asm } = await db.from("assessment").select("assessment_id, status, instrument_version_id").eq("engagement_id", eid).neq("status", "SUPERSEDED").maybeSingle();
    if (!asm || asm.status !== "FROZEN") return null;
    const { data: sc } = await db.from("score_object").select("version, payload_json").eq("assessment_id", asm.assessment_id).order("version", { ascending: false }).limit(1).maybeSingle();
    return sc ? { engagement_id: eid, assessment_id: asm.assessment_id, version: sc.version, score: sc.payload_json as unknown as Score } : null;
  };
  const [current, baseline] = await Promise.all([load(cur.engagement_id), load(cur.previous_engagement_id)]);
  return { cur, current, baseline };
}

/**
 * Before and after, built only from the two frozen score objects with the engine's own functions. A major instrument change
 * is refused (the caller returns 409). Movement is reported beside delivery and never as cause (spec 6.5.2).
 */
type Pair = NonNullable<Awaited<ReturnType<typeof cyclePair>>>;
export async function computeDeltas(base: NonNullable<Pair["baseline"]>, cur: NonNullable<Pair["current"]>) {
  const rel = E.comparability(base.score.instrument_version, cur.score.instrument_version);
  if (rel === "MAJOR") return { refused: true as const, relation: rel };
  const bs = base.score, cs = cur.score;
  const { data: pri } = await admin().from("priority").select("priority_id, orientation, classification, trade_off_orientation").eq("assessment_id", base.assessment_id);
  const baseClasses = Object.fromEntries(Object.entries(bs.classification).map(([k, v]) => [k, v])) as Partial<Record<E.Orientation, E.GapClass>>;
  const tradeOff = E.tradeOffVerification(dec(bs.orientation_scores.now), dec(cs.orientation_scores.now),
    (pri ?? []).map((p) => ({ priority_id: p.priority_id, orientation: p.orientation as E.Orientation, classification: p.classification, trade_off_orientation: p.trade_off_orientation as E.Orientation | null })), baseClasses);
  const delta = (a: Prof, b: Prof) => Object.fromEntries(Object.entries(E.compareProfiles(dec(a), dec(b))).map(([k, v]) => [k, v.toString()])) as Prof;
  const rd = (k: "d7" | "d8" | "d9" | "tps") => ({ baseline: bs.readiness[k], current: cs.readiness[k], delta: diff(bs.readiness[k], cs.readiness[k]) });
  const d: Deltas = {
    relation: rel,
    baseline: { assessment_id: base.assessment_id, score_version: base.version, instrument_version: bs.instrument_version },
    current: { assessment_id: cur.assessment_id, score_version: cur.version, instrument_version: cs.instrument_version },
    now: delta(bs.orientation_scores.now, cs.orientation_scores.now),
    preferred: delta(bs.orientation_scores.preferred, cs.orientation_scores.preferred),
    gap: delta(bs.orientation_scores.gap, cs.orientation_scores.gap),
    baseline_now: bs.orientation_scores.now, current_now: cs.orientation_scores.now,
    baseline_gap: bs.orientation_scores.gap, current_gap: cs.orientation_scores.gap,
    classification: { baseline: bs.classification, current: cs.classification },
    readiness: { D7: rd("d7"), D8: rd("d8"), D9: rd("d9"), TPS: rd("tps") },
    eos_index: { baseline: bs.eos.index, current: cs.eos.index, delta: diff(bs.eos.index, cs.eos.index) },
    trade_off: E.toJsonable(tradeOff),
  };
  return { refused: false as const, deltas: d };
}
