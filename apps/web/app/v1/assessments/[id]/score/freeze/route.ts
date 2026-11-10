import { checkEngagementTransition } from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { storeSegmentProfiles } from "@/lib/segments";
import { consultantOnAssessment } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// Freeze the latest score version and move the engagement SCORING -> REPORTING. The freeze cannot be undone
// (score_object_guard); a later change to the inputs creates a new version, never an edit.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const db = admin();

  const { data: sc } = await db.from("score_object").select("version, payload_hash, frozen_at").eq("assessment_id", id)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (!sc) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Score the assessment first." });
  if (sc.frozen_at) return json({ version: sc.version, payload_hash: sc.payload_hash, frozen_at: sc.frozen_at, changed: false });

  const { data: eng } = await db.from("engagement").select("state").eq("engagement_id", g.asm.engagement_id).single();
  const bad = checkEngagementTransition(eng!.state, "REPORTING", "PAC_CONSULTANT", { scoreFrozen: true });
  if (eng!.state !== "SCORING" || bad) return problem(bad ?? { code: "ILLEGAL_TRANSITION", status: 409, title: `Engagement is ${eng!.state}, not SCORING.` });

  try { await storeSegmentProfiles(id, g.asm.engagement_id, g.asm.tenant_id, sc.version, sc.payload_hash, g.a.userId); }
  catch (e) { return fromDbError(String((e as Error).message)); }

  const now = new Date().toISOString();
  const up = await db.from("score_object").update({ frozen_at: now, frozen_by: g.a.userId }).eq("assessment_id", id).eq("version", sc.version);
  if (up.error) return fromDbError(up.error.message);
  const st = await db.from("engagement").update({ state: "REPORTING" }).eq("engagement_id", g.asm.engagement_id);
  if (st.error) return fromDbError(st.error.message);
  return json({ version: sc.version, payload_hash: sc.payload_hash, frozen_at: now, changed: true });
}
