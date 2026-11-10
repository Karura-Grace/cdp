import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnAssessment, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// 360 rater comments, reviewed by the PAC Consultant for identifying content before the leader sees them (N4.7-COMMENTS, S2.4-015).
// Only after freeze. Each comment comes with its question code and nothing that points to a rater. Reading is audited (count only).
// GET ?assignment=<id>; POST { assignment_id, comment_id, redacted: string | null } marks it reviewed, with or without a redaction.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const asg = new URL(req.url).searchParams.get("assignment") ?? "";
  if (!/^lea_[0-9a-f]{16}$/.test(asg)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "assignment must be a leader assignment id." });
  const { data, error } = await admin().rpc("rpc_comments_for_review", { p_assessment_id: id, p_assignment_id: asg });
  if (error) return fromDbError(error.message);
  await audit(g.asm.tenant_id, g.a.userId, `l360.comments_read:${(data ?? []).length}`, "leader_assignment", asg);
  return json({ comments: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 8 * 1024);
  if (b instanceof Response) return b;
  const cid = typeof b.comment_id === "string" ? b.comment_id : "";
  const red = b.redacted === null || b.redacted === undefined ? null : typeof b.redacted === "string" ? b.redacted.trim() : undefined;
  if (!/^c36_/.test(cid) || red === undefined || (red !== null && (!red || red.length > 2000))) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Give comment_id and redacted (text up to 2,000 characters, or null to keep the original)." });
  const { error } = await admin().rpc("rpc_review_comment", { p_assessment_id: id, p_comment_id: cid, p_redacted: red as string, p_actor: g.a.userId });
  if (error) return fromDbError(error.message);
  await audit(g.asm.tenant_id, g.a.userId, red === null ? "l360.comment_reviewed" : "l360.comment_redacted", "assessment", id);
  return json({ comment_id: cid, reviewed: true, redacted: red !== null });
}
