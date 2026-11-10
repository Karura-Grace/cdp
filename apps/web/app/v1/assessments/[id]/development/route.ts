import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { loadSetup } from "@/lib/scoring";
import { consultantOnAssessment, readJson } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST {}                      draft development plans (engine draftDevelopmentPlan) for every leader with a valid 360 result
//                              on the latest score version; leaders who already have a plan are left alone.
// POST { agree: assignment_id } agree one leader's plan once every item is complete; it then no longer changes.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const b = await readJson(req, 1024);
  if (b instanceof Response) return b;
  const db = admin();
  const { data: latest } = await db.from("leader_result").select("score_version").eq("assessment_id", id).order("score_version", { ascending: false }).limit(1).maybeSingle();
  if (!latest) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Score the assessment with Leadership 360 results first." });
  const v = latest.score_version;

  if (b.agree !== undefined) {
    if (typeof b.agree !== "string") return problem({ code: "VALIDATION_FAILED", status: 422, title: "agree must be a leader assignment id." });
    const { data, error } = await db.rpc("rpc_development_agree", { p_actor: g.a.userId, p_assessment: id, p_version: v, p_assignment: b.agree });
    if (error) return fromDbError(error.message);
    return json(data);
  }

  const { input } = await loadSetup(g.asm.engagement_id);
  let target: E.Orientation;
  try { target = E.deriveSetup(input).leadership_target_orientation; } catch { return problem({ code: "VALIDATION_FAILED", status: 422, title: "Section F has a tie the consultant must resolve." }); }
  const { data: results } = await db.from("leader_result").select("assignment_id, payload_json").eq("assessment_id", id).eq("score_version", v);
  // coaching intensity: at least 8 sessions when the plan has a behaviour-gap priority (spec §5.5.8)
  const { data: gap } = await db.from("priority").select("priority_id").eq("assessment_id", id).eq("score_version", v).eq("urgency_tier", "BEHAVIOUR_GAP").limit(1);
  const tier = gap?.length ? "BEHAVIOUR_GAP" : undefined;
  const items = (results ?? []).flatMap((r) =>
    E.draftDevelopmentPlan(r.payload_json as unknown as E.LeaderResult, target, tier).map((d, i) => ({
      assignment_id: r.assignment_id, seq: i + 1, basis: d.basis, orientation: d.orientation, section: d.section, support: d.support })));
  if (!items.length) return json({ drafted: 0 });
  const { data, error } = await db.rpc("rpc_development_store", { p_actor: g.a.userId, p_assessment: id, p_version: v, p_items: items as never });
  if (error) return fromDbError(error.message);
  return json(data, 201);
}
