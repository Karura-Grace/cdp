import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";

type Unit = { unit_id: string; parent_unit_id: string | null; type: string; name: string };

// Predicates from the leader's own team up to the division, in the names the link snapshot carries
// (capture.issue_person_invitations: nearest TEAM, DEPARTMENT and DIVISION ancestor by name). The engine uses the first
// one that meets the floor and says so when it is not the team itself.
export function teamChain(unitId: string, units: Map<string, Unit>): E.Predicates[] {
  const up: Unit[] = [];
  for (let u = units.get(unitId), i = 0; u && i < 10; u = u.parent_unit_id ? units.get(u.parent_unit_id) : undefined, i++) up.push(u);
  const chain: E.Predicates[] = [];
  for (const [key, type] of [["team", "TEAM"], ["department", "DEPARTMENT"], ["division", "DIVISION"]] as const) {
    const hit = up.find((u) => u.type === type);
    if (hit) chain.push({ [key]: hit.name });
  }
  return chain;
}

type Scored = { leaders: E.LeaderResult[]; scored: E.ScoredResponse[]; obj: E.ScoreObject; setup: { leadership_target_orientation?: E.Orientation | null } };

/** Link every valid leader to the culture they lead: fit, carrier class, team differential, quadrant. Pure of storage, so scoring stores the
 *  result and the findings run reads the same numbers. [] when there is no leadership target or no valid 360. */
export async function computeLeaderLinks(tenantId: string, s: Scored): Promise<{ leader: E.LeaderResult; link: E.LeaderLink }[]> {
  const target = s.setup.leadership_target_orientation;
  const valid = s.leaders.filter((l) => l.valid && l.other_avg && l.assignment_id);
  if (!target || !valid.length) return [];
  const db = admin();
  const [{ data: units }, { data: asg }] = await Promise.all([
    db.from("org_unit").select("unit_id, parent_unit_id, type, name").eq("tenant_id", tenantId),
    db.from("leader_assignment").select("assignment_id, team_id").eq("tenant_id", tenantId).in("assignment_id", valid.map((l) => l.assignment_id!)),
  ]);
  const byId = new Map((units ?? []).map((u) => [u.unit_id, u as Unit]));
  const team = new Map((asg ?? []).map((a) => [a.assignment_id, a.team_id]));
  return valid.map((l) => ({ leader: l, link: E.leaderCultureLink(l, teamChain(team.get(l.assignment_id!) ?? "", byId), s.scored, s.obj, target) }));
}

/** Store the links beside the leader results. Consultant only; insert once. */
export async function storeLeaderLinks(assessmentId: string, tenantId: string, version: number, actor: string, s: Scored) {
  const links = await computeLeaderLinks(tenantId, s);
  if (!links.length) return;
  const rows = links.map(({ leader, link }) => ({ assessment_id: assessmentId, tenant_id: tenantId, score_version: version, assignment_id: leader.assignment_id!,
    payload_json: E.toJsonable(link) as never, created_by: actor }));
  const r = await admin().from("leader_link_result").upsert(rows, { onConflict: "assessment_id,score_version,assignment_id", ignoreDuplicates: true });
  if (r.error) throw new Error(r.error.message);
}
