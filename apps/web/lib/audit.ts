import { admin } from "./supabase/admin";

// Append-only audit row for a staff action (spec Appendix K). Throws if the insert fails: an unaudited change is not allowed.
export async function audit(tenantId: string | null, actor: string | null, action: string, objectType: string, objectId: string) {
  const { error } = await admin().from("audit_log").insert({ tenant_id: tenantId, actor_id: actor, action, object_type: objectType, object_id: objectId });
  if (error) throw new Error("audit failed: " + error.message);
}
