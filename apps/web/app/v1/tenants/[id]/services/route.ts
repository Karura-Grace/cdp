import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { actor, readJson } from "@/lib/staff";
import { SERVICES, servicesOf } from "@/lib/services";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// GET: the services a client has. PUT { services: [...] }: the Super Admin sets them (owner ruling 22 Oct 2026, Erick Ngala comment 40). Audited.
// Readable by the Super Admin and the PAC consultants and Client Admin of the client, so screens can show what is on.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in first." });
  const { data: scope } = await a.db.rpc("rpc_actor_scope");
  const s = scope as { role: string | null; tenant_id: string | null } | null;
  const ok = s?.role === "SUPER_ADMIN" || (s?.role === "CLIENT_ADMIN" && s.tenant_id === id);
  let consultant = false;
  if (!ok) {
    const { data: engs } = await admin().from("engagement").select("engagement_id").eq("tenant_id", id);
    for (const e of engs ?? []) if ((await a.db.rpc("rpc_actor_role", { p_engagement: e.engagement_id })).data === "PAC_CONSULTANT") { consultant = true; break; }
  }
  if (!ok && !consultant) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  return json({ tenant_id: id, services: await servicesOf(id), available: SERVICES });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in first." });
  const { data: scope } = await a.db.rpc("rpc_actor_scope");
  if ((scope as { role: string | null } | null)?.role !== "SUPER_ADMIN") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const list = b.services;
  if (!Array.isArray(list) || list.some((x) => !(SERVICES as readonly string[]).includes(String(x)))) return problem({ code: "VALIDATION_FAILED", status: 422, title: `services must be a list of: ${SERVICES.join(", ")}.` });
  const services = [...new Set(list.map(String))];
  const up = await admin().from("tenant").update({ services, updated_by: a.userId }).eq("tenant_id", id).select("tenant_id");
  if (up.error) return fromDbError(up.error.message);
  if (!up.data?.length) return problem({ code: "NOT_FOUND", status: 404, title: "That organisation was not found." });
  await audit(id, a.userId, `tenant.services_set:${services.join("+") || "none"}`, "tenant", id);
  return json({ tenant_id: id, services });
}
