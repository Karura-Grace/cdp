import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";

// The engagement lifecycle after reporting (spec §0.6, Table 8). The engine's checkEngagementTransition decides what is allowed; this file only
// assembles its guards from stored facts and says what the PAC consultant's next step is. No rule lives here.
//   REPORTING to DEBRIEF            both the Organisational report and the Board / Executive Summary are released
//   DEBRIEF to PLANNING             the action plan (with its priority zero) exists and the debrief has been recorded
//   PLANNING to IMPLEMENTATION      an organisation level action is approved and published
//   IMPLEMENTATION to PULSE and back  a pulse is opened; its results are stored
//   IMPLEMENTATION to RE_ASSESSMENT twelve months since the baseline closed, or a re-assessment trigger was accepted
// The next cycle (RE_ASSESSMENT to a new SETUP) is created by the rollover, which is its own engagement.
export const DEBRIEF_ACTION = "debrief.logged";
const LIVE = ["PUBLISHED", "IN_PROGRESS", "UNDER_REVIEW", "CLOSED"];

export interface Facts {
  state: E.EngagementState; assessmentId: string | null; windowClose: string | null;
  orgReleased: boolean; boardReleased: boolean; hasPlan: boolean; debriefLogged: boolean; orgActionPublished: boolean; triggerAccepted: boolean;
  openPulses: number; unresolvedPulses: number;
}

/** Facts for several engagements in a few queries (ids only; the service role is used after the caller's role was checked). */
export async function loadFacts(engagementIds: string[]): Promise<Map<string, Facts>> {
  const out = new Map<string, Facts>();
  if (!engagementIds.length) return out;
  const db = admin();
  const [{ data: eng }, { data: asm }, { data: trg }, { data: aud }, { data: pls }, { data: pres }] = await Promise.all([
    db.from("engagement").select("engagement_id, state").in("engagement_id", engagementIds),
    db.from("assessment").select("assessment_id, engagement_id, window_close, frozen_at").in("engagement_id", engagementIds).order("created_at"),
    db.from("reassessment_trigger").select("engagement_id").eq("decision", "ACCEPTED").in("engagement_id", engagementIds),
    db.from("audit_log").select("object_id").eq("action", DEBRIEF_ACTION).in("object_id", engagementIds),
    db.from("pulse").select("pulse_id, engagement_id, status").in("engagement_id", engagementIds),
    db.from("pulse_result").select("pulse_id").in("engagement_id", engagementIds),
  ]);
  const asmIds = (asm ?? []).map((a) => a.assessment_id);
  const [{ data: reps }, { data: plans }, { data: acts }] = asmIds.length ? await Promise.all([
    db.from("report").select("assessment_id, type, status").eq("status", "RELEASED").in("assessment_id", asmIds),
    db.from("plan").select("assessment_id").in("assessment_id", asmIds),
    db.from("action").select("assessment_id").eq("level", "ORGANISATION").in("status", LIVE).in("assessment_id", asmIds),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const resultIds = new Set((pres ?? []).map((r) => r.pulse_id));
  for (const e of eng ?? []) {
    const a = (asm ?? []).filter((x) => x.engagement_id === e.engagement_id).at(-1);
    const ids = new Set((asm ?? []).filter((x) => x.engagement_id === e.engagement_id).map((x) => x.assessment_id));
    const has = (rows: { assessment_id: string }[] | null) => (rows ?? []).some((r) => ids.has(r.assessment_id));
    const mine = (pls ?? []).filter((p) => p.engagement_id === e.engagement_id);
    out.set(e.engagement_id, {
      state: e.state as E.EngagementState, assessmentId: a?.assessment_id ?? null, windowClose: a?.window_close ?? null,
      orgReleased: (reps ?? []).some((r) => ids.has(r.assessment_id) && r.type === "ORGANISATIONAL"),
      boardReleased: (reps ?? []).some((r) => ids.has(r.assessment_id) && r.type === "BOARD_EXEC_SUMMARY"),
      hasPlan: has(plans), orgActionPublished: has(acts),
      debriefLogged: (aud ?? []).some((x) => x.object_id === e.engagement_id), triggerAccepted: (trg ?? []).some((x) => x.engagement_id === e.engagement_id),
      openPulses: mine.filter((p) => p.status === "OPEN").length,
      unresolvedPulses: mine.filter((p) => p.status !== "DRAFT" && !resultIds.has(p.pulse_id)).length,
    });
  }
  return out;
}

export function guardsOf(f: Facts, today = new Date().toISOString().slice(0, 10)): E.EngagementGuards {
  const annual = f.windowClose ? E.otherTriggers({ baselineClosedOn: f.windowClose.slice(0, 10), today }).some((t) => t.type === "ANNUAL") : false;
  return {
    orgReportReleased: f.orgReleased, boardSummaryReleased: f.boardReleased, priorityZeroRecorded: f.hasPlan, debriefLogged: f.debriefLogged,
    orgPlanApprovedAndPublished: f.orgActionPublished, twelveMonthsElapsed: annual, triggerAccepted: f.triggerAccepted, pulseComplete: f.unresolvedPulses === 0,
  };
}

/** The one forward move from this state, if any. */
export const FORWARD: Partial<Record<E.EngagementState, E.EngagementState>> = { REPORTING: "DEBRIEF", DEBRIEF: "PLANNING", PLANNING: "IMPLEMENTATION", IMPLEMENTATION: "RE_ASSESSMENT" };

/** The engine's verdict on a move by the consultant, with the facts above. null means allowed. */
export const check = (f: Facts, to: E.EngagementState) => E.checkEngagementTransition(f.state, to, "PAC_CONSULTANT", guardsOf(f));

export type Next = { label: string; kind: "post" | "link" | "info"; url?: string; body?: unknown };

/** What the consultant should do next once the report stage has started, in one sentence and at most one button. null before reporting. */
export function nextAfterScoring(f: Facts): Next | null {
  const adv = (to: E.EngagementState, label: string): Next => ({ label, kind: "post", url: "", body: { to } });
  const plan = f.assessmentId ? `/assessments/${f.assessmentId}/plan` : "";
  switch (f.state) {
    case "REPORTING": {
      const to = FORWARD.REPORTING!;
      return !check(f, to) ? adv(to, "Start the debrief") : null;       // until both reports are released the report steps and the Board Summary step on the Portfolio lead here
    }
    case "DEBRIEF":
      if (!f.hasPlan) return { label: "Build the action plan: it records priority zero.", kind: "link", url: plan };
      if (!f.debriefLogged) return { label: "Record that the debrief was held", kind: "post", url: "", body: { debrief: true } };
      return adv("PLANNING", "Start planning");
    case "PLANNING":
      return !check(f, "IMPLEMENTATION") ? adv("IMPLEMENTATION", "Start implementation") : { label: "Agree and publish the organisation level actions", kind: "link", url: plan };
    case "IMPLEMENTATION":
      return !check(f, "RE_ASSESSMENT") ? adv("RE_ASSESSMENT", "Start re-assessment") : { label: "Actions are being delivered. Pulses, triggers and reviews are on Measure.", kind: "info" };
    case "PULSE": return { label: "A pulse is running. The cycle returns to Implementation when its results are stored.", kind: "info" };
    case "RE_ASSESSMENT": return { label: "Create the next cycle on Measure.", kind: "info" };
    default: return null;
  }
}

/** Moves that follow an event rather than a button: a pulse opening, its results being stored, the next cycle being created. Best effort and
 *  only from the state that makes sense, so a client in any other state (a demo seeded past reporting) is left alone. The engine still decides. */
export async function followEvent(engagementId: string, to: E.EngagementState, from: E.EngagementState) {
  const f = (await loadFacts([engagementId])).get(engagementId);
  if (!f || f.state !== from || check(f, to)) return false;
  const up = await admin().from("engagement").update({ state: to }).eq("engagement_id", engagementId).eq("state", from).select("engagement_id");
  return !up.error && (up.data?.length ?? 0) === 1;
}
