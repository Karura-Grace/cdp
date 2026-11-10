import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { emailConfigured, sendMail } from "./email";

// Retention (spec 1.4.5, 6.6.3). Dates come from the engine's retentionSchedule; nothing is calculated here.
const isoDay = (s: string) => s.slice(0, 10);

/** Writes the retention schedule for an engagement from its assessment's window close. Refuses nothing: an existing schedule is returned unchanged. */
export async function scheduleRetention(engagementId: string): Promise<{ ok: true; schedule: Record<string, unknown>; created: boolean } | { ok: false; reason: "NO_ASSESSMENT" | "NO_WINDOW_CLOSE" }> {
  const db = admin();
  const { data: cur } = await db.from("retention_schedule").select("*").eq("engagement_id", engagementId).maybeSingle();
  if (cur) return { ok: true, schedule: cur, created: false };
  const { data: asm } = await db.from("assessment").select("assessment_id, tenant_id, window_close").eq("engagement_id", engagementId).neq("status", "SUPERSEDED").maybeSingle();
  if (!asm) return { ok: false, reason: "NO_ASSESSMENT" };
  if (!asm.window_close) return { ok: false, reason: "NO_WINDOW_CLOSE" };
  const close = isoDay(asm.window_close), r = E.retentionSchedule(close);
  const ins = await db.from("retention_schedule").insert({
    engagement_id: engagementId, tenant_id: asm.tenant_id, assessment_id: asm.assessment_id,
    close_date: close, destroy_on: r.destroy_on, notice_90_on: r.notice_90, notice_30_on: r.notice_30,
  }).select().single();
  if (ins.error) throw new Error("retention schedule failed: " + ins.error.message);
  return { ok: true, schedule: ins.data, created: true };
}

/**
 * Sends the 90 and 30 day notices that are due and not yet sent, to the tenant's Client Admins and to PAC (hello@pac.africa).
 * A notice is marked sent only when every message of it was accepted, so a failed send is tried again on the next call.
 */
export async function sendRetentionNotices(engagementId: string, today = new Date().toISOString().slice(0, 10)) {
  const db = admin();
  const { data: s } = await db.from("retention_schedule").select("*").eq("engagement_id", engagementId).maybeSingle();
  if (!s) return { ok: false as const, reason: "NOT_SCHEDULED" as const };
  if (s.destroyed_at) return { ok: true as const, sent: [] as number[], already_destroyed: true };
  if (!emailConfigured()) return { ok: false as const, reason: "EMAIL_NOT_CONFIGURED" as const };
  const [{ data: staff }, { data: ten }] = await Promise.all([db.rpc("rpc_tenant_staff", { p_tenant: s.tenant_id }), db.from("tenant").select("name").eq("tenant_id", s.tenant_id).single()]);
  const to = [...new Set([...(staff as { email: string; role: string }[]).filter((u) => u.role === "CLIENT_ADMIN").map((u) => u.email), "hello@pac.africa"])];
  const sent: number[] = [];
  for (const [days, due, at] of [[90, s.notice_90_on, s.notice_90_sent_at], [30, s.notice_30_on, s.notice_30_sent_at]] as const) {
    if (at || due > today) continue;
    const text = [
      `The survey responses held for ${ten?.name ?? "your organisation"} in the Culture Dynamics Profile will be permanently destroyed on ${s.destroy_on}, ${days} days from this notice.`,
      "",
      "Response level data is kept for 24 months after the survey closed. Reports, scores and plans are not affected.",
      "To ask for the data to be kept differently, write to hello@pac.africa before that date.",
      "",
      "Priority Activator Consulting",
    ].join("\n");
    const res = await Promise.all(to.map((t) => sendMail({ to: t, subject: `${ten?.name ?? "Your organisation"}: survey responses will be destroyed in ${days} days`, text })));
    if (res.every(Boolean)) {
      await db.from("retention_schedule").update(days === 90 ? { notice_90_sent_at: new Date().toISOString() } : { notice_30_sent_at: new Date().toISOString() }).eq("engagement_id", engagementId);
      sent.push(days);
    }
  }
  return { ok: true as const, sent, recipients: to.length };
}
