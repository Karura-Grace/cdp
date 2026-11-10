import * as E from "@pac/cdp-engine";
import type { SupabaseClient } from "@supabase/supabase-js";
import { admin } from "./supabase/admin";
import { computeScore } from "./scoring";
import type { Database } from "./supabase/database.types";

export interface TeamResult {
  team: string; assignment_id: string;
  /** null when fewer answered than the reporting floor: nothing about the team is shown */
  metrics: unknown | null;
}

/**
 * The teams the signed-in People Leader leads, each with its culture result from the latest frozen score.
 * Needs: the login is linked to a person, and a report on that score version is released (read through the caller's own
 * token, so RLS decides). A team under the floor is never reported: the engine throws Suppressed and only that fact is
 * returned. Every team looked at is logged (insert only). Returns null when the caller may not see anything.
 */
export async function teamView(db: SupabaseClient<Database>, assessmentId: string, userId: string) {
  const sa = admin();
  const { data: asm } = await sa.from("assessment").select("engagement_id, frozen_at").eq("assessment_id", assessmentId).maybeSingle();
  if (!asm?.frozen_at) return null;
  const { data: rep } = await db.from("report").select("score_version").eq("assessment_id", assessmentId).eq("status", "RELEASED").order("score_version", { ascending: false }).limit(1).maybeSingle();
  if (!rep) return null;
  const { data: person } = await db.rpc("rpc_my_person");
  if (!person) return { linked: false as const, teams: [] as TeamResult[], floor: E.config.get("segments.floor") };
  const { data: mine } = await db.rpc("rpc_my_assignments");
  const ids = (mine ?? []) as unknown as string[];
  const { data: las } = ids.length ? await sa.from("leader_assignment").select("assignment_id, team_id, effect_from, effect_to").in("assignment_id", ids) : { data: [] };
  const today = new Date().toISOString().slice(0, 10);
  const live = (las ?? []).filter((l) => l.effect_from <= today && (!l.effect_to || l.effect_to >= today));
  const { data: units } = live.length ? await sa.from("org_unit").select("unit_id, name").in("unit_id", live.map((l) => l.team_id)) : { data: [] };
  const name = new Map((units ?? []).map((u) => [u.unit_id, u.name]));

  // the same frozen set as the score, and only if it reproduces the stored hash
  const { data: sc } = await sa.from("score_object").select("payload_hash").eq("assessment_id", assessmentId).eq("version", rep.score_version).maybeSingle();
  const s = await computeScore(assessmentId, asm.engagement_id, sc ? [sc.payload_hash] : []);
  if (!sc || s.hash !== sc.payload_hash) throw new Error("The frozen score could not be reproduced.");
  const floor = E.config.get("segments.floor");
  const teams: TeamResult[] = [];
  for (const l of live) {
    const team = name.get(l.team_id);
    if (!team) continue;
    let metrics: unknown | null = null;
    try { metrics = E.toJsonable(E.segmentMetrics(s.scored, { team }, s.obj)); }
    catch (e) { if (!(e instanceof E.Suppressed)) throw e; }
    await sa.rpc("rpc_log_segment_query", { p_actor: userId, p_assessment_id: assessmentId, p_axis: "team", p_predicates: { team } as never, p_outcome: metrics ? "ALLOWED" : "SUPPRESSED" });
    teams.push({ team, assignment_id: l.assignment_id, metrics });
  }
  return { linked: true as const, teams, floor, score_version: rep.score_version };
}
