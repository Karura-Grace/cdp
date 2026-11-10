import { admin } from "@/lib/supabase/admin";
import { checkGraphInput, invitedForEngagement, loadGraph, loadOverrides, validate } from "@/lib/org-graph";
import { graphEditor, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// S1-04 Leader mapping: replace the leader assignments only. Checked against the stored people and teams, so a row that
// names someone who is not there, a unit that is not a team, or two leaders on one team at the same time is refused (422).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await graphEditor(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 1024 * 1024);
  if (b instanceof Response) return b;
  if (!Array.isArray(b.leaders)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "leaders must be a list." });

  const { graph: stored } = await loadGraph(g.a.db, g.eng.tenant_id);
  const c = checkGraphInput({ ...stored, leaders: b.leaders });
  if (!c.graph) return problem({ code: "VALIDATION_FAILED", status: 422, title: c.errors[0], errors: c.errors.slice(0, 50) });

  const { data, error } = await admin().rpc("rpc_leaders_replace", { p_actor: g.a.userId, p_engagement: id, p_leaders: c.graph.leaders as never });
  if (error) return fromDbError(error.message);
  const { data: asm } = await admin().from("assessment").select("window_open").eq("engagement_id", id).neq("status", "SUPERSEDED").maybeSingle();
  const ws = asm?.window_open?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  const defects = validate(c.graph, ws, await loadOverrides(admin(), id), await invitedForEngagement(id));
  return json({ ...(data as object), window_start: ws, defects });
}
