import * as E from "@pac/cdp-engine";
import { consultantOnEngagement } from "./staff";
import { admin } from "./supabase/admin";
import { scoringClient } from "./supabase/scoring";

export type Reading = ReturnType<typeof E.toJsonable>;
export interface PulseBaseline { reading: Reading; n: Record<string, number> }

/** The latest frozen baseline of an engagement with its newest plan: what a pulse is built on. */
export async function baselineOf(engagementId: string) {
  const db = admin();
  const { data: asm } = await db.from("assessment").select("assessment_id, tenant_id").eq("engagement_id", engagementId).eq("status", "FROZEN").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!asm) return null;
  const { data: plan } = await db.from("plan").select("score_version, payload_json").eq("assessment_id", asm.assessment_id).order("score_version", { ascending: false }).limit(1).maybeSingle();
  return plan ? { assessmentId: asm.assessment_id, scoreVersion: plan.score_version, plan: plan.payload_json as unknown as E.Plan } : null;
}

/** What a priority offers a pulse: the watch-list of its actions, in the order the plan lists them, without repeats. */
export function watchlistOf(plan: E.Plan, priorityId: string) {
  const p = plan.priorities.find((x) => x.priority_id === priorityId);
  if (!p) return null;
  return { orientation: p.orientation, items: [...new Set(p.actions.flatMap((a) => a.watchlist))].filter((r) => E.parsePulseRef(r)) };
}

/** The baseline reading on exactly the pulse's items, from the frozen response set. Only the group reading is kept, never a response. */
export async function baselineReading(assessmentId: string, items: string[], orientation: E.Orientation): Promise<PulseBaseline> {
  const { data, error } = await scoringClient().rpc("rpc_frozen_response_set", { p_assessment_id: assessmentId });
  if (error) throw error;
  const group = (data as unknown as E.ResponseInput[]).map((r) => E.pulseAnswersFromResponse(r, items));
  const { reading, n } = E.pulseReading(group, items, orientation);
  return { reading: E.toJsonable(reading), n };
}

/** The caller must be the assigned PAC consultant of the pulse's engagement. A pulse that does not exist answers the same 403. */
export async function consultantOnPulse(req: Request, pulseId: string) {
  const { data: p } = await admin().from("pulse").select("*").eq("pulse_id", pulseId).maybeSingle();
  const c = await consultantOnEngagement(req, p?.engagement_id ?? "none");
  return c instanceof Response ? c : { ...c, pulse: p! };
}

/** Plain words for a watch-list reference, for the builder and the results table. */
export function refLabel(ref: string) {
  const p = E.parsePulseRef(ref);
  if (!p) return ref;
  if (p.kind === "scenario") return `Culture scenario ${p.set} of ${p.dim}, as it is now`;
  if (p.kind === "dimension") return `${p.dim} short form, four statements`;
  return `Employee Orientation Survey, question ${p.q}`;
}

/** Baseline and pulse value of one reference from a stored reading, as shown to the reader. */
export function readingValue(reading: Record<string, Record<string, string | number>> | undefined, ref: string): string | null {
  const p = E.parsePulseRef(ref);
  if (!p || !reading) return null;
  const v = p.kind === "scenario" ? reading.scenario?.[ref] : p.kind === "dimension" ? reading.likert?.[p.dim] : reading.eos?.[`Q${p.q}`];
  if (v === undefined || v === null) return null;
  return p.kind === "eos" ? String(v) : E.q(E.D(v), 1).toString();
}

/** Signed change between two shown values, computed with the engine's decimals (never a float). */
export function changeOf(base: string, cur: string, ref: string) {
  const d = E.D(cur).minus(E.D(base)), s = E.q(d, E.parsePulseRef(ref)?.kind === "eos" ? 0 : 1).toString();
  return d.gt(0) ? `+${s}` : s;
}
