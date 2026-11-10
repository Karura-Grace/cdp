import { admin } from "./supabase/admin";
import { problem } from "./problem";

// Data protection records (spec 1.4.5). Each kind: who writes it, how the body is checked, and the row to insert.
// Reads go through the caller's own client so RLS decides. Nothing here touches responses.
export const KINDS = ["dpia", "register", "breaches", "requests", "demographics", "coach-assignments"] as const;
export type Kind = (typeof KINDS)[number];
export const TABLE = { dpia: "dpia_record", register: "processing_register", breaches: "breach_incident", requests: "data_subject_request", demographics: "demographic_attribute", "coach-assignments": "coach_assignment" } as const;
/** Writers: the consultant, and also the Client Admin for rights requests and demographics (the client is the controller). */
export const CLIENT_CAN_WRITE: Kind[] = ["requests", "demographics"];

export const SENSITIVE_DEFAULT = "Prefer not to say";   // spec 1.4.5: sensitive attributes default to "prefer not to say"
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_KINDS = ["ACCESS", "RECTIFY", "OBJECT", "ERASE"];

type R = { row: Record<string, unknown> } | { error: string };
const text = (b: Record<string, unknown>, k: string, max: number, min = 1) => {
  const v = typeof b[k] === "string" ? (b[k] as string).trim() : "";
  return v.length >= min && v.length <= max ? v : null;
};
const need = (b: Record<string, unknown>, spec: Record<string, number>): R => {
  const row: Record<string, unknown> = {};
  for (const [k, max] of Object.entries(spec)) { const v = text(b, k, max); if (v === null) return { error: `${k} is required (up to ${max} characters).` }; row[k] = v; }
  return { row };
};

/** Checks a create body. `staff` is the tenant's staff list (user id, role) for the coach check; `people` the tenant's person ids. */
export async function checkCreate(kind: Kind, b: Record<string, unknown>, tenantId: string): Promise<R> {
  switch (kind) {
    case "dpia": return need(b, { reference: 200, transfer_basis: 500 });
    case "register": return need(b, { activity: 200, purpose: 500, data_categories: 500, legal_basis: 200, retention: 200 });
    case "breaches": {
      const r = need(b, { summary: 2000 }); if ("error" in r) return r;
      const opened = new Date(); return { row: { ...r.row, opened_at: opened.toISOString(), notify_by: new Date(opened.getTime() + 72 * 3600e3).toISOString() } };   // 72 hours (spec 1.4.5)
    }
    case "requests": {
      if (!REQUEST_KINDS.includes(String(b.kind))) return { error: `kind must be one of ${REQUEST_KINDS.join(", ")}.` };
      const r = need(b, { subject_ref: 120 }); if ("error" in r) return r;
      // decision of 18 October 2026: 30 days after opening unless the caller states another date
      const due = b.due_on === "" ? null : b.due_on;
      if (due !== undefined && due !== null && (typeof due !== "string" || !DAY.test(due) || isNaN(Date.parse(due)))) return { error: "due_on must be a date (YYYY-MM-DD), or left out for 30 days from today." };
      const detail = b.detail === undefined || b.detail === null ? null : text(b, "detail", 2000);
      if (b.detail && !detail) return { error: "detail is up to 2000 characters." };
      return { row: { ...r.row, kind: b.kind, due_on: (due as string | null | undefined) || dueDefault(), detail } };
    }
    case "demographics": {
      const r = need(b, { name: 60, analytical_purpose: 500 }); if ("error" in r) return r;
      if (String(r.row.analytical_purpose).length < 10) return { error: "analytical_purpose must say why the attribute is needed (at least 10 characters)." };
      const raw = b.values;
      if (!Array.isArray(raw) || raw.some((v) => typeof v !== "string" || !v.trim() || v.trim().length > 60)) return { error: "values must be a closed list of short texts." };
      const vals = [...new Set((raw as string[]).map((v) => v.trim()))];
      const sensitive = b.is_sensitive === true;
      if (sensitive && !vals.some((v) => v.toLowerCase() === SENSITIVE_DEFAULT.toLowerCase())) vals.push(SENSITIVE_DEFAULT);
      if (vals.length < 2 || vals.length > 30) return { error: "values needs 2 to 30 distinct choices." };
      return { row: { ...r.row, values_list: vals, is_sensitive: sensitive } };
    }
    case "coach-assignments": {
      if (typeof b.coach_user_id !== "string" || !UUID.test(b.coach_user_id)) return { error: "coach_user_id must be a user id." };
      if (typeof b.from_date !== "string" || typeof b.to_date !== "string" || !DAY.test(b.from_date) || !DAY.test(b.to_date) || b.to_date < b.from_date) return { error: "from_date and to_date are required dates (YYYY-MM-DD), to on or after from." };
      const ids = b.leader_person_ids;
      if (!Array.isArray(ids) || !ids.length || ids.length > 200 || ids.some((x) => typeof x !== "string")) return { error: "leader_person_ids must list at least one person id." };
      const db = admin();
      const [{ data: staff }, { data: ppl }] = await Promise.all([
        db.rpc("rpc_tenant_staff", { p_tenant: tenantId }),
        db.from("person_of_record").select("person_id").eq("tenant_id", tenantId).in("person_id", ids as string[]),
      ]);
      if (!(staff as { user_id: string; role: string }[]).some((u) => u.user_id === b.coach_user_id && u.role === "COACH")) return { error: "That user is not a Coach of this organisation." };
      if ((ppl?.length ?? 0) !== new Set(ids as string[]).size) return { error: "A leader is not a person of this organisation." };
      return { row: { coach_user_id: b.coach_user_id, leader_person_ids: [...new Set(ids as string[])], from_date: b.from_date, to_date: b.to_date } };
    }
  }
}

/** The answer is due this many days after a request is opened (owner decision, 18 October 2026). The database trigger applies the same default to rows written elsewhere. */
export const REQUEST_DAYS = 30;
export const dueDefault = (from = new Date()) => new Date(from.getTime() + REQUEST_DAYS * 864e5).toISOString().slice(0, 10);

/** An objection blocks further links to that person (the database skips them when links are issued), ends every link already issued
 *  and not yet used (owner ruling, 19 October 2026), and gives the consultant a visible task. */
export async function openObjectionTask(tenantId: string, requestId: string | null, subjectRef: string, detail: string | null) {
  const { data: revoked } = await admin().rpc("rpc_revoke_person_links", { p_tenant_id: tenantId, p_employee_ref: subjectRef });
  await admin().from("consultant_task").insert({ tenant_id: tenantId, kind: "OBJECTION", source_ref: requestId, detail,
    title: `Objection from ${subjectRef}: ${revoked ? `${revoked} open link${revoked === 1 ? "" : "s"} ended and no` : "no"} further survey links will be sent to this person. Decide how to answer.` });
}

/** Employee references with an open or done objection: nobody is sent a link for them. */
export async function objectingRefs(tenantId: string): Promise<Set<string>> {
  const { data } = await admin().from("data_subject_request").select("subject_ref").eq("tenant_id", tenantId).eq("kind", "OBJECT").in("status", ["OPEN", "DONE"]);
  return new Set((data ?? []).map((r) => r.subject_ref));
}

/** ODPC registration: both the reference and the date it was confirmed, or neither. */
export function checkOdpc(b: Record<string, unknown>): { ref: string; confirmed_on: string } | { error: string } {
  const ref = typeof b.odpc_registration_ref === "string" ? b.odpc_registration_ref.trim() : "";
  if (!ref || ref.length > 100) return { error: "odpc_registration_ref is required (up to 100 characters)." };
  const on = b.odpc_confirmed_on;
  if (typeof on !== "string" || !DAY.test(on) || isNaN(Date.parse(on)) || new Date(on + "T00:00:00Z").toISOString().slice(0, 10) !== on) return { error: "odpc_confirmed_on must be a date (YYYY-MM-DD)." };
  if (on > new Date().toISOString().slice(0, 10)) return { error: "odpc_confirmed_on must not be in the future." };
  return { ref, confirmed_on: on };
}

export const bad = (title: string) => problem({ code: "VALIDATION_FAILED", status: 422, title });
export const today = () => new Date().toISOString().slice(0, 10);
export const daysBefore = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
