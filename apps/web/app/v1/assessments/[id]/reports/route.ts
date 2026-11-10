import { actor, consultantOnAssessment } from "@/lib/staff";
import { admin } from "@/lib/supabase/admin";
import { draftReportText } from "@/lib/report-draft";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const TYPES = ["BOARD_EXEC_SUMMARY", "ORGANISATIONAL"] as const;

// Reads use the caller's own token, so RLS decides what each role sees: a client role gets RELEASED reports only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data, error } = await a.db.from("report")
    .select("report_id, type, audience, status, score_version, released_at, payload_hash").eq("assessment_id", id).order("created_at");
  if (error) return fromDbError(error.message);
  return json(data);
}

// Create a DRAFT report pinned to the latest frozen score version, with its text drafted by the system. Idempotent per (version, type).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const body = await req.json().catch(() => ({}));
  const type = (body as { type?: string }).type ?? "ORGANISATIONAL";
  if (!(TYPES as readonly string[]).includes(type)) return problem({ code: "VALIDATION_FAILED", status: 422, title: `type must be one of ${TYPES.join(", ")}.` });

  const db = admin();
  const { data: sc } = await db.from("score_object").select("version, payload_hash").eq("assessment_id", id)
    .not("frozen_at", "is", null).order("version", { ascending: false }).limit(1).maybeSingle();
  if (!sc) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Freeze a score version first." });

  const have = await db.from("report").select("report_id, status").eq("assessment_id", id).eq("score_version", sc.version).eq("type", type).maybeSingle();
  if (have.data) return json({ report_id: have.data.report_id, status: have.data.status, score_version: sc.version, created: false });

  const draft = await draftReportText(id, sc.version, type);   // the system writes the text; nobody edits it
  const ins = await db.from("report").insert({
    tenant_id: g.asm.tenant_id, assessment_id: id, score_version: sc.version, type, payload_hash: sc.payload_hash, sections_json: draft.sections, accepted_json: draft.accepted,
    audience: type === "BOARD_EXEC_SUMMARY" ? "Board and executive" : "Client leadership", created_by: g.a.userId,
  }).select("report_id, status").single();
  if (ins.error) return fromDbError(ins.error.message);
  return json({ ...ins.data, score_version: sc.version, created: true }, 201);
}
