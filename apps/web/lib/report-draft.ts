import { admin } from "./supabase/admin";
import type { Evaluation, Score } from "./report-data";
import { FACILITATION_TEMPLATE, narrative, nextStepsDraft, quickWinsDraft } from "./report-story";

/** The report text, written by the system from the frozen score and the findings (owner ruling 22 Oct 2026, Erick Ngala comment 24: the consultant
 *  changes nothing in any report; their comments go to the client in the debrief). All four text sections are drafted and stamped as accepted by
 *  the system, so the release gate still sees accepted text. Chapter notes are not used any more. */
export async function draftReportText(assessmentId: string, scoreVersion: number, type: string) {
  const db = admin();
  const [{ data: sc }, { data: ev }] = await Promise.all([
    db.from("score_object").select("payload_json").eq("assessment_id", assessmentId).eq("version", scoreVersion).single(),
    db.from("evaluation").select("payload_json").eq("assessment_id", assessmentId).eq("score_version", scoreVersion).maybeSingle(),
  ]);
  const s = sc!.payload_json as unknown as Score, e = ev?.payload_json as unknown as Evaluation | undefined;
  const sections: Record<string, string> = {
    what_this_means: narrative(s, e, type === "BOARD_EXEC_SUMMARY" ? "BOARD" : "PEOPLE").join("\n\n"),
    what_to_do_next: nextStepsDraft(s, e),
    quick_wins: quickWinsDraft(s, e),
    facilitation: FACILITATION_TEMPLATE,
  };
  const now = new Date().toISOString();
  return { sections, accepted: Object.fromEntries(Object.keys(sections).map((k) => [k, now])) };
}
