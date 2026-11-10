import { admin } from "./supabase/admin";
import { checkCreate } from "./privacy";
import { splitValues } from "./section-i.mjs";

// Demographic attributes are DECLARED INSIDE SECTION I (spec 1.4.1, 1.4.5, owner decision 18 October 2026). When Section I is agreed, each declared
// attribute is written to public.demographic_attribute (name, closed value list, is_sensitive, analytical purpose). The privacy page reads the same
// table and keeps its own add form. The same checks as that form run here (lib/privacy.ts checkCreate), so there is one rule.
// An attribute that already exists (same name, ignoring case) is updated; a value that people already hold is never dropped from its list.
export async function syncDemographics(tenantId: string, userId: string, payload: Record<string, unknown>): Promise<{ written: number } | { error: string }> {
  const list = (payload.demographics as Record<string, unknown>[] | undefined) ?? [];
  if (!list.length) return { written: 0 };
  const db = admin();
  const { data: have } = await db.from("demographic_attribute").select("attr_id, name").eq("tenant_id", tenantId);
  let written = 0;
  for (const d of list) {
    const c = await checkCreate("demographics", { name: d.name, values: splitValues(d.values), is_sensitive: d.is_sensitive === true, analytical_purpose: d.analytical_purpose }, tenantId);
    if ("error" in c) return { error: `Demographic attribute ${String(d.name ?? "")}: ${c.error}` };
    const row = c.row as { name: string; values_list: string[]; is_sensitive: boolean; analytical_purpose: string };
    const old = (have ?? []).find((h) => h.name.trim().toLowerCase() === row.name.toLowerCase());
    if (old) {
      const { data: held } = await db.from("person_demographic").select("value").eq("attr_id", old.attr_id).eq("tenant_id", tenantId);
      const dropped = [...new Set((held ?? []).map((h) => h.value))].filter((v) => !row.values_list.includes(v));
      if (dropped.length) return { error: `Demographic attribute ${row.name}: people already hold ${dropped.slice(0, 3).join(", ")}, so those values must stay in the list.` };
      const up = await db.from("demographic_attribute").update({ values_list: row.values_list, is_sensitive: row.is_sensitive, analytical_purpose: row.analytical_purpose, updated_by: userId }).eq("attr_id", old.attr_id);
      if (up.error) return { error: up.error.message };
    } else {
      const ins = await db.from("demographic_attribute").insert({ ...row, tenant_id: tenantId, created_by: userId });
      if (ins.error) return { error: ins.error.message };
    }
    written++;
  }
  return { written };
}
