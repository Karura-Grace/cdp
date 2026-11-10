import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnAssessment, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// A scoring relevant change to a launched setup (cohorts, requirements, business model, target orientation: spec 1.6.2 lock rule) creates a
// new assessment version. The launched assessment is superseded, setup unlocks, the engagement returns to SETUP, and a DRAFT clone carries the
// reason (shown on the setup page and in the technical appendix). Allowed only while nobody has submitted. Consultant only.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 4 * 1024);
  if (b instanceof Response) return b;
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (reason.length < 3 || reason.length > 500) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Give the reason for the new version (3 to 500 characters)." });
  const { data, error } = await admin().rpc("rpc_assessment_new_version", { p_assessment: id, p_reason: reason });
  if (error) return fromDbError(error.message);
  await audit(g.asm.tenant_id, g.a.userId, `assessment.new_version:${data}`, "assessment", id);
  return json({ assessment_id: data, supersedes: id, reason }, 201);
}
