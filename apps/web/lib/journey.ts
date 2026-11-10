// "Where am I and what do I do next": one plain sentence per role and engagement stage, the stage bar, and the consultant next step.
// It reads no data itself; callers pass what they loaded. Used by the Portfolio and the engagement Overview.
import { nextAfterScoring, type Facts } from "./lifecycle";
export const JOURNEY = ["Setup", "Fielding", "Scoring", "Reporting", "Debrief", "Planning", "Implementation", "Re-assessment"] as const;
const AT: Record<string, number> = { SETUP: 0, FIELDING: 1, SCORING: 2, REPORTING: 3, DEBRIEF: 4, PLANNING: 5, IMPLEMENTATION: 6, PULSE: 7, RE_ASSESSMENT: 7, CLOSED: 7 };

const CONSULTANT: Record<string, string> = {
  SETUP: "Check the client has loaded their organisation and people, then create the assessment, agree sections A to I, approve the consent text, record the transfer basis and launch.",
  FIELDING: "The survey is open. Issue the links, watch the fielding monitor, and freeze the data once the window has closed.",
  SCORING: "The data is frozen. Run scoring, look at the result, then freeze the score.",
  REPORTING: "The score is frozen. Run the findings, create the reports, write What this means and What to do next, and release. Then build the action plan.",
  DEBRIEF: "Hold the debrief with the executive team and record priority zero.",
  PLANNING: "Agree the priorities and actions with the executives and publish the plan.",
  IMPLEMENTATION: "Track the actions, KPI readings and evidence on the Action plan, and run the 90 and 180 day reviews.",
  RE_ASSESSMENT: "Run pulses, decide triggers and compare cycles on the Measure page; start the next cycle when it is due.",
};
const CLIENT_ADMIN: Record<string, string> = {
  SETUP: "Load your organisation, people and leaders on Organisation and leaders. Your PAC consultant then completes the setup and launches.",
  FIELDING: "The survey is open. Your PAC consultant sends the links and watches the response count.",
  SCORING: "The answers are being scored by your PAC consultant.",
  REPORTING: "Your PAC consultant is preparing the reports. They appear here once released.",
};
const OTHER = "Released reports and plans appear here. You only ever see what your role is allowed to see.";

export function journey(role: string | null, state: string): { step: number; of: number; stage: string; text: string } {
  const step = (AT[state] ?? 0) + 1;
  const key = state === "PULSE" || state === "CLOSED" ? "RE_ASSESSMENT" : state;
  const text = role === "PAC_CONSULTANT" ? CONSULTANT[key]
    : role === "CLIENT_ADMIN" ? (CLIENT_ADMIN[key] ?? "Results, the plan and Measure appear here as your PAC consultant releases them.")
    : OTHER;
  return { step, of: JOURNEY.length, stage: JOURNEY[step - 1], text: text ?? OTHER };
}

// What each role can do in the product, for the panel on the Portfolio.
export const ROLE_GUIDE: Record<string, string[]> = {
  SUPER_ADMIN: ["Create organisations and their first engagement (Organisations).", "Create and manage users (Manage users).", "You never see a client's results or any answer."],
  PAC_CONSULTANT: ["Run an engagement from setup to the next cycle, one stage after another (the next step is shown on each client).", "Set up and launch, issue survey links, freeze, score, find, report and release.", "Build the plan, decide triggers, run pulses and reviews, start the next cycle."],
  CLIENT_ADMIN: ["Load the organisation, people and leaders (Organisation and leaders).", "Read the released reports, the plan and Measure for your organisation.", "Add users from your own organisation (Manage users)."],
  EXECUTIVE: ["Read the released reports, plan and Measure.", "Approve actions at organisation level.", "See your own leader report and those of your direct reports."],
  PEOPLE_LEADER: ["See your team's results when at least five people answered.", "See your own 360 result and development plan.", "Work on your own unit's actions."],
  COACH: ["See the leader reports and development plans of the leaders you coach, for the coaching period only."],
};

// The engagement states shown as a path. Pulse, re-assessment and closed share the last stop.
export const STAGES = [
  { label: "Setup", states: ["SETUP"] }, { label: "Fielding", states: ["FIELDING"] }, { label: "Scoring", states: ["SCORING"] },
  { label: "Reporting", states: ["REPORTING"] }, { label: "Debrief", states: ["DEBRIEF"] }, { label: "Planning", states: ["PLANNING"] },
  { label: "Implementation", states: ["IMPLEMENTATION"] }, { label: "Re-assessment", states: ["PULSE", "RE_ASSESSMENT", "CLOSED"] },
];

export type Asm = { assessment_id: string; status: string; window_close: string | null; frozen_at: string | null };

// The consultant's next step, derived from what is stored. null once a report exists.
export function nextStep(a: Asm, scores: { assessment_id: string; version: number; frozen_at: string | null }[], evals: { assessment_id: string; score_version: number }[], reps: unknown[]):
  { label: string; url?: string; href?: string; body?: unknown } | null {
  const base = `/v1/assessments/${a.assessment_id}`;
  if (!a.frozen_at) {
    return a.window_close && new Date(a.window_close) > new Date()
      ? { label: `Survey open until ${new Date(a.window_close).toISOString().slice(0, 16).replace("T", " ")} UTC. You can freeze the data after that.` }
      : { label: "Freeze the data", url: `${base}/freeze` };
  }
  const sc = scores.filter((s) => s.assessment_id === a.assessment_id).at(-1);
  if (!sc) return { label: "Run scoring", url: `${base}/score` };
  if (!sc.frozen_at) return { label: "Freeze the score", url: `${base}/score/freeze` };
  if (!evals.some((e) => e.assessment_id === a.assessment_id && e.score_version === sc.version)) return { label: "Run findings", url: `${base}/evaluate` };
  return reps.length ? null : { label: "Create the organisational report", url: `${base}/reports`, body: { type: "ORGANISATIONAL" } };
}

// The consultant's next step on an engagement: the pipeline step before a report exists, then the lifecycle step from the engine's guards.
// url means a POST button, href a link, neither a sentence only.
export function consultantNext(e: { engagement_id: string; state: string }, asm: Asm, scores: Parameters<typeof nextStep>[1], evals: Parameters<typeof nextStep>[2],
  reps: { report_id: string; type: string }[], fx: Facts | undefined): { label: string; url?: string; href?: string; body?: unknown } | null {
  const next = nextStep(asm, scores, evals, reps);
  if (next || !fx) return next;
  const n = nextAfterScoring(fx);
  if (n?.kind === "post") return { label: n.label, url: `/v1/engagements/${e.engagement_id}/advance`, body: n.body };
  if (n) return { label: n.label, href: n.url };
  if (e.state === "REPORTING" && fx.orgReleased && !fx.boardReleased) {
    // the debrief needs the Board / Executive Summary too: create it, or open the draft
    const board = reps.find((r) => r.type === "BOARD_EXEC_SUMMARY");
    return board ? { label: "Open the Board / Executive Summary, then release it to start the debrief.", href: `/reports/${board.report_id}` }
      : { label: "Create the Board / Executive Summary", url: `/v1/assessments/${asm.assessment_id}/reports`, body: { type: "BOARD_EXEC_SUMMARY" } };
  }
  return null;
}
