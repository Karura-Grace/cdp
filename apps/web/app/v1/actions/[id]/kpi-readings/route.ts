import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { actionFor } from "@/lib/plan";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST { value, read_on, note? }: a KPI reading on a published action. Any role on the engagement except Coach.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 2048);
  if (b instanceof Response) return b;
  const found = await actionFor(a, id);
  if (!found || found.role === "COACH") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const value = String(b.value ?? ""), readOn = String(b.read_on ?? "");
  if (!/^-?\d{1,12}(\.\d{1,6})?$/.test(value) || !/^\d{4}-\d{2}-\d{2}$/.test(readOn) || (b.note !== undefined && (typeof b.note !== "string" || b.note.length > 500))) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "value (a number), read_on (YYYY-MM-DD) and an optional note are required." });
  }
  const { error } = await admin().rpc("rpc_kpi_reading_add", { p_actor: a.userId, p_action: id, p_value: value, p_read_on: readOn, p_note: (b.note as string | undefined) ?? "" });
  if (error) return fromDbError(error.message);
  return json({ action_id: id, value, read_on: readOn }, 201);
}
