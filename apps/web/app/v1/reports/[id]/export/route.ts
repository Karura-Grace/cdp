import { checkExport } from "@pac/cdp-engine";
import { buildModel } from "@/lib/export/model";
import { buildPdf } from "@/lib/export/pdf";
import { buildFullPdf } from "@/lib/export/pdf-full";
import { buildFullModel } from "@/lib/export/full-model";
import { buildTemplatePdf } from "@/lib/export/pdf-template";
import { buildStaffGuidePdf } from "@/lib/export/pdf-guide";
import { buildPptx } from "@/lib/export/pptx";
import { loadReport } from "@/lib/report-data";
import { reportExtras } from "@/lib/report-extras";
import { fromDbError, problem } from "@/lib/problem";
import { admin } from "@/lib/supabase/admin";
import { actor, consultantOnAssessment } from "@/lib/staff";

export const runtime = "nodejs";

const TYPES = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
} as const;

// GET /v1/reports/{id}/export?format=pptx|pdf. part=facilitation gives the facilitation guide as its own PDF, for the consultant only (owner Q-ER1). Released versions only (checkExport); the caller must be able to read
// the report through RLS. Every export is audit-logged with the hash it was drawn from.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const format = new URL(req.url).searchParams.get("format") ?? "pptx";
  if (format !== "pptx" && format !== "pdf") return problem({ code: "VALIDATION_FAILED", status: 422, title: "format must be pptx or pdf." });

  const l = await loadReport(a.db, id);
  if (!l) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const denied = checkExport({ released: l.rep.status === "RELEASED", kind: "REPORT" });
  if (denied) return problem(denied);

  // format=pdf gives the full report for the organisational report; brief=1 (or any other report type) the short version
  const extras = await reportExtras(l, a.userId);
  const model = buildModel(l, extras);
  const guide = format === "pdf" && new URL(req.url).searchParams.get("part") === "facilitation";
  // review=1: the full report without the diagonal mark, so a reviewer's Word conversion does not mix its letters into the text (owner Q-ER27). Consultant only.
  const review = format === "pdf" && new URL(req.url).searchParams.get("review") === "1";
  if (guide || review) { const g = await consultantOnAssessment(req, l.rep.assessment_id); if (g instanceof Response) return g; }
  const full = format === "pdf" && l.rep.type === "ORGANISATIONAL" && new URL(req.url).searchParams.get("brief") !== "1";
  const fm = l.rep.type === "ORGANISATIONAL" ? buildFullModel(l, extras) : null;
  const body = format === "pptx" ? await buildPptx(model, fm, l.rep.type === "ORGANISATIONAL" ? l : undefined, extras) : guide && fm && new URL(req.url).searchParams.get("legacy") !== "1" ? await buildStaffGuidePdf(l, extras, model) : guide && fm ? await buildFullPdf({ ...fm, title: "Facilitation guide", chapters: [{ ...fm.facilitation, num: "01" }] }, model, true) : full && fm ? (new URL(req.url).searchParams.get("legacy") === "1" || review ? await buildFullPdf(fm, model, false, review) : await buildTemplatePdf(l, extras, model)) : fm && l.rep.type === "ORGANISATIONAL" && new URL(req.url).searchParams.get("legacy") !== "1" ? await buildTemplatePdf(l, extras, model, true) : await buildPdf(model, fm);   // the brief on the template (SPEC group 4, 1); legacy=1 keeps the old brief

  const log = await admin().from("audit_log").insert({
    tenant_id: l.rep.tenant_id, actor_id: a.userId, action: `report.exported:${guide ? "pdf-facilitation" : review ? "pdf-review" : full ? "pdf-full" : format}`, object_type: "report", object_id: id, payload_hash: l.scoreHash,
  });
  if (log.error) return fromDbError(log.error.message);

  const file = `${model.org}-${guide ? "facilitation-guide" : review ? "review-copy" : l.rep.type}${format === "pdf" && !full && !guide ? "-brief" : ""}-v${l.rep.score_version}`.replace(/[^A-Za-z0-9_-]+/g, "-").toLowerCase();
  return new Response(new Uint8Array(body), {
    headers: { "content-type": TYPES[format], "content-disposition": `attachment; filename="${file}.${format}"`, "cache-control": "no-store" },
  });
}
