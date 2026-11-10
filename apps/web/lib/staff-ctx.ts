import type { TemplateContext } from "./staff-message";

import type { SupabaseClient } from "@supabase/supabase-js";
type Db = SupabaseClient;   // the service client or a user client: both read these rows

/** The context for the staff message template: the organisation, its purpose, and who signs and who helps (Setup Section A). One place, so the launch
 *  screen, the approval page and the pre flight all build the same text and the "template used word for word" check cannot drift. */
export async function staffContext(db: Db, engagementId: string, tenantId: string): Promise<TemplateContext> {
  const [{ data: eng }, { data: ten }, { data: a }] = await Promise.all([
    db.from("engagement").select("purpose").eq("engagement_id", engagementId).single(),
    db.from("tenant").select("name, legal_name").eq("tenant_id", tenantId).single(),
    db.from("setup_record").select("payload_json").eq("engagement_id", engagementId).eq("section", "A").eq("perspective", "AGREED").maybeSingle(),
  ]);
  const pa = (a?.payload_json ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof pa[k] === "string" ? (pa[k] as string).trim() : "");
  return { org: ten?.legal_name ?? ten?.name ?? "", purpose: eng?.purpose ?? null,
    sender: s("sponsor_name") ? { name: s("sponsor_name"), role: s("sponsor_role") } : null, help: s("help_email") ? { name: s("help_name"), email: s("help_email") } : null };
}
