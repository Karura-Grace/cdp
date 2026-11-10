import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { readJson } from "@/lib/staff";
import { checkSectionA } from "@/lib/tenant-fields";
import { superAdmin } from "@/lib/users";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Setup A1 to A4 (name, sector, headcount, geography) of one client, from the Super Admin's page across clients (owner ruling 19 Oct 2026).
// Same rule as the setup screen: editable only while the client's latest engagement is in SETUP (or it has none yet).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await superAdmin(req);
  if (g instanceof Response) return g;
  const { data: eng } = await admin().from("engagement").select("state").eq("tenant_id", id).order("cycle_no", { ascending: false }).limit(1).maybeSingle();
  if (eng && eng.state !== "SETUP") return problem({ code: "SETUP_LOCKED", status: 409, title: "Setup is locked because the assessment has launched." });
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const c = checkSectionA(b);
  if ("errors" in c) return problem({ code: "VALIDATION_FAILED", status: 422, title: c.errors[0], errors: c.errors });
  const dup = await admin().from("tenant").select("tenant_id").ilike("name", c.ok.name).neq("tenant_id", id).limit(1);
  if (dup.data?.length) return problem({ code: "VALIDATION_FAILED", status: 422, title: "An organisation with that name already exists." });
  const up = await admin().from("tenant").update({ ...c.ok, updated_by: g.a.userId }).eq("tenant_id", id).select("tenant_id");
  if (up.error) return fromDbError(up.error.message);
  if (!up.data?.length) return problem({ code: "NOT_FOUND", status: 404, title: "That organisation was not found." });
  await audit(id, g.a.userId, "tenant.section_a_edited", "tenant", id);
  return json(c.ok);
}
