import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";

/**
 * What the next cycle would start with (spec Table 104), shaped by the engine (rolloverPlan), and whether it may be created now.
 * The gate is the engine's own guard for leaving implementation: an accepted trigger, or twelve months since the baseline window closed.
 */
export async function rolloverPreview(engagementId: string) {
  const db = admin();
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, cycle_no, state").eq("engagement_id", engagementId).maybeSingle();
  if (!eng) return null;
  const [{ data: next }, { data: roll }, { data: asm }, { data: sections }, { data: trig }] = await Promise.all([
    db.from("engagement").select("engagement_id, cycle_no").eq("previous_engagement_id", engagementId).maybeSingle(),
    db.from("rollover").select("rollover_id, setup_sections, actions_carried, created_at").eq("previous_engagement_id", engagementId).maybeSingle(),
    db.from("assessment").select("assessment_id, window_close").eq("engagement_id", engagementId).eq("status", "FROZEN").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("setup_record").select("section, payload_json").eq("engagement_id", engagementId).eq("perspective", "AGREED").eq("status", "AGREED").order("section"),
    db.from("reassessment_trigger").select("decision").eq("engagement_id", engagementId).eq("decision", "ACCEPTED"),
  ]);
  const plan = asm ? (await db.from("plan").select("payload_json").eq("assessment_id", asm.assessment_id).order("score_version", { ascending: false }).limit(1).maybeSingle()).data : null;
  const acts = asm && plan ? (await db.from("action").select("action_id, status, objective, horizon").eq("assessment_id", asm.assessment_id)).data ?? [] : [];

  const setupSections = Object.fromEntries((sections ?? []).map((s) => [s.section, s.payload_json]));
  const g = (setupSections.G ?? {}) as { keep_protect?: unknown[] };
  const planned = (plan?.payload_json ?? {}) as { backlog?: unknown[] };
  const shaped = E.rolloverPlan({ setupSections, openActions: acts, backlog: planned.backlog ?? [], g5: (g.keep_protect ?? []).map((t) => ({ source: "WORKSHOP", entry: t })) });

  const today = new Date().toISOString().slice(0, 10);
  const annual = asm?.window_close ? E.otherTriggers({ baselineClosedOn: asm.window_close.slice(0, 10), today }).some((t) => t.type === "ANNUAL") : false;
  const guard = E.checkEngagementTransition("IMPLEMENTATION", "RE_ASSESSMENT", "PAC_CONSULTANT", { twelveMonthsElapsed: annual, triggerAccepted: (trig ?? []).length > 0 });
  const blocker = !asm || !plan ? "The baseline must be scored, frozen and have an action plan first." : next || roll ? "The next cycle has already been created." : guard ? guard.title : null;
  return {
    engagement: eng, next, rollover: roll, blocker, canCreate: !blocker,
    carries: {
      setup_sections: Object.keys(shaped.setup).sort(),
      actions: shaped.actions as { action_id: string; status: string; objective: string; horizon: string }[],
      backlog: shaped.backlog as { orientation: string; reason: string }[],
      g5_workshop_entries: shaped.g5.length,
    },
    reason: annual ? "Twelve months have passed since the baseline closed." : (trig ?? []).length ? "A re-assessment trigger was accepted." : null,
  };
}
