import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

const SSK = ["START", "STOP", "KEEP"];

// PATCH { start_stop_keep?, behaviour?, visible_change_30d? } on one development item. The database allows it only to the
// assigned consultant and only before the plan is agreed.
export async function PATCH(req: Request, { params }: { params: Promise<{ item: string }> }) {
  const { item } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 4096);
  if (b instanceof Response) return b;
  const keys = Object.keys(b);
  const text = (v: unknown) => v === null || (typeof v === "string" && (v.trim() === "" || (v.trim().length >= 3 && v.length <= 500)));
  if (!keys.length || keys.some((k) => !["start_stop_keep", "behaviour", "visible_change_30d"].includes(k))
      || ("start_stop_keep" in b && b.start_stop_keep !== null && !SSK.includes(String(b.start_stop_keep)))
      || ("behaviour" in b && !text(b.behaviour)) || ("visible_change_30d" in b && !text(b.visible_change_30d))) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "Send start_stop_keep (START, STOP or KEEP), behaviour or visible_change_30d (3 to 500 characters)." });
  }
  const { error } = await admin().rpc("rpc_development_update", { p_actor: a.userId, p_item: item, p_fields: b as never });
  if (error) return fromDbError(error.message);
  return json({ item_id: item, updated: keys });
}
