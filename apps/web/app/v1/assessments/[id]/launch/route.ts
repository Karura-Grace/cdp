import { checkEngagementTransition } from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { consultantOnAssessment } from "@/lib/staff";
import { runPreflight } from "@/lib/preflight";
import { LAUNCH_NEEDS_SEPARATE_APPROVAL } from "@/lib/staff-message";
import { writeSnapshot } from "@/lib/setup-output";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Launch: pre-flight L1-L6 must pass (L7, L8 warn). Then, in one database transaction, setup locks, the assessment
// becomes LAUNCHED and the engagement moves SETUP -> FIELDING. Repeating a launch changes nothing.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { a, asm } = g;
  if (asm.status === "LAUNCHED") return json({ assessment_id: id, status: "LAUNCHED", changed: false });

  const { data: eng } = await admin().from("engagement").select("state, launch_approved_by").eq("engagement_id", asm.engagement_id).single();
  const pf = await runPreflight(id);
  if (!pf.pass) {
    return problem({ code: "PREFLIGHT_FAILED", status: 422, title: "Launch is blocked by failing pre-flight checks.", checks: pf.checks.filter((c) => !c.pass && c.blocking) });
  }
  // The approve then launch split (owner decision: off for now, one switch in lib/staff-message.ts). The approval is recorded either way when the consultant uses it.
  if (LAUNCH_NEEDS_SEPARATE_APPROVAL && !eng!.launch_approved_by)
    return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "Launch needs the consultant's approval first (POST /v1/assessments/{id}/approve-launch)." });
  const bad = checkEngagementTransition(eng!.state, "FIELDING", "PAC_CONSULTANT", { preflightPassed: pf.pass });
  if (bad) return problem(bad);

  // the graph version, window start and leader scope the checks used are re-verified inside the launch transaction
  const { data, error } = await admin().rpc("rpc_launch_assessment", {
    p_actor: a.userId, p_assessment: id, p_graph_version: pf.org.version, p_window_start: pf.org.windowStart, p_scope: pf.org.scope, p_defects: pf.org.defects as never,
  });
  if (error) return fromDbError(error.message);
  await writeSnapshot(asm.engagement_id).catch(() => null);   // S1.7-001: the versioned setup output object, stored as setup locks (GET output writes it if this step failed)
  return json({ ...(data as object), changed: true, warnings: pf.checks.filter((c) => !c.pass && !c.blocking), not_assessed: pf.not_assessed });
}
