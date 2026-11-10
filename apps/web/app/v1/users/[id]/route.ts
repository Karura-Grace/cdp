import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";
import { CLIENT_ROLES, manager } from "@/lib/users";

export const runtime = "nodejs";
const UUID = /^[0-9a-f-]{36}$/i;

// Change a client user's role, or switch the account off and on. Deactivating also bans the auth user, so they cannot
// sign in or refresh a session; the database stops honouring any token they still hold (app.mfa_ok checks profile.active).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await manager(req);
  if (g instanceof Response) return g;
  if (!UUID.test(id)) return problem({ code: "USER_NOT_FOUND", status: 404, title: "That user was not found." });
  const b = (await req.json().catch(() => null)) as { role?: string; active?: boolean; person_id?: string | null } | null;
  if (b && b.person_id !== undefined) {
    // link (or unlink with null) a People Leader login to a person on the roster; the database checks role, tenant and uniqueness
    if (b.person_id !== null && !/^per_[a-z0-9]{1,40}$/.test(String(b.person_id))) return problem({ code: "VALIDATION_FAILED", status: 422, title: "person_id must be a person id or null." });
    const l = await admin().rpc("rpc_user_link_person", { p_actor: g.a.userId, p_user: id, p_person: b.person_id as string });
    if (l.error) return fromDbError(l.error.message);
    return json({ user_id: id, person_id: b.person_id });
  }
  if (!b || (b.role === undefined && b.active === undefined) || (b.role !== undefined && !(CLIENT_ROLES as readonly string[]).includes(b.role)) || (b.active !== undefined && typeof b.active !== "boolean"))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "Send a client role, or active true or false." });

  const db = admin();
  const r = await db.rpc("rpc_user_update", { p_actor: g.a.userId, p_user: id, p_role: b.role, p_active: b.active });
  if (r.error) return fromDbError(r.error.message);
  if (b.active !== undefined) {
    const ban = await db.auth.admin.updateUserById(id, { ban_duration: b.active ? "none" : "876000h" });
    if (ban.error) return problem({ code: "INTERNAL", status: 500, title: "The account was switched off in the database, but sign-in could not be blocked. Try again." });
  }
  return json({ user_id: id, role: b.role, active: b.active });
}
