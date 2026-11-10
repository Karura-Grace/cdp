import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// GET  the client's latest order of priorities (null until they set one). Read through RLS: only once a report on the plan is released.
// PUT { version, ranking: [priority_id, ...] }  Client Admin or Executive sets the order (rules 2.2). The database checks every priority is ranked once and that a
//     priority held by an open gate does not rank above one that is not held. Each save is a new row; the engine's own sequence never changes.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const { data } = await a.db.from("plan_client_order").select("score_version, ranking, set_at").eq("assessment_id", id).order("set_at", { ascending: false }).limit(1).maybeSingle();
  return json({ order: data ?? null });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 16 * 1024);
  if (b instanceof Response) return b;
  const version = Number(b.version), ranking = b.ranking;
  if (!Number.isInteger(version) || !Array.isArray(ranking) || !ranking.length || ranking.some((x) => typeof x !== "string" || x.length > 40)) {
    return problem({ code: "VALIDATION_FAILED", status: 422, title: "Send version and ranking (a list of priority ids)." });
  }
  const { error } = await admin().rpc("rpc_plan_order_set", { p_actor: a.userId, p_assessment: id, p_version: version, p_ranking: ranking as string[] });
  if (error) return fromDbError(error.message);
  return json({ score_version: version, ranking });
}
