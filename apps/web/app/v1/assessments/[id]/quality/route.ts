import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { scoringClient } from "@/lib/supabase/scoring";
import { consultantOnAssessment } from "@/lib/staff";
import { fromDbError, json } from "@/lib/problem";

export const runtime = "nodejs";

// Quality monitor while the survey is open (S2-16, S2.5-003): the engine's quality flags over the open set, under the assessment's rules
// version. Counts, the median completion time, and the opaque ids of flagged responses with their flags and time, as information for the consultant. Nobody can void or
// change a response (owner ruling 22 Oct 2026). Never an answer, never a demographic. PAC Consultant only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { data, error } = await scoringClient().rpc("rpc_monitor_set", { p_assessment_id: id });
  if (error) return fromDbError(error.message);
  const { data: rul } = await admin().from("assessment").select("rules_version(semver)").eq("assessment_id", id).single();
  const rules = ((rul?.rules_version as { semver?: string } | null)?.semver ?? E.RULES_VERSION) as E.RulesVersion;
  const { scored, median } = E.withRules(rules, () => E.classifyAll(data as unknown as E.ResponseInput[]));
  const states: Record<string, number> = {}, flags: Record<string, number> = {};
  for (const r of scored) { states[r._state] = (states[r._state] ?? 0) + 1; for (const f of r._flags) flags[f] = (flags[f] ?? 0) + 1; }
  const { data: voided } = await admin().from("exclusion_log").select("response_id, reason, created_at").eq("assessment_id", id).order("created_at");
  return json({
    submitted: scored.length, median_seconds: Number(median), states, flags,
    flagged: scored.filter((r) => r._flags.length).map((r) => ({ response_id: r.id, flags: r._flags, excluded: r._state === "INSUFFICIENT", duration_seconds: r.duration ?? null })),
    voided: voided ?? [],
  });
}
