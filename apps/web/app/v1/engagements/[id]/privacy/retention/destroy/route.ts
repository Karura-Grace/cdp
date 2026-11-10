import { audit } from "@/lib/audit";
import { admin } from "@/lib/supabase/admin";
import { consultantOnEngagement } from "@/lib/staff";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Destroys response level data once the retention date has passed and returns the certificate. The database function refuses a call before
// the date (RETENTION_NOT_DUE) and a second call (ALREADY_DESTROYED); score objects, reports and plans are never touched.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  const { data, error } = await admin().rpc("rpc_destroy_responses", { p_engagement: id });
  if (error) {
    const m = error.message;
    if (m.includes("RETENTION_NOT_SCHEDULED")) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "No retention schedule exists for this engagement." });
    if (m.includes("ALREADY_DESTROYED")) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The responses were already destroyed." });
    if (m.includes("RETENTION_NOT_DUE")) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The retention date has not been reached.", destroy_on: (error as { details?: string }).details ?? null });
    return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  }
  await audit(g.eng.tenant_id, g.a.userId, "retention.destroyed", "engagement", id);
  return json(data);
}
