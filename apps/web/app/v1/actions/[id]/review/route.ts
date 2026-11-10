import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { actor, readJson } from "@/lib/staff";
import { actionFor, reviewMove, reviewRecommendation, workflowProblem } from "@/lib/plan";
import { fromDbError, json, problem, type Problem } from "@/lib/problem";

export const runtime = "nodejs";

const POINTS = ["+90d", "+180d"];
const DECISIONS = ["CONTINUE", "ADJUST_INTERVENTION", "ADJUST_RESOURCING", "SUSPEND_AND_REDIAGNOSE", "RETIRE_AND_REINSTATE_PRECONDITION", "RETIRE_SUPERSEDED", "REASSIGN_WITHIN_14_DAYS", "RETIRE_NOT_ACHIEVED"];
const ASK: Problem = { code: "VALIDATION_FAILED", status: 422, title: "milestones_on_track and finding_supported (true or false) are required." };

// GET ?milestones_on_track=1&finding_supported=1: the engine's recommendation and the inputs it used, for the PAC consultant to read before deciding.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const found = await actionFor(a, id);
  if (!found || found.role !== "PAC_CONSULTANT") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const q = new URL(req.url).searchParams;
  const bool = (k: string) => (q.get(k) === "1" ? true : q.get(k) === "0" ? false : null);
  const m = bool("milestones_on_track"), f = bool("finding_supported");
  if (m === null || f === null) return problem(ASK);
  return json(await reviewRecommendation(a, found.act, { milestones_on_track: m, finding_supported: f }));
}

// POST { review_point, milestones_on_track, finding_supported, decision?, reason? }. PAC consultant only, and only while the action is UNDER_REVIEW
// (the engine's own review state). The engine recommends; the consultant may choose a different decision with a reason. Then the action moves with the
// engine's transition: RETIRE_* to RETIRED, CONTINUE and ADJUST_* back to IN_PROGRESS; the others stay under review.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });
  const b = await readJson(req, 4096);
  if (b instanceof Response) return b;
  const found = await actionFor(a, id);
  if (!found || found.role !== "PAC_CONSULTANT") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  const { act } = found;
  if (!POINTS.includes(b.review_point as string)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "review_point must be +90d or +180d." });
  if (typeof b.milestones_on_track !== "boolean" || typeof b.finding_supported !== "boolean") return problem(ASK);
  if (b.decision !== undefined && !DECISIONS.includes(b.decision as string)) return problem({ code: "VALIDATION_FAILED", status: 422, title: "That decision is not one the engine knows." });
  const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 1000) : "";
  if (act.status !== "UNDER_REVIEW") return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "A review is recorded while the action is under review. The client moves it there first." });

  const rec = await reviewRecommendation(a, act, { milestones_on_track: b.milestones_on_track, finding_supported: b.finding_supported });
  const final = (b.decision as string | undefined) ?? rec.decision;
  if (final !== rec.decision && reason.length < 3) return problem({ code: "VALIDATION_FAILED", status: 422, title: "A reason is needed to choose a different decision from the engine's." });

  // check the move before anything is stored, so a refusal leaves no review behind
  const to = reviewMove(final);
  if (to) { try { E.transition(act as never, to as E.ActionStatus, "PAC_CONSULTANT", { reason: reason || `Review ${b.review_point}: ${final}` }); } catch (e) { return workflowProblem(e); } }

  const db = admin();
  const { data, error } = await db.rpc("rpc_action_review_record", { p_actor: a.userId, p_action: id, p_point: b.review_point as string, p_engine: rec.decision, p_final: final,
    p_reason: reason, p_inputs: rec.inputs as never });
  if (error) return fromDbError(error.message);
  if (to) {
    const t = await db.rpc("rpc_action_transition", { p_actor: a.userId, p_action: id, p_from: act.status, p_to: to, p_reason: reason || `Review ${b.review_point}: ${final}` });
    if (t.error) return fromDbError(t.error.message);
  }
  return json({ review_id: data, engine_decision: rec.decision, final_decision: final, status: to ?? act.status }, 201);
}
