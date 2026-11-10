import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { actor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// PUT { text }: the completion time statement, updated after launch once measurement shows the median outside the stated range (spec 2.5, D-11).
// It is a text only change: it is stored on the assessment, not in the locked setup rows, and it is audited. The Client Admin or the consultant.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data: asm } = await admin().from("assessment").select("assessment_id, tenant_id, engagement_id, status, frozen_at").eq("assessment_id", id).maybeSingle();
  if (!asm) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const { data: role } = await a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  if (role !== "PAC_CONSULTANT" && role !== "CLIENT_ADMIN") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (asm.status !== "LAUNCHED" || asm.frozen_at) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The statement can be updated while the survey is open." });
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const text = typeof b.text === "string" ? b.text.trim() : "";
  if (!text || text.length > 60) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The statement is 1 to 60 characters, for example 40 to 50 minutes." });
  const up = await admin().from("assessment").update({ completion_estimate_text: text, updated_by: a.userId }).eq("assessment_id", id);
  if (up.error) return fromDbError(up.error.message);
  await audit(asm.tenant_id, a.userId, "assessment.completion_estimate_updated", "assessment", id);
  return json({ assessment_id: id, completion_estimate_text: text });
}
