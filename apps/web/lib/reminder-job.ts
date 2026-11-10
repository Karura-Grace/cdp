import "server-only";
import { admin } from "./supabase/admin";
import { loadCalendar } from "./launch-checks";
import { reminderPreview } from "./reminders";
import { emailConfigured, reminderMail, sendMail } from "./email";
import { audit } from "./audit";

// The daily reminder run (S2.6.2, AC-2.5). For every open survey, each reminder whose day has come is claimed once in the database
// (capture.claim_reminders logs it in the same statement), then emailed. Submitted links are never claimed, so reminders stop on
// submission. `today` is a parameter so a test can run it on a simulated clock.
export async function runReminders(today: string) {
  const db = admin();
  const { data: open } = await db.from("assessment").select("assessment_id, tenant_id, engagement_id, window_open, window_close")
    .eq("status", "LAUNCHED").is("frozen_at", null).gt("window_close", new Date().toISOString());
  const out: { assessment_id: string; kind: string; claimed: number; sent: number }[] = [];
  for (const a of open ?? []) {
    if (!a.window_open || !a.window_close) continue;
    const [{ data: rec }, cal, { data: ten }] = await Promise.all([
      db.from("setup_record").select("payload_json").eq("engagement_id", a.engagement_id).eq("section", "I").eq("perspective", "AGREED").maybeSingle(),
      loadCalendar(db, a.tenant_id),
      db.from("tenant").select("name").eq("tenant_id", a.tenant_id).single(),
    ]);
    const due = reminderPreview((rec?.payload_json ?? {}) as Record<string, unknown>, a.window_open.slice(0, 10), a.window_close.slice(0, 10), cal.holidays.map((h) => h.day))
      .filter((r) => !r.outside_window && r.on <= today);
    for (const r of due) {
      const final = r.audience === "STARTED_NOT_SUBMITTED";
      const { data: people, error } = await db.rpc("rpc_claim_reminders", { p_assessment_id: a.assessment_id, p_kind: r.kind, p_started_only: final });
      if (error) throw new Error(error.message);
      const ids = (people ?? []) as string[];
      let sent = 0;
      if (ids.length && emailConfigured()) {
        const { data: who } = await db.from("person_of_record").select("display_name, email").in("person_id", ids);
        const ok = await Promise.all((who ?? []).filter((p) => p.email).map((p) =>
          sendMail(reminderMail({ to: p.email!, name: p.display_name, org: ten?.name ?? "Your organisation", close: a.window_close, final }))));
        sent = ok.filter(Boolean).length;
      }
      if (ids.length) await audit(a.tenant_id, null, `reminders.sent:${r.kind}:${sent}/${ids.length}`, "assessment", a.assessment_id);
      out.push({ assessment_id: a.assessment_id, kind: r.kind, claimed: ids.length, sent });
    }
  }
  return out;
}
