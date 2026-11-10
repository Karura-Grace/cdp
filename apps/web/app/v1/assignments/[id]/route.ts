import { admin } from "@/lib/supabase/admin";
import { fromDbError, json } from "@/lib/problem";
import { manager } from "@/lib/users";

export const runtime = "nodejs";

// Revoke early: the end date becomes now. The row stays, so the history is kept.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await manager(req);
  if (g instanceof Response) return g;
  const r = await admin().rpc("rpc_assignment_revoke", { p_actor: g.a.userId, p_assignment: id });
  if (r.error) return fromDbError(r.error.message);
  return json({ assignment_id: id, revoked: true });
}
