import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/staff";
import { checkTenant } from "@/lib/tenant-fields";
import { superAdmin } from "@/lib/users";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Replace the tenant record's details. The database refuses a change of hosting region or privacy regime once any
// engagement has left SETUP (RESIDENCY_LOCKED); the other fields stay editable.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await superAdmin(req);
  if (g instanceof Response) return g;
  const b = await readJson(req, 8 * 1024);
  if (b instanceof Response) return b;
  const c = checkTenant(b);
  if ("errors" in c) return problem({ code: "VALIDATION_FAILED", status: 422, title: c.errors[0], errors: c.errors });
  const dup = await admin().from("tenant").select("tenant_id").ilike("name", c.ok.name).neq("tenant_id", id).limit(1);
  if (dup.data?.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "An organisation with that name already exists." });
  const up = await admin().from("tenant").update({ ...c.ok, updated_by: g.a.userId }).eq("tenant_id", id).select("tenant_id");
  if (up.error) return fromDbError(up.error.message);
  if (!up.data?.length) return problem({ code: "NOT_FOUND", status: 404, title: "That organisation was not found." });
  await audit(id, g.a.userId, "tenant.updated", "tenant", id);
  return json({ tenant_id: id });
}
