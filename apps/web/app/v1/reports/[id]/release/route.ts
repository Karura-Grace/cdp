import { checkRelease } from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { appendixParts, missingParts } from "@/lib/release-gate";
import { actor } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Release is a PAC Consultant act. The engine decides whether the report is complete (checkRelease); the
// database then re-checks the score is frozen, the hash matches, and the releaser is an active assignee.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await actor(req);
  if (!a) return problem({ code: "UNAUTHENTICATED", status: 401, title: "Sign in to continue." });

  const { data: rep } = await a.db.from("report").select("*").eq("report_id", id).maybeSingle();
  const { data: asm } = rep ? await a.db.from("assessment").select("engagement_id").eq("assessment_id", rep.assessment_id).maybeSingle() : { data: null };
  const { data: role } = asm ? await a.db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id }) : { data: null };
  if (!rep || role !== "PAC_CONSULTANT") return problem({ code: "FORBIDDEN", status: 403, title: "Your role or scope does not permit this." });
  if (rep.status === "RELEASED") return json({ report_id: id, status: "RELEASED", released_at: rep.released_at, changed: false });

  const db = admin();
  const { data: sc } = await db.from("score_object").select("payload_hash, payload_json, frozen_at").eq("assessment_id", rep.assessment_id).eq("version", rep.score_version).single();
  const gaps = missingParts(await appendixParts(rep.assessment_id, rep.score_version, !!sc?.frozen_at, (sc?.payload_json as { readiness?: { alpha?: Record<"D7" | "D8" | "D9", string | null> } } | undefined)?.readiness?.alpha));
  const bad = checkRelease({
    sections: rep.sections_json as Record<string, string>, accepted: rep.accepted_json as Record<string, unknown>,
    aiSections: Object.keys(rep.sections_json as Record<string, string>).filter((k) => k.startsWith("ai_")),   // AI chapter drafts must be accepted (Q-AL26)
    scorePayloadHash: sc?.payload_hash ?? null, reportPayloadHash: rep.payload_hash,
    technicalAppendixPresent: gaps.length === 0,   // every appendix part must be present (S8); the reasons below name what is missing
  });
  if (bad) {
    const named = (r: unknown) => (r === "technical appendix missing" ? `technical appendix missing: ${gaps.join(", ")}` : r);
    return problem({ ...bad, reasons: ((bad as unknown as { reasons?: unknown[] }).reasons ?? []).map(named) } as typeof bad);
  }

  // the consultant keeps, drops or rewords every proposed piece of advice before the client sees it (owner Q-AL8)
  const { count: undecided } = await db.from("report_advice").select("item_id", { count: "exact", head: true }).eq("report_id", id).eq("decision", "PROPOSED");
  if (undecided) return problem({ code: "ADVICE_UNREVIEWED", status: 409, title: `${undecided} proposed advice item${undecided === 1 ? " is" : "s are"} still to keep or drop.` });

  const now = new Date().toISOString();
  const up = await db.from("report").update({ status: "RELEASED", released_by: a.userId, released_at: now }).eq("report_id", id);
  if (up.error) return fromDbError(up.error.message);
  // Rules 2.2: the system puts every drafted action in front of the client (a no-op on 2.0 and 2.1 plans, and when there is no plan yet).
  const proposed = await db.rpc("rpc_plan_propose", { p_assessment: rep.assessment_id, p_version: rep.score_version });
  if (proposed.error) return fromDbError(proposed.error.message);
  return json({ report_id: id, status: "RELEASED", released_at: now, changed: true, actions_proposed: proposed.data ?? 0 });
}
