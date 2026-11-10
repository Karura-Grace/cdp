import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/staff";
import { checkTenant } from "@/lib/tenant-fields";
import { superAdmin } from "@/lib/users";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Table 13: only a Super Admin creates a tenant. Hosting region and privacy regime are fixed once an engagement launches.
export async function POST(req: Request) {
  const g = await superAdmin(req);
  if (g instanceof Response) return g;
  const b = await readJson(req, 8 * 1024);
  if (b instanceof Response) return b;
  const c = checkTenant(b);
  if ("errors" in c) return problem({ code: "VALIDATION_FAILED", status: 422, title: c.errors[0], errors: c.errors });
  const dup = await admin().from("tenant").select("tenant_id").ilike("name", c.ok.name).limit(1);
  if (dup.data?.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "An organisation with that name already exists." });
  const ins = await admin().from("tenant").insert({ ...c.ok, created_by: g.a.userId }).select("tenant_id").single();
  if (ins.error) return fromDbError(ins.error.message);
  await audit(ins.data.tenant_id, g.a.userId, "tenant.created", "tenant", ins.data.tenant_id);
  return json({ tenant_id: ins.data.tenant_id }, 201);
}
