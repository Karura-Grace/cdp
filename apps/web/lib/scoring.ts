import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import { scoringClient } from "./supabase/scoring";
import { kpiForInput } from "./setup-sections";
import { scorecardSource } from "./scorecard";

// Agreed setup sections -> engine inputs. Only AGREED rows feed the engine (CLAUDE.md §5).
export async function loadSetup(engagementId: string) {
  const { data, error } = await admin().from("setup_record").select("section, payload_json")
    .eq("engagement_id", engagementId).eq("perspective", "AGREED").eq("status", "AGREED");
  if (error) throw new Error(error.message);
  const p = Object.fromEntries((data ?? []).map((r) => [r.section, r.payload_json as Record<string, unknown>])) as Record<string, Record<string, unknown> | undefined>;
  // KPIs come from the scorecard when one is stored, else from Sections C and D; an older record that kept them in G (the seeded fixture) still works.
  const input = { ...p.B, ...p.F, kpi_for: (await scorecardSource(engagementId)).kpiFor ?? kpiForInput(p.C, p.D, p.G) } as E.SetupInput;
  // Leaders in scope: the snapshot taken at launch (from the org graph). Engagements seeded before the graph existed kept
  // them in Section H.
  const { data: snap } = await admin().from("org_graph_snapshot").select("scope_json").eq("engagement_id", engagementId).maybeSingle();
  const scope = (snap ? snap.scope_json : (p.H?.leaders_in_scope ?? [])) as { headcount_led: number }[];
  return { input, scope };
}

/** Deterministic: the same frozen set and agreed setup always give the same hash. Throws a coded Error.
 *  stored: hashes already stored for this assessment. A score frozen under an older payload version (see scoreAssessment)
 *  is reproduced in that version, so its hash still matches; anything new is scored in the current version. */
export async function computeScore(assessmentId: string, engagementId: string, stored: string[] = []) {
  const { input, scope } = await loadSetup(engagementId);
  let setup: E.EngineSetup;
  try { setup = E.deriveSetup(input); } catch (e) { throw Object.assign(e as Error, { code: "SETUP_TIE_UNRESOLVED" }); }
  // the rules version pinned on the assessment at creation (2.1 from 19 Oct 2026); engine calls below run under it
  const { data: asm } = await admin().from("assessment").select("rules_version(semver)").eq("assessment_id", assessmentId).single();
  const rules = ((asm?.rules_version as { semver?: string } | null)?.semver ?? E.RULES_VERSION) as E.RulesVersion;
  const { data, error } = await scoringClient().rpc("rpc_frozen_response_set", { p_assessment_id: assessmentId });
  if (error) throw error;
  const set360 = await loadFrozen360(assessmentId);
  return E.withRules(rules, () => {
    const leaders = scoreLeaders(set360, scope as { assignment_id?: string; headcount_led: number }[], setup);
    let out = E.scoreAssessment(data as unknown as E.ResponseInput[], setup, leaders, scope);
    // older payload versions (2: analytics block only, 1: original), newest first, until one matches a stored hash
    for (const version of [2, 1] as const) {
      if (!stored.length || stored.includes(out.hash)) break;
      const old = E.scoreAssessment(data as unknown as E.ResponseInput[], setup, leaders, scope, { version });
      if (stored.includes(old.hash)) out = old;
    }
    return { setup, ...out, leaders, responses: (data as unknown[]).length };
  });
}

type Frozen360 = { assignment_id: string; self: (number | null)[] | null; raters: { group: E.RaterGroup; ratings: (number | null)[] }[] }[];
async function loadFrozen360(assessmentId: string) {
  const { data, error } = await scoringClient().rpc("rpc_frozen_360_set", { p_assessment_id: assessmentId });
  if (error) throw error;
  return (data ?? []) as Frozen360;
}

/** Leadership 360 results from the frozen 360 set, scored by the engine against the leadership target. Leaders without any
 *  360 form are not listed; an engagement without 360 gives [] and so the same score hash as before 360 existed. */
function scoreLeaders(set: Frozen360, scope: { assignment_id?: string; headcount_led: number }[], setup: E.EngineSetup) {
  if (!set.length) return [];
  const hc = new Map(scope.map((l) => [l.assignment_id, l.headcount_led]));
  const target = setup.leadership_target_orientation;
  if (!target) return [];
  return E.scoreLeaders(set.map((l) => ({ assignment_id: l.assignment_id, headcount_led: hc.get(l.assignment_id) ?? 0, self: l.self, raters: l.raters })), target);
}
