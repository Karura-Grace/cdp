import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnAssessment, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Annotations on findings of the latest evaluated score version (Journey 4 F3). A note is recorded beside a finding and never changes its
// verdict (spec S4.2-003). Insert only. PAC Consultant on the engagement; clients never read them, released or not.
async function latest(assessmentId: string) {
  const { data } = await admin().from("evaluation").select("score_version, payload_json").eq("assessment_id", assessmentId).order("score_version", { ascending: false }).limit(1).maybeSingle();
  return data;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const ev = await latest(id);
  if (!ev) return json({ score_version: null, annotations: [] });
  const { data, error } = await admin().from("finding_annotation").select("annotation_id, finding_id, body, created_at").eq("assessment_id", id).eq("score_version", ev.score_version).order("created_at");
  if (error) return fromDbError(error.message);
  return json({ score_version: ev.score_version, annotations: data ?? [] });
}

// POST { finding_id, body }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 8 * 1024);
  if (b instanceof Response) return b;
  const fid = typeof b.finding_id === "string" ? b.finding_id : "", text = typeof b.body === "string" ? b.body.trim() : "";
  if (!/^fnd_\d{4}$/.test(fid) || text.length < 1 || text.length > 2000) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Give the finding and a note of 1 to 2000 characters." });
  const ev = await latest(id);
  if (!ev) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Run the findings first." });
  const known = ((ev.payload_json as { findings?: { finding_id: string }[] }).findings ?? []).some((f) => f.finding_id === fid);
  if (!known) return problem({ code: "VALIDATION_FAILED", status: 422, title: "That finding is not in the latest evaluation." });
  const ins = await admin().from("finding_annotation").insert({ tenant_id: g.asm.tenant_id, assessment_id: id, score_version: ev.score_version, finding_id: fid, body: text, created_by: g.a.userId })
    .select("annotation_id, finding_id, body, created_at").single();
  if (ins.error) return fromDbError(ins.error.message);
  await audit(g.asm.tenant_id, g.a.userId, "finding.annotated", "assessment", id);
  return json(ins.data, 201);
}
