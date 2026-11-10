import { audit } from "@/lib/audit";
import { admin } from "@/lib/supabase/admin";
import { checkSectionA } from "@/lib/tenant-fields";
import { actor, graphReader, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Setup A1 to A4 (name, sector, headcount, geography) mirror the tenant record. The tenant's Client Admin and the Super Admin may both edit them
// (decision 18 Oct 2026). Read: the consultant, Client Admin, Super Admin and Executives.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphReader(req, id);
  if (g instanceof Response) return g;
  const { data } = await admin().from("tenant").select("name, sector, headcount, geographies").eq("tenant_id", g.eng.tenant_id).single();
  return json({ ...data, can_edit: (g.role === "CLIENT_ADMIN" || g.role === "SUPER_ADMIN") && g.eng.state === "SETUP" });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data: eng } = await a.db.from("engagement").select("tenant_id, state").eq("engagement_id", id).maybeSingle();
  const { data: role } = eng ? await a.db.rpc("rpc_actor_role", { p_engagement: id }) : { data: null };
  if (!eng || !["CLIENT_ADMIN", "SUPER_ADMIN"].includes(role as string)) return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const c = checkSectionA(b);
  if ("errors" in c) return problem({ code: "VALIDATION_FAILED", status: 422, title: c.errors[0], errors: c.errors });
  const up = await admin().from("tenant").update({ ...c.ok, updated_by: a.userId }).eq("tenant_id", eng.tenant_id);
  if (up.error) return fromDbError(up.error.message);
  await audit(eng.tenant_id, a.userId, "tenant.section_a_edited", "tenant", eng.tenant_id);
  return json(c.ok);
}
