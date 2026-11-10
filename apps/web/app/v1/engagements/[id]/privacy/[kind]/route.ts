import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { graphEditor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";
import { CLIENT_CAN_WRITE, KINDS, TABLE, bad, checkCreate, openObjectionTask, type Kind } from "@/lib/privacy";

export const runtime = "nodejs";

// One handler for the tenant's data protection records (spec 1.4.5): dpia, register, breaches, requests, demographics, coach-assignments.
// Reads: the consultant and the Client Admin, through the caller's own client (RLS). Writes: the consultant; also the Client Admin for
// requests and demographics. Coach assignments are the consultant's alone. A Coach, Executive or People Leader gets 403.
const known = (k: string): k is Kind => (KINDS as readonly string[]).includes(k);
const notFound = () => problem({ code: "NOT_FOUND", status: 404, title: "Unknown record type." });

export async function GET(req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (!known(kind)) return notFound();
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  const { data, error } = await g.a.db.from(TABLE[kind]).select("*").eq("tenant_id", g.eng.tenant_id).order("tenant_id");
  return error ? fromDbError(error.message) : json(data);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  const { id, kind } = await params;
  if (!known(kind)) return notFound();
  const g = await graphEditor(req, id, !CLIENT_CAN_WRITE.includes(kind));
  if (g instanceof Response) return g;
  const b = await readJson(req, 16 * 1024);
  if (b instanceof Response) return b;
  const c = await checkCreate(kind, b, g.eng.tenant_id);
  if ("error" in c) return bad(c.error);
  const who = { dpia: "recorded_by", register: "recorded_by", breaches: "opened_by", demographics: "created_by", "coach-assignments": "created_by" } as Partial<Record<Kind, string>>;
  const row = { ...c.row, tenant_id: g.eng.tenant_id, ...(who[kind] ? { [who[kind]!]: g.a.userId } : {}) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ins = await (admin().from(TABLE[kind]) as any).insert(row).select().single();
  if (ins.error) return /unique|duplicate/i.test(ins.error.message) ? bad("An attribute with that name already exists.") : fromDbError(ins.error.message);
  await audit(g.eng.tenant_id, g.a.userId, `privacy.${kind}.created`, TABLE[kind], Object.values(ins.data as Record<string, string>)[0]);
  if (kind === "requests") { const r = ins.data as { request_id: string; kind: string; subject_ref: string; detail: string | null }; if (r.kind === "OBJECT") await openObjectionTask(g.eng.tenant_id, r.request_id, r.subject_ref, r.detail); }
  return json(ins.data, 201);
}
