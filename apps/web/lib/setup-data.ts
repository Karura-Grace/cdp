import { admin } from "./supabase/admin";
import type { Json } from "./setup-sections";

/** Section C KPIs (id, name, direction, baseline) for the Section D checks. With `orDraft`, a Client Admin draft of C stands in until C is agreed. */
export async function sectionKpis(engagementId: string, orDraft = false): Promise<Json[]> {
  const { data } = await admin().from("setup_record").select("perspective, payload_json").eq("engagement_id", engagementId).eq("section", "C").in("perspective", orDraft ? ["AGREED", "EXECUTIVE"] : ["AGREED"]);
  const row = data?.find((r) => r.perspective === "AGREED") ?? data?.[0];
  return ((row?.payload_json as Json | undefined)?.kpis as Json[] | undefined) ?? [];
}
