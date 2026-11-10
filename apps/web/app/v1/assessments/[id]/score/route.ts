import { toJsonable } from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { computeScore } from "@/lib/scoring";
import { storeLeaderLinks } from "@/lib/leader-links";
import { consultantOnAssessment } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Score the frozen response set. Idempotent: the same payload hash returns the existing version.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { asm } = g;
  if (!asm.frozen_at) return problem({ code: "DATA_NOT_FROZEN", status: 409, title: "The data set is not frozen." });

  let s;
  const { data: hashes } = await admin().from("score_object").select("payload_hash").eq("assessment_id", id);
  try { s = await computeScore(id, asm.engagement_id, (hashes ?? []).map((h) => h.payload_hash)); }
  catch (e) {
    const err = e as { code?: string; message?: string };
    if (err.code === "SETUP_TIE_UNRESOLVED") return problem({ code: "VALIDATION_FAILED", status: 422, title: "Section F has a tie the consultant must resolve." });
    if (String(err.message).startsWith("INSUFFICIENT_DATA")) return problem({ code: "VALIDATION_FAILED", status: 422, title: "At least one complete culture response is required." });
    return fromDbError(String(err.message));
  }

  const db = admin();
  const existing = await db.from("score_object").select("version, payload_hash, frozen_at").eq("assessment_id", id).eq("payload_hash", s.hash).maybeSingle();
  if (existing.data) { await storeLeaders(id, asm.tenant_id, existing.data.version, s.leaders, g.a.userId); await storeLeaderLinks(id, asm.tenant_id, existing.data.version, g.a.userId, s); return json({ ...existing.data, responses: s.responses, created: false }); }

  const { data: last } = await db.from("score_object").select("version").eq("assessment_id", id).order("version", { ascending: false }).limit(1).maybeSingle();
  const version = (last?.version ?? 0) + 1;
  const ins = await db.from("score_object").insert({
    tenant_id: asm.tenant_id, assessment_id: id, version, payload_json: toJsonable(s.payload) as never, payload_hash: s.hash, created_by: g.a.userId,
  }).select("version, payload_hash, frozen_at").single();
  if (ins.error) return fromDbError(ins.error.message);
  await storeLeaders(id, asm.tenant_id, version, s.leaders, g.a.userId);
  await storeLeaderLinks(id, asm.tenant_id, version, g.a.userId, s);
  return json({ ...ins.data, responses: s.responses, created: true }, 201);
}

// Leader results belong to the score version they were scored with (insert once; the table is immutable).
async function storeLeaders(assessmentId: string, tenantId: string, version: number, leaders: { assignment_id?: string }[], actor: string) {
  if (!leaders.length) return;
  const rows = leaders.map((l) => ({ assessment_id: assessmentId, tenant_id: tenantId, score_version: version, assignment_id: l.assignment_id!, payload_json: toJsonable(l) as never, created_by: actor }));
  const r = await admin().from("leader_result").upsert(rows, { onConflict: "assessment_id,score_version,assignment_id", ignoreDuplicates: true });
  if (r.error) throw new Error(r.error.message);
}
