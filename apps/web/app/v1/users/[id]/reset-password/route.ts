import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";
import { manager, newPassword } from "@/lib/users";

export const runtime = "nodejs";

// New one-time password. The database authorises the actor BEFORE the password changes, and records a hash snapshot so
// the must-change flag only clears once the password has really been replaced.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await manager(req);
  if (g instanceof Response) return g;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return problem({ code: "USER_NOT_FOUND", status: 404, title: "That user was not found." });
  const db = admin();
  const auth = await db.rpc("rpc_user_authorize", { p_actor: g.a.userId, p_user: id });
  if (auth.error) return fromDbError(auth.error.message);
  const password = newPassword();
  const set = await db.auth.admin.updateUserById(id, { password });
  if (set.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  const mark = await db.rpc("rpc_user_mark_temp", { p_actor: g.a.userId, p_user: id });
  if (mark.error) return fromDbError(mark.error.message);
  return json({ user_id: id, temp_password: password });
}
