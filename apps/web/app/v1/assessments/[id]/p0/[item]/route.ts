import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST { score_version, note }: record a pre-condition (P0) item as done. Assigned consultant or the tenant's Executive;
// the database checks the role and that the item is still open.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; item: string }> }) {
  const { id, item } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 4096);
  if (b instanceof Response) return b;
  if (!Number.isInteger(b.score_version) || typeof b.note !== "string" || b.note.trim().length < 3 || b.note.length > 1000 || !/^p0_\d{2}$/.test(item)) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "score_version and a note (3 to 1000 characters) are required." });
  }
  const { error } = await admin().rpc("rpc_p0_complete", { p_actor: a.userId, p_assessment: id, p_version: b.score_version as number, p_item: item, p_note: b.note });
  if (error) return fromDbError(error.message);
  return json({ item_id: item, completed: true });
}
