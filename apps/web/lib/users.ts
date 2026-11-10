import { randomBytes } from "node:crypto";
import { actor, type Actor } from "./staff";
import { problem } from "./problem";

export type ManagerRole = "SUPER_ADMIN" | "CLIENT_ADMIN";
export const CLIENT_ROLES = ["CLIENT_ADMIN", "EXECUTIVE", "PEOPLE_LEADER", "COACH"] as const;

/** 16 random characters (96 bits) plus "Aa1", so it always meets the Supabase rule (12+, upper, lower, digit). Shown once to
 *  the admin who issued it; the user must replace it at first sign-in. */
export const newPassword = () => randomBytes(12).toString("base64url") + "Aa1";

/**
 * The caller must be a Super Admin or a Client Admin. Their role comes from the database through their own token
 * (rpc_actor_scope), never from a client-supplied field. Every write function then checks again.
 */
export async function manager(req: Request): Promise<{ a: Actor; role: ManagerRole; tenantId: string | null } | Response> {
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data } = await a.db.rpc("rpc_actor_scope");
  const s = data as { role: string | null; tenant_id: string | null } | null;
  if (s?.role !== "SUPER_ADMIN" && s?.role !== "CLIENT_ADMIN")
    return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  return { a, role: s.role, tenantId: s.tenant_id };
}

/** The caller must be a Super Admin (Table 13: tenants and engagements are created by Super Admin only). */
export async function superAdmin(req: Request): Promise<{ a: Actor } | Response> {
  const g = await manager(req);
  if (g instanceof Response) return g;
  return g.role === "SUPER_ADMIN" ? { a: g.a } : problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
}
