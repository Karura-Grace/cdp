import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { graphEditor, readJson } from "@/lib/staff";
import { json } from "@/lib/problem";
import { bad } from "@/lib/privacy";

export const runtime = "nodejs";

// A person's value for a demographic attribute, chosen from the attribute's closed list (spec 1.4.1, 1.4.5). value null clears it, which reads as
// "prefer not to say" for a sensitive attribute. No free text: a value outside the list is refused. Consultant or Client Admin.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 2 * 1024);
  if (b instanceof Response) return b;
  if (typeof b.person_id !== "string" || typeof b.attr_id !== "string" || (b.value !== null && typeof b.value !== "string")) return bad("person_id, attr_id and value (text or null) are required.");
  const db = admin(), tenant = g.eng.tenant_id;
  const [{ data: attr }, { data: person }] = await Promise.all([
    db.from("demographic_attribute").select("values_list").eq("attr_id", b.attr_id).eq("tenant_id", tenant).maybeSingle(),
    db.from("person_of_record").select("person_id").eq("person_id", b.person_id).eq("tenant_id", tenant).maybeSingle(),
  ]);
  if (!attr || !person) return bad("The attribute or person is not part of this organisation.");
  if (b.value === null) await db.from("person_demographic").delete().eq("person_id", b.person_id).eq("attr_id", b.attr_id);
  else {
    if (!attr.values_list.includes(b.value)) return bad("The value must be one of the attribute's listed choices.");
    const up = await db.from("person_demographic").upsert({ person_id: b.person_id, attr_id: b.attr_id, tenant_id: tenant, value: b.value });
    if (up.error) return bad("The value could not be saved.");
  }
  await audit(tenant, g.a.userId, "privacy.demographic_value.set", "person_demographic", `${b.person_id}:${b.attr_id}`);
  return json({ person_id: b.person_id, attr_id: b.attr_id, value: b.value });
}
