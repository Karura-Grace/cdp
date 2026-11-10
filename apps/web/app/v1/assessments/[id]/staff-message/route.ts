import { admin } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { consultantOnAssessment, readJson } from "@/lib/staff";
import { messageGaps } from "@/lib/section-i.mjs";
import { fromDbError, json, problem } from "@/lib/problem";

export const runtime = "nodejs";

// PUT { text }: staff message wording changed after launch (owner decision, 18 October 2026; spec lock rule: text only edits are allowed and audited).
// The new text is stored on the assessment (staff_message_text), never in the locked Section I record, so cohorts, anonymity and every field
// scoring reads stay as launched. Respondents see it ahead of the Section I text. The consultant only, while the survey is open.
// The keyword scan comes back as warnings (purpose, use of results, anonymity, next steps); it never blocks. The audit entry records the sizes of
// the old and new text, not the text itself.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const { a, asm } = g;
  if (asm.status !== "LAUNCHED" || asm.frozen_at) return problem({ code: "ILLEGAL_TRANSITION", status: 409, title: "The wording can be changed after launch while the survey is open. Before launch, edit Section I." });
  const b = await readJson(req, 8 * 1024);
  if (b instanceof Response) return b;
  const text = typeof b.text === "string" ? b.text.trim().replace(/\r\n/g, "\n") : "";
  if (!text || text.length > 3000) return problem({ code: "VALIDATION_FAILED", status: 422, title: "The staff message is 1 to 3000 characters." });
  const { data: rec } = await admin().from("setup_record").select("payload_json").eq("engagement_id", asm.engagement_id).eq("section", "I").eq("perspective", "AGREED").maybeSingle();
  const was = asm.staff_message_text ?? (rec?.payload_json as { staff_message?: string } | null)?.staff_message ?? "";
  const up = await admin().from("assessment").update({ staff_message_text: text, updated_by: a.userId }).eq("assessment_id", id);
  if (up.error) return fromDbError(up.error.message);
  await audit(asm.tenant_id, a.userId, `assessment.staff_message_edited:${was.length}>${text.length}`, "assessment", id);
  return json({ assessment_id: id, staff_message_text: text, warnings: messageGaps(text).map((x) => `The message does not seem to state ${x.text}.`) });
}
