import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnAssessment } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// L6: "consent text approved by a PAC Consultant". Approval locks the text. The approver is recorded.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { a, asm } = g;
  if (!asm.consent_text_id) return problem({ code: "VALIDATION_FAILED", status: 422, title: "This assessment has no consent text." });
  const db = admin();
  const { data: ct } = await db.from("consent_text").select("status").eq("consent_text_id", asm.consent_text_id).single();
  if (ct?.status === "APPROVED") return json({ consent_text_id: asm.consent_text_id, status: "APPROVED", changed: false });
  const up = await db.from("consent_text").update({ status: "APPROVED", approved_at: new Date().toISOString(), approved_by: a.userId }).eq("consent_text_id", asm.consent_text_id);
  if (up.error) return fromDbError(up.error.message);
  await audit(asm.tenant_id, a.userId, "consent_text.approved", "consent_text", asm.consent_text_id);
  return json({ consent_text_id: asm.consent_text_id, status: "APPROVED", changed: true });
}
