import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";
import { actor } from "@/lib/staff";

export const runtime = "nodejs";

// After the browser has set a new password, clear the must-change flag. The database refuses (PASSWORD_UNCHANGED) unless
// the stored password hash really differs from the temporary one, so calling this without changing it does nothing.
export async function POST(req: Request) {
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const r = await admin().rpc("rpc_password_changed", { p_user: a.userId });
  if (r.error) return fromDbError(r.error.message);
  return json({ ok: true });
}
