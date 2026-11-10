import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// PATCH { decision: ACCEPTED | DISMISSED, reason? }: the assigned PAC Consultant decides a trigger, once. A dismissal needs a reason.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 2048);
  if (b instanceof Response) return b;
  const reason = typeof b.reason === "string" ? b.reason.trim() : "";
  if (!["ACCEPTED", "DISMISSED"].includes(String(b.decision)) || reason.length > 500 || (b.decision === "DISMISSED" && !reason)) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "decision (ACCEPTED or DISMISSED) is required, and a dismissal needs a reason." });
  }
  const { error } = await admin().rpc("rpc_trigger_decide", { p_actor: a.userId, p_trigger: id, p_decision: String(b.decision), p_reason: reason });
  return error ? fromDbError(error.message) : json({ trigger_id: id, decision: b.decision });
}
