import * as E from "@pac/cdp-engine";

// The reminder plan (spec 1.4.4 reminder_plan, 2.6.2) as dates. Sending belongs to the scheduler journey; this is the visible
// "reminders scheduled" preview and the check that no reminder falls outside the window. The standard plan comes from the engine.
export interface ReminderRow { kind: string; on: string; audience: string; outside_window: boolean }
type Plan = { reminder_plan?: unknown; reminder_custom?: { kind?: string; n?: number; audience?: string }[] };

export function reminderPreview(p: Plan, open: string, close: string, holidays: string[]): ReminderRow[] {
  const o = open.slice(0, 10), c = close.slice(0, 10);
  const rows = p.reminder_plan === "CUSTOM"
    ? (p.reminder_custom ?? []).filter((r) => typeof r.n === "number").map((r) => ({
        kind: r.kind === "HOURS_BEFORE_CLOSE" ? `${r.n} hours before close` : `Working day ${r.n}`,
        on: r.kind === "HOURS_BEFORE_CLOSE" ? E.addDays(c, -Math.ceil(r.n! / 24)) : E.addWorkingDays(o, r.n!, holidays),
        audience: r.audience ?? "NOT_SUBMITTED",
      }))
    : E.reminderSchedule(o, c, holidays).map((r) => ({
        kind: { REMINDER_WD3: "Working day 3", REMINDER_WD6: "Working day 6", REMINDER_CLOSE_24H: "24 hours before close", FINAL_STARTED_NOT_SUBMITTED: "Final reminder" }[r.kind] ?? r.kind,
        on: r.on, audience: r.audience,
      }));
  return rows.map((r) => ({ ...r, outside_window: r.on < o || r.on > c })).sort((a, b) => a.on.localeCompare(b.on));
}
