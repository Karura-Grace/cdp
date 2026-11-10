import { admin } from "@/lib/supabase/admin";
import { consultantOnEngagement } from "@/lib/staff";
import { cyclePair, computeDeltas } from "@/lib/trend";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// POST: compares this cycle with the previous one from the two frozen score objects and stores the result. 409 when the
// previous cycle is missing or not frozen yet, 409 VERSION_INCOMPARABLE when the instrument changed in a major way (spec 6.5.2).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await consultantOnEngagement(req, id);
  if (c instanceof Response) return c;
  const pair = await cyclePair(id);
  if (!pair?.baseline || !pair.current) return problem({ code: "DATA_NOT_FROZEN", status: 409, title: "Both this cycle and the previous one must be scored and frozen before they can be compared." });
  const r = await computeDeltas(pair.baseline, pair.current);
  if (r.refused) return problem({ code: "VERSION_INCOMPARABLE", status: 409, title: "The instrument changed in a major way between these cycles, so they cannot be compared." });
  const { data, error } = await admin().rpc("rpc_comparison_store", { p_actor: c.a.userId, p_baseline: pair.baseline.assessment_id, p_baseline_version: pair.baseline.version,
    p_current: pair.current.assessment_id, p_current_version: pair.current.version, p_relation: r.deltas.relation, p_deltas: r.deltas as never });
  if (error) return fromDbError(error.message);
  return json({ comparison_id: data, relation: r.deltas.relation }, 201);
}
