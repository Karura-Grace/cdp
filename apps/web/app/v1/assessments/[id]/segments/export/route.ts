import { requireServiceForAssessment } from "@/lib/services";
import { consultantOnAssessment } from "@/lib/staff";
import { audit } from "@/lib/audit";
import { problem } from "@/lib/problem";
import { segmentWorkbook } from "@/lib/segment-export";

export const runtime = "nodejs";

// GET /v1/assessments/{id}/segments/export: every segment view with its counts as XLSX. PAC Consultant only, audited.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const svcOff = await requireServiceForAssessment(id, "GROUP_RESULTS"); if (svcOff) return svcOff;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const w = await segmentWorkbook(id, g.asm.engagement_id, !!g.asm.frozen_at);
  if (!w.ok) return problem({ code: w.code, status: w.status, title: w.title });
  await audit(g.asm.tenant_id, g.a.userId, "segments.exported", "assessment", id);
  return new Response(new Uint8Array(w.buffer), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="culture-by-group-v${w.version}.xlsx"`, "Cache-Control": "no-store" } });
}
