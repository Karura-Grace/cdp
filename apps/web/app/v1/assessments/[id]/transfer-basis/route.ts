import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnAssessment, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// D-04: record the basis for processing outside the tenant's region (a reference to the signed record). This stores
// the reference only; the platform cannot tell whether the document is genuine. Who signs it is an open item for Imran.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { a, asm } = g;
  if (asm.status !== "DRAFT") return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The transfer basis is fixed once the assessment has launched." });
  const b = await readJson(req, 4 * 1024);
  if (b instanceof Response) return b;
  const ref = typeof b.reference === "string" ? b.reference.trim() : "";
  if (ref.length < 3 || ref.length > 300) return problem({ code: "VALIDATION_FAILED", status: 422, title: "reference (3 to 300 characters) is required, for example the document title and date." });
  const up = await admin().from("tenant").update({ transfer_basis_ref: ref, transfer_basis_recorded_at: new Date().toISOString() }).eq("tenant_id", asm.tenant_id);
  if (up.error) return fromDbError(up.error.message);
  await audit(asm.tenant_id, a.userId, "tenant.transfer_basis_recorded", "tenant", asm.tenant_id);
  return json({ recorded: true });
}
