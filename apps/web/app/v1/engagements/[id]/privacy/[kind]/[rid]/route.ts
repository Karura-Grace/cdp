import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { graphEditor, readJson } from "@/lib/staff";
import { json, problem } from "@/lib/problem";
import { bad, daysBefore } from "@/lib/privacy";

export const runtime = "nodejs";

// Changes to one record. breaches: record the notification (consultant). requests: set a due date or close as DONE or REFUSED (consultant or
// Client Admin). coach-assignments: end the assignment now (consultant). Everything else is write once.
const conflict = (title: string) => problem({ code: "ILLEGAL_TRANSITION", status: 409, title });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; kind: string; rid: string }> }) {
  const { id, kind, rid } = await params;
  if (!["breaches", "requests", "coach-assignments"].includes(kind)) return problem({ code: "NOT_FOUND", status: 404, title: "That record type does not change." });
  const g = await graphEditor(req, id, kind !== "requests");
  if (g instanceof Response) return g;
  const b = await readJson(req, 4 * 1024);
  if (b instanceof Response) return b;
  const db = admin(), tenant = g.eng.tenant_id;

  if (kind === "breaches") {
    const { data: cur } = await db.from("breach_incident").select("incident_id, notified_at").eq("incident_id", rid).eq("tenant_id", tenant).maybeSingle();
    if (!cur) return problem({ code: "NOT_FOUND", status: 404, title: "No such incident." });
    if (cur.notified_at) return conflict("The notification is already recorded.");
    const ref = typeof b.regulator_ref === "string" ? b.regulator_ref.trim().slice(0, 200) || null : null;
    const up = await db.from("breach_incident").update({ notified_at: new Date().toISOString(), regulator_ref: ref }).eq("incident_id", rid);
    if (up.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
    await audit(tenant, g.a.userId, "privacy.breach.notified", "breach_incident", rid);
    return json({ incident_id: rid, notified: true });
  }

  if (kind === "requests") {
    const { data: cur } = await db.from("data_subject_request").select("request_id, status").eq("request_id", rid).eq("tenant_id", tenant).maybeSingle();
    if (!cur) return problem({ code: "NOT_FOUND", status: 404, title: "No such request." });
    if (cur.status !== "OPEN") return conflict("The request is already closed.");
    const patch: { due_on?: string; status?: string; closed_at?: string; closed_note?: string } = {};
    if (b.due_on !== undefined) { if (typeof b.due_on !== "string" || !DAY.test(b.due_on)) return bad("due_on must be a date (YYYY-MM-DD)."); patch.due_on = b.due_on; }
    if (b.status !== undefined) {
      if (b.status !== "DONE" && b.status !== "REFUSED") return bad("status must be DONE or REFUSED.");
      const note = typeof b.note === "string" ? b.note.trim() : "";
      if (!note || note.length > 2000) return bad("A closing note (up to 2000 characters) is required.");
      Object.assign(patch, { status: b.status, closed_at: new Date().toISOString(), closed_note: note });
    }
    if (!Object.keys(patch).length) return bad("Nothing to change: send due_on or status.");
    const up = await db.from("data_subject_request").update(patch).eq("request_id", rid);
    if (up.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
    await audit(tenant, g.a.userId, patch.status ? `privacy.request.${String(patch.status).toLowerCase()}` : "privacy.request.due_set", "data_subject_request", rid);
    return json({ request_id: rid, ...patch });
  }

  // coach assignment: ending takes effect today. An assignment that had not started is moved wholly into the past so it never grants anything.
  const { data: cur } = await db.from("coach_assignment").select("from_date, to_date").eq("coach_assignment_id", rid).eq("tenant_id", tenant).maybeSingle();
  if (!cur) return problem({ code: "NOT_FOUND", status: 404, title: "No such assignment." });
  const yesterday = daysBefore(1);
  if (cur.to_date <= yesterday) return conflict("The assignment has already ended.");
  const up = await db.from("coach_assignment").update({ to_date: yesterday, from_date: cur.from_date < yesterday ? cur.from_date : yesterday }).eq("coach_assignment_id", rid);
  if (up.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  await audit(tenant, g.a.userId, "privacy.coach_assignment.ended", "coach_assignment", rid);
  return json({ coach_assignment_id: rid, ended: true, to_date: yesterday });
}
