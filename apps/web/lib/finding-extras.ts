import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { computeLeaderLinks } from "./leader-links";
import { AXES } from "./segments";

type Subculture = { is_subculture?: boolean; significance?: "CONFIRMED" | "INDICATIVE"; dominance_divergence?: boolean; capacity_subculture?: boolean };
type Profile = { subculture?: Subculture; eos_negative?: string[] };

/** Segment and leader signals for the findings run (spec 4.5.4), read from what scoring stored: the group profiles written at score freeze and
 *  the leader links computed from the same frozen set. They are appended after the organisation findings, so organisation finding ids never move.
 *  Leader flags name a leader, so they are kept out of the stored evaluation (clients can read it after release): the caller drops them and the
 *  consultant's findings console reads them from the leader stores instead. */
export async function findingExtras(assessmentId: string, tenantId: string, version: number,
  s: { leaders: E.LeaderResult[]; scored: E.ScoredResponse[]; obj: E.ScoreObject; setup: { leadership_target_orientation?: E.Orientation | null } }) {
  const { data: prof } = await admin().from("segment_profile").select("axis, value, profile_json").eq("assessment_id", assessmentId).eq("score_version", version);
  // A fixed order: the findings are hashed, and a plain select has no order. This is the order storeSegmentProfiles wrote them in (the cuts in AXES
  // order, then the group values as the engine sorts them), so evaluations stored before this was fixed still reproduce.
  const ordered = [...(prof ?? [])].sort((a, b) => AXES.indexOf(a.axis as never) - AXES.indexOf(b.axis as never) || (a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
  const segments: (E.SegmentFinding & { eos_negative?: string[]; capacity_subculture?: boolean })[] = ordered.map((r) => {
    const p = r.profile_json as Profile, sub = p.subculture ?? {};
    return { segment: `${r.axis}: ${r.value}`, significance: sub.significance ?? "INDICATIVE", dominance_divergence: !!sub.dominance_divergence,
      is_subculture: !!sub.is_subculture, eos_negative: p.eos_negative ?? [], capacity_subculture: !!sub.capacity_subculture };
  });
  const links = await computeLeaderLinks(tenantId, s);
  const leaders: (E.LeaderFinding & { flags?: string[] })[] = links.map(({ leader, link }) => ({
    assignment_id: leader.assignment_id!, lri: leader.lri ?? null, fit: link.fit_index, classification: link.classification,
    team_dominant: link.team_dominant, team_eos_differential: link.team_eos_differential, flags: leader.flags ?? [] }));
  return { segments, leaders };
}

/** The evaluation exactly as it is stored: organisation findings, then segment signals appended. Per leader findings name a leader and the stored
 *  evaluation is readable by client roles after release, so they are dropped here. The evaluate route stores this, and the plan route recomputes
 *  the same thing to check the stored hash, so both must go through here. */
export async function runEvaluation(assessmentId: string, tenantId: string, version: number,
  s: { leaders: E.LeaderResult[]; scored: E.ScoredResponse[]; obj: E.ScoreObject; setup: E.EngineSetup }) {
  const extra = await findingExtras(assessmentId, tenantId, version, s);
  const full = E.evaluate(s.obj, s.setup, extra);
  const own = (f: { type: string }) => f.type !== "LEADER_FLAG";
  return { ...full, findings: full.findings.filter(own), blocking: full.blocking.filter(own) };
}
