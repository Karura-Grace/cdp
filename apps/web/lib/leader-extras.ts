import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { scoringClient } from "./supabase/scoring";

export interface Highlight { item: number; others: string; observed: number; self: number | null }
export interface LeaderExtra { top: Highlight[]; bottom: Highlight[]; meta: { raters: number; known_for: Record<string, number>; contact: Record<string, number> } | null }

// What a leader's 360 adds beyond the frozen leader result: the five strongest and five weakest behaviours as raters see them
// (engine leaderHighlights on the frozen 360 set) and how raters know the leader (counts only, at three or more raters).
// After freeze only. Callers decide who may see which leader; this returns everything for the assessment.
export async function leaderExtras(assessmentId: string, frozen: boolean): Promise<Map<string, LeaderExtra>> {
  const out = new Map<string, LeaderExtra>();
  if (!frozen) return out;
  const [{ data: set }, { data: meta }] = await Promise.all([
    scoringClient().rpc("rpc_frozen_360_set", { p_assessment_id: assessmentId }),
    admin().rpc("rpc_rater_meta_360", { p_assessment_id: assessmentId }),
  ]);
  const metaOf = new Map(((meta ?? []) as unknown as { assignment_id: string; raters: number; known_for: Record<string, number>; contact: Record<string, number> }[]).map((m) => [m.assignment_id, m]));
  for (const l of (set ?? []) as unknown as { assignment_id: string; self: (number | null)[] | null; raters: E.RaterInput[] }[]) {
    const h = E.leaderHighlights(l.self, l.raters);
    if (!h) continue;
    const m = metaOf.get(l.assignment_id);
    out.set(l.assignment_id, { ...(E.toJsonable(h) as { top: Highlight[]; bottom: Highlight[] }), meta: m ? { raters: m.raters, known_for: m.known_for, contact: m.contact } : null });
  }
  return out;
}
