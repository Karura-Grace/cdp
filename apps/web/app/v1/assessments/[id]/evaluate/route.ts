import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { computeScore } from "@/lib/scoring";
import { runEvaluation } from "@/lib/finding-extras";
import { consultantOnAssessment } from "@/lib/staff";
import { fromDbError, json, problem } from "@/lib/problem";
import { ORIENT_NAME } from "@/lib/format";
import { GAP_CLASS } from "@/lib/report-library";

export const runtime = "nodejs";

// G5 (spec Table 16): system entries written from the KEEP AND PROTECT classification of the frozen score, labelled by source. Setup is locked by
// now, so they sit on the engagement. Read from the stored payload, so repeating the call writes the same entries.
async function writeG5(engagementId: string, tenantId: string, assessmentId: string, version: number) {
  const { data } = await admin().from("score_object").select("payload_json").eq("assessment_id", assessmentId).eq("version", version).single();
  const cls = ((data?.payload_json as { classification?: Record<string, string> } | undefined)?.classification ?? {});
  const g5 = E.ORIENTATIONS.filter((o) => cls[o] === "KEEP_AND_PROTECT").map((o) => ({ source: "SYSTEM", orientation: o, score_version: version, entry: `${ORIENT_NAME[o]}: ${GAP_CLASS.KEEP_AND_PROTECT}` }));
  await admin().from("engagement").update({ g5_system: g5 as never }).eq("engagement_id", engagementId);
  // the read only note under Setup G5, with the score version it came from (insert only; the same version writes the same rows)
  if (g5.length) await admin().from("setup_system_note").upsert(g5.map((x) => ({ tenant_id: tenantId, engagement_id: engagementId, assessment_id: assessmentId, score_version: version, section: "G", item: x.orientation, body: x.entry })),
    { onConflict: "assessment_id,score_version,section,item", ignoreDuplicates: true });
  return g5.length;
}

// Run the rules engine on the frozen score and store the evaluation next to it. Idempotent per version.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const db = admin();

  const { data: sc } = await db.from("score_object").select("version, payload_hash, frozen_at").eq("assessment_id", id)
    .not("frozen_at", "is", null).order("version", { ascending: false }).limit(1).maybeSingle();
  if (!sc) return problem({ code: "VALIDATION_FAILED", status: 422, title: "Freeze a score version first." });

  const done = await db.from("evaluation").select("payload_hash").eq("assessment_id", id).eq("score_version", sc.version).maybeSingle();
  if (done.data) return json({ score_version: sc.version, payload_hash: done.data.payload_hash, created: false, g5_system: await writeG5(g.asm.engagement_id, g.asm.tenant_id, id, sc.version) });

  // The engine needs the score object with its Decimals, not the stored JSON. Recompute from the same frozen
  // set and refuse to continue unless it reproduces the stored hash.
  const s = await computeScore(id, g.asm.engagement_id, [sc.payload_hash]);
  if (s.hash !== sc.payload_hash) return problem({ code: "INTERNAL", status: 500, title: "The frozen score could not be reproduced." });

  // Segment signals are appended after the organisation findings (ids never move); per leader findings are not stored (see runEvaluation).
  const ev = E.toJsonable(await runEvaluation(id, g.asm.tenant_id, sc.version, s));
  const ins = await db.from("evaluation").insert({
    tenant_id: g.asm.tenant_id, assessment_id: id, score_version: sc.version, payload_json: ev as never, payload_hash: E.payloadHash(ev), created_by: g.a.userId,
  }).select("payload_hash").single();
  if (ins.error) return fromDbError(ins.error.message);
  return json({ score_version: sc.version, payload_hash: ins.data.payload_hash, created: true, g5_system: await writeG5(g.asm.engagement_id, g.asm.tenant_id, id, sc.version) }, 201);
}
