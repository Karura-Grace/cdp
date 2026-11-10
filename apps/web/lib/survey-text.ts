import { admin } from "./supabase/admin";

/** The two Section I texts a respondent sees on the invitation screen and in the invitation email: the staff message (I5) and the completion
 *  time statement. The statement the Client Admin updated after launch, and the staff message wording the consultant edited after launch, win over the ones agreed in Section I. Nothing else from setup. */
export async function surveyTexts(assessmentId: string): Promise<{ message: string | null; estimate: string }> {
  const db = admin();
  const { data: a } = await db.from("assessment").select("engagement_id, completion_estimate_text, staff_message_text").eq("assessment_id", assessmentId).maybeSingle();
  if (!a) return { message: null, estimate: "35 to 45 minutes" };
  const { data: r } = await db.from("setup_record").select("payload_json").eq("engagement_id", a.engagement_id).eq("section", "I").eq("perspective", "AGREED").maybeSingle();
  const p = (r?.payload_json ?? {}) as { staff_message?: string; completion_estimate?: string };
  return { message: a.staff_message_text?.trim() || p.staff_message?.trim() || null, estimate: a.completion_estimate_text ?? p.completion_estimate ?? "35 to 45 minutes" };
}
