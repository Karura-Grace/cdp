import { requireServiceForAssessment } from "@/lib/services";
import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { actor } from "@/lib/staff";
import { all, leaderScope, loadGraph } from "@/lib/org-graph";
import { assignRaters, GROUP_FLOOR, type LeaderIn } from "@/lib/rater-assign";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST: the system picks the peers and direct reports of every leader (owner ruling 22 Oct 2026, Erick Ngala comment 18). The supervisor is NOT picked
// here: the Client Admin must choose one for each leader first (a SUPERIOR nomination), and this route refuses until every leader has one.
//   direct reports  the leader's own team, drawn at random (lib/rater-assign.ts)
//   peers           other leaders, same department first, drawn at random; nobody rates more than 3 leaders
//   random          seeded with the assessment id, so repeating the call gives the same choice
// Replaces the not yet invited raters of each leader; a leader with raters already invited is left alone and reported. PAC Consultant on the engagement
// or the tenant's Client Admin, before the data is frozen (the database checks both).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "LEADERSHIP_360"); if (svcOff) return svcOff;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const sa = admin();
  const { data: asm } = await sa.from("assessment").select("assessment_id, tenant_id, engagement_id, status, frozen_at, window_open").eq("assessment_id", id).maybeSingle();
  if (!asm) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const { data: role } = await a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  if (role !== "PAC_CONSULTANT" && role !== "CLIENT_ADMIN") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (!["DRAFT", "LAUNCHED"].includes(asm.status) || asm.frozen_at) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "Raters can only be chosen while the assessment is a draft or open." });

  const windowStart = (asm.window_open ?? new Date().toISOString()).slice(0, 10);
  const { graph } = await loadGraph(sa, asm.tenant_id);
  const people = await all((x, y) => sa.from("person_of_record").select("person_id, employee_ref, employment_status").eq("tenant_id", asm.tenant_id).order("person_id").range(x, y));
  const personOf = new Map(people.map((p) => [p.employee_ref, p.person_id]));
  const unit = new Map(graph.units.map((u) => [u.unit_key, u]));
  const department = (teamKey: string) => { for (let u = unit.get(teamKey), i = 0; u && i < 10; u = u.parent_key ? unit.get(u.parent_key) : undefined, i++) if (u.type === "DEPARTMENT") return u.unit_key; return teamKey; };

  const scope = leaderScope(graph, windowStart);
  const leaders: LeaderIn[] = scope.flatMap((l) => {
    const gl = graph.leaders.find((x) => x.assignment_id === l.assignment_id)!, pid = personOf.get(gl.employee_ref);
    if (!pid) return [];
    return [{ assignment_id: l.assignment_id, person_id: pid, team_unit: gl.team_key, department: department(gl.team_key),
      direct_reports: graph.people.filter((p) => p.employment_status === "ACTIVE" && p.unit_key === gl.team_key && p.employee_ref !== gl.employee_ref).flatMap((p) => personOf.get(p.employee_ref) ?? []) }];
  });
  if (!leaders.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "There are no leaders in scope to choose raters for." });

  const noms = await all((x, y) => sa.from("rater_nomination").select("assignment_id, rater_person_id, rater_group, status").eq("assessment_id", id).order("nomination_id").range(x, y));
  const supervisorOf = new Map(noms.filter((n) => n.rater_group === "SUPERIOR").map((n) => [n.assignment_id, n.rater_person_id]));
  const noSupervisor = leaders.filter((l) => !supervisorOf.has(l.assignment_id)).map((l) => l.assignment_id);
  if (noSupervisor.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: `Choose a supervisor for every leader first. Missing for ${noSupervisor.length} leader${noSupervisor.length === 1 ? "" : "s"}.`, missing_supervisor: noSupervisor });

  const invited = new Set(noms.filter((n) => n.status === "INVITED").map((n) => n.assignment_id));
  const picks = assignRaters(leaders, id);
  const done: string[] = [], skipped: string[] = [], short: { assignment_id: string; group: string; have: number }[] = [];
  for (const p of picks) {
    if (invited.has(p.assignment_id)) { skipped.push(p.assignment_id); continue; }
    const raters = [{ person_id: supervisorOf.get(p.assignment_id)!, rater_group: "SUPERIOR" }, ...p.peers.map((x) => ({ person_id: x, rater_group: "PEER" })), ...p.direct_reports.map((x) => ({ person_id: x, rater_group: "DIRECT_REPORT" }))];
    const { error } = await sa.rpc("rpc_nominations_replace", { p_actor: a.userId, p_assessment: id, p_assignment: p.assignment_id, p_noms: raters as never });
    if (error) return fromDbError(error.message);
    done.push(p.assignment_id);
    for (const s of p.short) short.push({ assignment_id: p.assignment_id, ...s });
  }
  await audit(asm.tenant_id, a.userId, `l360.raters_assigned:${done.length}`, "assessment", id);
  return json({ assigned: done.length, skipped_already_invited: skipped.length, below_floor: short, floor: GROUP_FLOOR }, 201);
}
