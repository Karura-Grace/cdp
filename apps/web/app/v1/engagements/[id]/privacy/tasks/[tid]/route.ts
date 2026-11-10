import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { graphEditor } from "@/lib/staff";
import { json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// The consultant marks a follow up task (for example an objection) done. Only the PAC Consultant of the engagement; the task must belong to its organisation.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; tid: string }> }) {
  const { id, tid } = await params;
  const g = await graphEditor(req, id, true);
  if (g instanceof Response) return g;
  const db = admin();
  const { data: t } = await db.from("consultant_task").select("task_id, status").eq("task_id", tid).eq("tenant_id", g.eng.tenant_id).maybeSingle();
  if (!t) return problem({ code: "NOT_FOUND", status: 404, title: "No such task." });
  if (t.status === "DONE") return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The task is already done." });
  const up = await db.from("consultant_task").update({ status: "DONE", done_at: new Date().toISOString(), done_by: g.a.userId }).eq("task_id", tid);
  if (up.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  await audit(g.eng.tenant_id, g.a.userId, "privacy.task.done", "consultant_task", tid);
  return json({ task_id: tid, status: "DONE" });
}
