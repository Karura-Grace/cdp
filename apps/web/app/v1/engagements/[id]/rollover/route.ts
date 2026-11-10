import { admin } from "@/lib/supabase/admin";
import { consultantOnEngagement } from "@/lib/staff";
import { rolloverPreview } from "@/lib/rollover";
import { followEvent } from "@/lib/lifecycle";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// GET: what the next cycle would start with, and whether it can be created now (nothing is written).
// POST: creates the next cycle: a new engagement (cycle + 1, setup), the agreed setup sections copied as drafts to be re-agreed, and the
// open actions carried as a snapshot. Only the assigned PAC consultant, and only once the engine's own guard is met (an accepted trigger or
// twelve months since the baseline closed). 409 otherwise. Nothing of the previous cycle changes.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await consultantOnEngagement(req, id);
  if (c instanceof Response) return c;
  return json(await rolloverPreview(id));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await consultantOnEngagement(req, id);
  if (c instanceof Response) return c;
  const pv = await rolloverPreview(id);
  if (!pv) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (pv.blocker) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: pv.blocker });
  const { data, error } = await admin().rpc("rpc_rollover_create", { p_actor: c.a.userId, p_previous: id, p_actions: pv.carries.actions.map((a) => a.action_id),
    p_carry: { backlog: pv.carries.backlog, g5_workshop_entries: pv.carries.g5_workshop_entries, reason: pv.reason } as never });
  if (error) return fromDbError(error.message);
  await followEvent(id, "RE_ASSESSMENT", "IMPLEMENTATION");   // this cycle is now in re-assessment; the next one is its own engagement
  return json(data, 201);
}
