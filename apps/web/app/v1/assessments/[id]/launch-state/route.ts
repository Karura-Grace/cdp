import { staffContext } from "@/lib/staff-ctx";
import * as E from "@pac/cdp-engine";
import { admin } from "@/lib/supabase/admin";
import { consultantOnAssessment } from "@/lib/staff";
import { runPreflight } from "@/lib/preflight";
import { loadCalendar, templatesApproved } from "@/lib/launch-checks";
import { reminderPreview } from "@/lib/reminders";
import { messageGaps, qualitativeHints } from "@/lib/section-i.mjs";
import { LAUNCH_NEEDS_SEPARATE_APPROVAL, STAFF_TEMPLATE_VERSION, staffMessage, templateInUse, type Anonymity } from "@/lib/staff-message";
import { json } from "@/lib/problem";

export const runtime = "nodejs";

// Everything the launch panel on the setup page shows, in one read: version and reason, the launch approval, the DRAFT staff message
// templates and whether the owner approved them, the Section I hints, the reminders that will be scheduled, the L7 and L8 detail, and
// (once the survey is open) the completion time measurement. Consultant only. Read only.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await consultantOnAssessment(req, id);
  if (g instanceof Response) return g;
  const db = admin(), { asm } = g;
  const [{ data: eng }, { data: rec }, cal, approved, { data: sup }] = await Promise.all([
    db.from("engagement").select("purpose, setup_version, launch_approved_by, launch_approved_at").eq("engagement_id", asm.engagement_id).single(),
    db.from("setup_record").select("payload_json, workshop_date, participants, status").eq("engagement_id", asm.engagement_id).eq("section", "I").eq("perspective", "AGREED").maybeSingle(),
    loadCalendar(db, asm.tenant_id), templatesApproved(db),
    asm.supersedes_assessment_id ? db.from("assessment").select("assessment_id, status").eq("assessment_id", asm.supersedes_assessment_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const si = (rec?.payload_json ?? {}) as Record<string, unknown>;
  const ctx = await staffContext(db, asm.engagement_id, asm.tenant_id);
  const open = asm.window_open?.slice(0, 10) ?? "", close = asm.window_close?.slice(0, 10) ?? "";
  const pf = asm.status === "DRAFT" ? await runPreflight(id) : null;

  let completion: { complete: number; median_seconds: number | null; needs_update: boolean } | null = null;
  if (asm.status === "LAUNCHED") {
    const { data } = await db.rpc("rpc_completion_stats", { p_assessment: id, p_min: E.config.get("segments.floor") });
    const s = (data ?? { complete: 0, median_seconds: null }) as { complete: number; median_seconds: number | null };
    completion = { ...s, needs_update: s.median_seconds !== null && E.completionStatementNeedsUpdate(s.complete, s.median_seconds) };
  }
  return json({
    assessment: { assessment_id: id, status: asm.status, window_open: open, window_close: close, supersedes: sup?.assessment_id ?? null, version_reason: asm.version_reason, setup_version: eng?.setup_version ?? 1,
      completion_estimate_text: asm.completion_estimate_text ?? (si.completion_estimate as string | undefined) ?? null,
      staff_message_text: asm.staff_message_text ?? (si.staff_message as string | undefined) ?? null, staff_message_edited_after_launch: !!asm.staff_message_text },
    approval: { needed: LAUNCH_NEEDS_SEPARATE_APPROVAL, approved_by: eng?.launch_approved_by ?? null, approved_at: eng?.launch_approved_at ?? null },
    template: { version: STAFF_TEMPLATE_VERSION, approved, gaps: messageGaps(asm.staff_message_text ?? si.staff_message).map((x) => x.text), in_use: templateInUse(si.staff_message, ctx), anonymity: (si.anonymity as Anonymity | undefined) ?? null,
      drafts: { FULL: staffMessage("FULL", ctx), CONFIDENTIAL_AGGREGATE: staffMessage("CONFIDENTIAL_AGGREGATE", ctx) } },
    section_i: { hints: qualitativeHints(si), has_section: !!rec, payload: si, workshop_date: rec?.workshop_date ?? null, participants: rec?.participants ?? [], status: rec?.status ?? null },
    reminders: open && close ? reminderPreview(si, open, close, cal.holidays.map((h) => h.day)) : [],
    calendar: cal,
    extras: pf ? { l7: pf.l7, l8: pf.l8, cohorts: pf.cohorts } : null,
    completion,
  });
}
