import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { json, problem } from "@/lib/problem";
import { dueDefault, openObjectionTask } from "@/lib/privacy";

export const runtime = "nodejs";

// Data subject rights by invitation token (spec 1.4.5): access, rectification of demographic attributes, objection, erasure of the invitation record.
// Only a valid link that has not been used to submit holds anything about a person. After submit the link to the person is already destroyed, so
// nothing can be found, corrected or erased; the answer says so. Never logs the token. Requests are recorded in data_subject_request, due 30 days after
// they are opened (staff can change the date). An objection also opens a consultant task and stops further links to that person.
const tokenOf = (req: Request) => req.headers.get("x-survey-token") ?? "";
const GONE = { code: "TOKEN_INVALID", status: 410, title: "This link is no longer valid." } as const;
const UNLINKED = "You have already submitted. Your answers were separated from your name when you submitted and cannot be individually found, changed or deleted, by you or by anyone else.";

async function ctx(req: Request) {
  const t = tokenOf(req);
  if (!/^[0-9a-f]{32}$/.test(t)) return { err: problem(GONE) };
  const { data } = await admin().rpc("rpc_rights_context", { p_token: t });
  const c = data as { state: string; person_id?: string; tenant_id?: string } | null;
  if (!c || c.state === "INVALID") return { err: problem(GONE) };
  if (c.state === "SUBMITTED") return { err: json({ state: "SUBMITTED", message: UNLINKED }) };
  if (c.state === "ANONYMOUS") return { err: json({ state: "ANONYMOUS", message: "This link is not tied to a person, so nothing about you is held against it." }) };
  return { token: t, person: c.person_id!, tenant: c.tenant_id! };
}

export async function GET(req: Request) {
  const c = await ctx(req); if (c.err) return c.err;
  const db = admin();
  const [{ data: p }, { data: attrs }, { data: vals }] = await Promise.all([
    db.from("person_of_record").select("employee_ref, email, display_name, employment_status").eq("person_id", c.person!).single(),
    db.from("demographic_attribute").select("attr_id, name, values_list, is_sensitive").eq("tenant_id", c.tenant!).order("name"),
    db.from("person_demographic").select("attr_id, value").eq("person_id", c.person!),
  ]);
  const v = new Map((vals ?? []).map((x) => [x.attr_id, x.value]));
  return json({ state: "OPEN", person: p, demographics: (attrs ?? []).map((a) => ({ ...a, value: v.get(a.attr_id) ?? null })),
    note: "Answers you submit are separated from your name at the moment you submit and cannot be retrieved or deleted afterwards." });
}

async function record(c: { person: string; tenant: string }, kind: string, status: "OPEN" | "DONE", detail: string | null, note?: string) {
  const db = admin();
  const { data: p } = await db.from("person_of_record").select("employee_ref").eq("person_id", c.person).single();
  const ins = await db.from("data_subject_request").insert({ tenant_id: c.tenant, kind, subject_ref: p!.employee_ref, detail, status, due_on: dueDefault(),
    ...(status === "DONE" ? { closed_at: new Date().toISOString(), closed_note: note ?? "Done by the person through their survey link." } : {}) }).select("request_id").single();
  await audit(c.tenant, null, `rights.${kind.toLowerCase()}.self_service`, "data_subject_request", ins.data?.request_id ?? "");
  if (kind === "OBJECT") await openObjectionTask(c.tenant, ins.data?.request_id ?? null, p!.employee_ref, detail);
  return ins.data?.request_id ?? null;
}

// rectify: { attr_id, value } (value null clears it)
export async function PUT(req: Request) {
  const c = await ctx(req); if (c.err) return c.err;
  let b: { attr_id?: unknown; value?: unknown };
  try { b = JSON.parse((await req.text()).slice(0, 2048)); } catch { b = {}; }
  if (typeof b.attr_id !== "string" || (b.value !== null && typeof b.value !== "string")) return problem({ code: "VALIDATION_FAILED", status: 422, title: "attr_id and value (text or null) are required." });
  const db = admin();
  const { data: a } = await db.from("demographic_attribute").select("values_list").eq("attr_id", b.attr_id).eq("tenant_id", c.tenant!).maybeSingle();
  if (!a) return problem({ code: "VALIDATION_FAILED", status: 422, title: "That attribute is not part of this survey." });
  if (b.value === null) await db.from("person_demographic").delete().eq("person_id", c.person!).eq("attr_id", b.attr_id);
  else {
    if (!a.values_list.includes(b.value)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Choose one of the listed values." });
    const up = await db.from("person_demographic").upsert({ person_id: c.person!, attr_id: b.attr_id, tenant_id: c.tenant!, value: b.value });
    if (up.error) return problem({ code: "INTERNAL", status: 500, title: "Something went wrong." });
  }
  await record({ person: c.person!, tenant: c.tenant! }, "RECTIFY", "DONE", `attribute ${b.attr_id}`);
  return json({ attr_id: b.attr_id, value: b.value });
}

// object: { kind: "OBJECT", detail? } is logged for staff to act on. erase: { kind: "ERASE" } deletes the invitation, so the link stops working.
export async function POST(req: Request) {
  const c = await ctx(req); if (c.err) return c.err;
  let b: { kind?: unknown; detail?: unknown };
  try { b = JSON.parse((await req.text()).slice(0, 4096)); } catch { b = {}; }
  const detail = typeof b.detail === "string" && b.detail.trim() ? b.detail.trim().slice(0, 2000) : null;
  const me = { person: c.person!, tenant: c.tenant! };
  if (b.kind === "OBJECT") return json({ request_id: await record(me, "OBJECT", "OPEN", detail), status: "OPEN" }, 201);
  if (b.kind === "ERASE") {
    const { data: gone } = await admin().rpc("rpc_erase_invitation", { p_token: c.token! });
    if (!gone) return problem(GONE);
    return json({ request_id: await record(me, "ERASE", "DONE", detail, "The invitation record was erased at the person's request."), status: "DONE" }, 201);
  }
  return problem({ code: "VALIDATION_FAILED", status: 422, title: "kind must be OBJECT or ERASE." });
}
