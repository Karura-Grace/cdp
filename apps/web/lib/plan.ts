import * as E from "@pac/cdp-engine";
import type { Actor } from "./staff";
import { admin } from "./supabase/admin";
import { problem } from "./problem";

type Action = Record<string, unknown> & { action_id: string; assessment_id: string; score_version: number; priority_id: string; status: string };

/** The action as the caller may see it (RLS), with the caller's role on its engagement. Null when hidden. */
export async function actionFor(a: Actor, id: string) {
  const { data: act } = await a.db.from("action").select("*").eq("action_id", id).maybeSingle();
  if (!act) return null;
  // seeing the action (RLS) is the entitlement; Executives and People Leaders cannot read the assessment row, so its
  // engagement is looked up with the service role, and the role is still the caller's own (rpc_actor_role, their token)
  const { data: asm } = await admin().from("assessment").select("engagement_id").eq("assessment_id", act.assessment_id).maybeSingle();
  const { data: role } = asm ? await a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id }) : { data: null };
  return role ? { act: act as unknown as Action, role: role as string } : null;
}

/** Blocking findings of the action's priority that no completed P0 item covers (spec §5.5.9). */
export async function openGates(a: Actor, act: Action) {
  const [{ data: pri }, { data: p0 }] = await Promise.all([
    a.db.from("priority").select("blocked_by").eq("assessment_id", act.assessment_id).eq("score_version", act.score_version).eq("priority_id", act.priority_id).maybeSingle(),
    a.db.from("priority_zero_item").select("finding_ids, completed_at").eq("assessment_id", act.assessment_id).eq("score_version", act.score_version),
  ]);
  const done = new Set((p0 ?? []).filter((z) => z.completed_at).flatMap((z) => z.finding_ids));
  return (pri?.blocked_by ?? []).filter((f) => !done.has(f));
}

/** Engine WorkflowError -> problem+json (Appendix J codes). Anything else is rethrown. */
export function workflowProblem(e: unknown): Response {
  if (e instanceof E.WorkflowError) return problem({ code: e.code, status: e.status, title: e.detail, ...e.extra });
  throw e;
}

/** The rules version pinned on the assessment ("2.0", "2.1", "2.2"). From 2.2 the client owns the plan (engine TRANSITIONS_2_2). */
export async function rulesOf(assessmentId: string) {
  const { data } = await admin().from("assessment").select("rules_version(semver)").eq("assessment_id", assessmentId).maybeSingle();
  return ((data?.rules_version as { semver?: string } | null)?.semver ?? null);
}

/** The moves the engine allows this role from this status, under the plan's rules version. */
export const movesFor = (status: string, role: string, rules?: string | null) =>
  [...E.transitionsFor(rules)].filter(([k, roles]) => k.startsWith(status + ">") && roles.has(role)).map(([k]) => k.split(">")[1]);

/** Client roles that act on the plan from rules 2.2 (a People Leader only on the actions of their own unit, which the database checks). */
export const CLIENT_PLAN_ROLES = ["CLIENT_ADMIN", "EXECUTIVE", "PEOPLE_LEADER"];

export const ADJUST = ["ADJUST_INTERVENTION", "ADJUST_RESOURCING"] as const;

/**
 * What the engine is given at an adjust or retire review, and what it recommends. Derived from stored data where the platform
 * has it (KPI readings, owner, open pre-conditions, earlier reviews); the two judgements it cannot know (milestones on track,
 * the finding still supported) come from the consultant. The decision itself is always the engine's (adjustOrRetire).
 */
export async function reviewRecommendation(a: Actor, act: Action, asked: { milestones_on_track: boolean; finding_supported: boolean }) {
  const db = admin();
  const [{ data: rs }, { data: prior }, gates] = await Promise.all([
    db.from("kpi_reading").select("value, read_on").eq("action_id", act.action_id).order("read_on").order("created_at"),
    db.from("action_review").select("final_decision").eq("action_id", act.action_id),
    openGates(a, act),
  ]);
  const base = act.baseline_value as string | null, target = act.target_value as string | null;
  const latest = rs?.length ? rs[rs.length - 1].value : null;
  const progress = latest !== null && base !== null && target !== null ? E.kpiProgress(base, target, latest) : null;
  const direction = E.kpiDirection(progress);
  const adjustments = (prior ?? []).filter((p) => (ADJUST as readonly string[]).includes(p.final_decision)).length;
  const inputs = {
    kpi_direction: direction, progress: progress === null ? null : E.q(progress, 4).toString(), readings: rs?.length ?? 0,
    milestones_on_track: asked.milestones_on_track, precondition_open: gates.length > 0, finding_supported: asked.finding_supported,
    owner_present: !!act.owner, adjustments_without_movement: adjustments,
  };
  const decision = E.adjustOrRetire(direction, asked.milestones_on_track, { preconditionOpen: inputs.precondition_open, findingSupported: inputs.finding_supported,
    ownerPresent: inputs.owner_present, consecutiveAdjustmentsWithoutMovement: adjustments });
  return { decision, inputs };
}

/** After a review, where the action goes next: retire it, send it back to work, or hold it under review. */
export function reviewMove(final: string): "RETIRED" | "IN_PROGRESS" | null {
  if (final.startsWith("RETIRE_")) return "RETIRED";
  if (final === "CONTINUE" || (ADJUST as readonly string[]).includes(final)) return "IN_PROGRESS";
  return null;
}
