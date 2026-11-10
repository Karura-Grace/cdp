import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { checkCalendar } from "@/lib/calendar";
import { loadCalendar } from "@/lib/launch-checks";
import { consultantOnEngagement, graphReader, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Tenant calendar (spec 1.4.4 I4, Table 15): public holidays, which the consultant enters at setup (no lists are seeded), and the performance
// review period. Holidays decide the working day count of the survey window and the reminder dates.
// GET: the consultant, the Client Admin, the Super Admin and an Executive read it. PUT: the consultant only. After launch it is still allowed (owner
// decision, 18 October 2026): holidays and the review period are text only data that no scoring field reads, so the edit is kept and audited
// as calendar.edited_after_launch with the old and new counts. It does not move the survey window or any issued link.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphReader(req, id);
  if (g instanceof Response) return g;
  return json(await loadCalendar(admin(), g.eng.tenant_id));
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnEngagement(req, id);
  if (g instanceof Response) return g;
  if (g.eng.state === "CLOSED") return problem({ code: "SETUP_LOCKED", status: 409, title: "The engagement is closed, so the calendar is fixed." });
  const b = await readJson(req, 32 * 1024);
  if (b instanceof Response) return b;
  const c = checkCalendar(b);
  if ("errors" in c) return problem({ code: "VALIDATION_FAILED", status: 422, title: c.errors[0], errors: c.errors });

  const db = admin(), t = g.eng.tenant_id;
  const before = g.eng.state === "SETUP" ? null : await loadCalendar(db, t);
  const del = await db.from("tenant_holiday").delete().eq("tenant_id", t);
  if (del.error) return fromDbError(del.error.message);
  if (c.ok.holidays.length) {
    const ins = await db.from("tenant_holiday").insert(c.ok.holidays.map((h) => ({ tenant_id: t, day: h.day, label: h.label, created_by: g.a.userId })));
    if (ins.error) return fromDbError(ins.error.message);
  }
  const up = await db.from("tenant").update({ review_period_start: c.ok.review_period_start, review_period_end: c.ok.review_period_end, updated_by: g.a.userId }).eq("tenant_id", t);
  if (up.error) return fromDbError(up.error.message);
  await audit(t, g.a.userId, before
    ? `calendar.edited_after_launch:holidays ${before.holidays.length}>${c.ok.holidays.length};review ${before.review_start ?? "none"}/${before.review_end ?? "none"}>${c.ok.review_period_start ?? "none"}/${c.ok.review_period_end ?? "none"}`
    : `calendar.saved:${c.ok.holidays.length}`, "tenant", t);
  return json(await loadCalendar(db, t));
}
