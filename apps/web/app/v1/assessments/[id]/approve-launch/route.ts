import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { runPreflight } from "@/lib/preflight";
import { consultantOnAssessment } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// The consultant's approval to launch, recorded on the engagement (launch_approved_by and _at). Today launch does not require it
// (LAUNCH_NEEDS_SEPARATE_APPROVAL in lib/staff-message.ts is off); recording it is optional. Approving needs pre-flight to pass.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  if (g.asm.status !== "DRAFT") return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "Only a draft assessment can be approved for launch." });
  const pf = await runPreflight(id);
  if (!pf.pass) return problem({ code: "PREFLIGHT_FAILED", status: 422, title: "Launch cannot be approved while pre-flight checks fail.", checks: pf.checks.filter((c) => !c.pass && c.blocking) });
  const at = new Date().toISOString();
  const up = await admin().from("engagement").update({ launch_approved_by: g.a.userId, launch_approved_at: at, updated_by: g.a.userId }).eq("engagement_id", g.asm.engagement_id);
  if (up.error) return fromDbError(up.error.message);
  await audit(g.asm.tenant_id, g.a.userId, "assessment.launch_approved", "assessment", id);
  return json({ assessment_id: id, approved_by: g.a.userId, approved_at: at });
}
