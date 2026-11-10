import { admin } from "@/lib/supabase/admin";
import { fromDbError, json, problem } from "@/lib/problem";
import { CLIENT_ROLES, manager, newPassword } from "@/lib/users";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const g = await manager(req);
  if (g instanceof Response) return g;
  const { data, error } = await admin().rpc("rpc_users_list", { p_actor: g.a.userId });
  if (error) return fromDbError(error.message);
  return json(data);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Create a user with a one-time temporary password. The password is returned in this response only; it is not stored
// anywhere readable, and the user is forced to replace it at first sign-in.
export async function POST(req: Request) {
  const g = await manager(req);
  if (g instanceof Response) return g;
  const b = (await req.json().catch(() => null)) as { email?: string; full_name?: string; role?: string; tenant_id?: string; engagement_id?: string; valid_to?: string } | null;
  const email = b?.email?.trim().toLowerCase() ?? "", name = b?.full_name?.trim() ?? "", role = b?.role ?? "";
  if (!EMAIL.test(email) || email.length > 200 || !name || name.length > 120)
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "A valid email and a name are required." });
  if (role !== "PAC_CONSULTANT" && !(CLIENT_ROLES as readonly string[]).includes(role))
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "Unknown role." });

  // a Client Admin always creates inside their own tenant, whatever the body says
  const tenant = role === "PAC_CONSULTANT" ? null : g.role === "CLIENT_ADMIN" ? g.tenantId : (b?.tenant_id ?? null);
  const db = admin();
  const ok = await db.rpc("rpc_can_manage", { p_actor: g.a.userId, p_role: role, p_tenant: tenant as string });
  if (ok.error || ok.data !== true) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });

  const password = newPassword();
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) {
    return /already|registered|exists/i.test(created.error?.message ?? "")
      ? problem({ code: "EMAIL_IN_USE", status: 409, title: "That email already has an account." })
      : problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  }
  const id = created.data.user.id;
  const rec = await db.rpc("rpc_user_create", {
    p_actor: g.a.userId, p_user: id, p_name: name, p_role: role, p_tenant: tenant as string,
    p_engagement: role === "PAC_CONSULTANT" ? (b?.engagement_id ?? undefined) : undefined,
    p_valid_to: role === "PAC_CONSULTANT" ? (b?.valid_to ?? undefined) : undefined,
  });
  if (rec.error) { await db.auth.admin.deleteUser(id); return fromDbError(rec.error.message); }   // no half-created account
  return json({ user_id: id, email, role, temp_password: password }, 201);
}
