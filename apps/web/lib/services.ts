import { admin } from "./supabase/admin";
import { problem } from "./problem";

/** The parts of the platform a client has paid for or selected (owner ruling 22 Oct 2026, Erick Ngala comment 40). The Super Admin ticks them per client;
 *  a new client starts with none. Pure data here, so client screens can import the list. */
import { SERVICES, SERVICE_LABEL, type Service } from "./services-list";
export { SERVICES, SERVICE_LABEL, type Service };

export async function servicesOf(tenantId: string): Promise<Service[]> {
  const { data } = await admin().from("tenant").select("services").eq("tenant_id", tenantId).maybeSingle();
  return ((data?.services ?? []) as Service[]).filter((s) => (SERVICES as readonly string[]).includes(s));
}

/** null when the client has the service, otherwise the 403 to return. The check every API route behind a paid service starts with. */
export async function requireService(tenantId: string, key: Service): Promise<Response | null> {
  return (await servicesOf(tenantId)).includes(key) ? null
    : problem({ code: "SERVICE_NOT_ENABLED", status: 403, title: `${SERVICE_LABEL[key].name} is not part of this client's services. Ask PAC to enable it.` });
}

/** The same check from an assessment or an engagement id (most routes start from one of those). */
export async function requireServiceForAssessment(assessmentId: string, key: Service): Promise<Response | null> {
  const { data } = await admin().from("assessment").select("tenant_id").eq("assessment_id", assessmentId).maybeSingle();
  return data ? requireService(data.tenant_id, key) : null;     // an unknown assessment is refused by the route's own role check
}
export async function requireServiceForEngagement(engagementId: string, key: Service): Promise<Response | null> {
  const { data } = await admin().from("engagement").select("tenant_id").eq("engagement_id", engagementId).maybeSingle();
  return data ? requireService(data.tenant_id, key) : null;
}
export async function requireServiceForPulse(pulseId: string, key: Service): Promise<Response | null> {
  const { data } = await admin().from("pulse").select("tenant_id").eq("pulse_id", pulseId).maybeSingle();
  return data ? requireService(data.tenant_id, key) : null;
}
