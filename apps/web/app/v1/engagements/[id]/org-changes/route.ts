import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";
const TYPES = ["RESTRUCTURE", "MERGER", "NEW_CEO", "MODEL_TRANSITION_LIVE", "OTHER"];

// POST { type, effective_date, description }: a material change in the organisation (spec 6.2). The Client Admin or the assigned
// PAC Consultant records it; the database decides who may. It can open a re-assessment trigger for the consultant to review.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 4096);
  if (b instanceof Response) return b;
  const desc = typeof b.description === "string" ? b.description.trim() : "";
  if (!TYPES.includes(String(b.type)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.effective_date)) || !desc || desc.length > 500) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "type, effective_date (YYYY-MM-DD) and a description of up to 500 characters are required." });
  }
  const { data, error } = await admin().rpc("rpc_org_change_add", { p_actor: a.userId, p_engagement: id, p_type: String(b.type), p_effective: String(b.effective_date), p_description: desc });
  if (error) return fromDbError(error.message);
  return json({ org_change_id: data }, 201);
}
