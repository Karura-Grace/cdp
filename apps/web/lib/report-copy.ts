// The words of the web report and the portfolio (owner picks Q-WD5 to Q-WD20, 26 Oct 2026): a short meaning and a piece of advice for every tile, orientation, measure and section,
// so no number stands alone. Plain English, Now and Preferred, no dashes or hyphenated words, nothing about how a figure is worked out. The orientation text comes from the PAC
// report library and the versioned playbook; this file only chooses and joins it. Wording only: no figure is computed here.
import { ORIENTATION_PLAYBOOK } from "@pac/cdp-engine";
import { ORIENT, GAP_CLASS } from "./report-library";
import { ORIENT_NAME, type Orientation } from "./format";

type PB = Record<string, { actions: { rows: { label: string; values: string[][] }[] }; metrics: { rows: { label: string; values: string[][] }[] }; profile: { attribute: string; specification: string[] }[] }>;
const PBK = ORIENTATION_PLAYBOOK as unknown as PB;
// the playbook is engine content and may hyphenate ("idea-sharing"); client text never does, so a hyphen between letters becomes a space
const first = (o: string, g: "actions" | "metrics", start: string) => (PBK[o]?.[g].rows.find((r) => r.label.startsWith(start))?.values.flat().filter(Boolean)[0] ?? "").replace(/(?<=[A-Za-z])-(?=[A-Za-z])/g, " ");
const nm = (o: string) => ORIENT_NAME[o as Orientation] ?? o;

export type Say = { meaning: string; advice: string };

/** What an orientation means for this organisation, and what to do about it, given how many points more or less people want (gap) and how people read that gap. */
export function orientationSay(o: Orientation, cls: string): Say {
  const more = cls !== "MODERATE";
  const lever = first(o, "actions", "Priorities team") || first(o, "actions", "Actions individuals");
  return {
    meaning: `${ORIENT[o].what} ${GAP_CLASS[cls] ? `Here, ${nm(o)} is ${GAP_CLASS[cls]}.` : ""}`.trim(),
    advice: more ? `${ORIENT[o].low} ${lever ? `A good first step: ${lever.charAt(0).toLowerCase()}${lever.slice(1)}` : ""}`.trim() : `${ORIENT[o].overdone} Ease off carefully so the strengths it carries are not lost.`,
  };
}

/** The headline tiles at the top of the report page. */
export function headlineSay(k: "now" | "preferred" | "alignment" | "readiness" | "strength", ctx: { o?: Orientation; verdict?: string; band?: string; provisional?: boolean; strengthBand?: string }): Say {
  const o = ctx.o;
  switch (k) {
    case "now":
      return { meaning: o ? `${nm(o)} leads how work gets done here at the moment. ${ORIENT[o].strong}` : "The orientation that leads at the moment.",
        advice: o ? `Protect what ${nm(o)} does well, and keep an eye on the other side of it: ${ORIENT[o].overdone.charAt(0).toLowerCase()}${ORIENT[o].overdone.slice(1)}` : "" };
    case "preferred":
      return { meaning: o ? `${nm(o)} is what people most want to lead. ${ORIENT[o].what}` : "The orientation people most want to lead.",
        advice: o ? `Name ${nm(o)} as the direction of the change, and make one visible move towards it within 30 days. ${first(o, "actions", "Visible signal")}`.trim() : "" };
    case "alignment":
      return ctx.verdict === "HIT"
        ? { meaning: "The culture carries what the strategy needs. People already work in the way the strategy asks.", advice: "Protect it: keep recognising and rewarding the behaviours that got you here." }
        : ctx.verdict === "PARTIAL_HIT"
          ? { meaning: "The culture carries part of what the strategy needs, and part is missing.", advice: "Pick the one orientation the strategy leans on most and build it first, alongside the larger shifts." }
          : { meaning: "The culture does not yet carry what the strategy needs. The strategy will feel the shortfall until that changes.", advice: "Name the orientation the strategy needs, agree the first priority with the executive team, and make one visible change within 30 days." };
    case "readiness":
      return { meaning: `How much change the organisation can take on at once${ctx.band ? `: ${ctx.band.toLowerCase()}` : ""}${ctx.provisional ? ". This is provisional until more leadership 360 results are in" : ""}.`,
        advice: "Choose only as many priorities as this reading allows, close the pre conditions first, and add more once the first visible changes have landed." };
    default:
      return { meaning: `How clearly one orientation stands out from the rest${ctx.strengthBand ? `: a ${ctx.strengthBand.toLowerCase()} culture` : ""}. A strong culture has a clear character and is harder to shift; a mixed one is flexible but can feel less distinct.`,
        advice: "Use it to choose your approach: with a strong culture, change the systems that reward it; with a mixed one, give people one clear picture to rally around." };
  }
}

/** The scorecard measures, by the label the scorecard uses. */
export const MEASURE_SAY: Record<string, Say> = {
  "Culture Risk Index": { meaning: "How much the culture puts the change at risk, bringing together the size of the gap, how much people disagree and how far apart executives and staff are. Lower is better.",
    advice: "Look at what drives it most. If it is disagreement, run listening sessions by department. If it is the gap, start with the largest shift people want." },
  "Change readiness": { meaning: "How well people and teams adjust when plans or priorities change.", advice: "Give every change a visible sponsor, a simple story and early wins, so people see it working before they are asked to commit more." },
  "Transformation Probability Score (TPS)": { meaning: "How much change the organisation can carry at once, taking in digital readiness, safety to speak up, adaptability and leadership alignment.", advice: "Do fewer things, better: pick the priorities this reading allows and close the pre conditions before starting the rest." },
  "Strategy fit": { meaning: "Whether the culture carries enough of what the strategy needs.", advice: "Where it falls short, name the orientation the strategy leans on and build it first." },
  "Cultural entropy": { meaning: "How much energy goes into the distance between where the organisation is and where people want it to be. Higher means more energy is spent on that distance.", advice: "Close the largest gaps first and tell people what is changing, so the energy goes into the work." },
};

/** The strip that opens every section: how to read it, and what to do about it. */
export const SECTION_SAY: Record<string, { read: string; todo: string }> = {
  now_pref: { read: "The four orientations as people describe the organisation now (solid) and as they want it to be (dashed). Orange shading means people want more of that orientation than there is now; grey means less.",
    todo: "Start with the orientation with the largest orange step, and agree one visible change for it within 30 days." },
  scorecard: { read: "The headline measures, each with a word that says what it means. A colour is never the only signal.", todo: "Pick the measure furthest from where you want it and ask what is driving it before choosing actions." },
  values: { read: "The culture people describe about the organisation, set against the culture they live. A large difference means what is said and what is done pull apart.", todo: "Where the difference is large, pick one value and change one system that works against it, such as a recognition or promotion rule." },
  analytics: { read: "How much energy sits in the distance between Now and Preferred, and where two orientations pull against each other.", todo: "Pick the pair that pulls hardest and agree how the organisation will hold both rather than trade one away." },
  perception: { read: "Executives against everyone else on the culture now. A dot for each group; the line between them is the difference.", todo: "Where leaders and staff differ, hold a joint session so each group hears the other describe the organisation, before changing anything." },
  voice: { read: "Eight questions about working life here, each with a word: critical, marginal, good or excellent.", todo: "Take the lowest one into the next leadership meeting and ask staff what would move it." },
  departments: { read: "Each department against the organisation: orange or colour means more than the organisation, a different colour means less. A group too small to show on its own is marked.", todo: "Look at the departments that differ most and ask what they do differently, before treating it as a problem." },
  readiness: { read: "How well the organisation can take on change: digital readiness, speaking up safely, ready for change and the overall reading.", todo: "Protect speaking up safely first: it is the base every other change stands on." },
  checks: { read: "Four checks of the culture against the strategy, leadership behaviour, the systems that shape behaviour and the business model.", todo: "Start with the check marked Miss that the strategy depends on most." },
  findings: { read: "What the checks found, in plain words, with what to do about each.", todo: "Agree owners for the top findings in the next executive meeting." },
  kpis: { read: "The measures the executive team chose to follow the change, with where they start and where they should be.", todo: "Put each measure on a standing agenda with one named owner, and review it every month." },
  next: { read: "From findings to action: the first days, the principles that keep a change on track, and how the work is run.", todo: "Use the next 30 days to make one change people can see." },
};

/** A meaning and advice for one KPI, by its orientation when known. */
export function kpiSay(name: string, orientation?: string): Say {
  const o = orientation as Orientation | undefined;
  if (o && ORIENT[o]) {
    const metric = first(o, "metrics", "Headline performance metric");
    return { meaning: `${name} follows ${nm(o)}. ${metric ? `A headline measure of ${nm(o)} is ${metric.charAt(0).toLowerCase()}${metric.slice(1)}` : `It shows whether ${nm(o)} is growing.`}`.trim(),
      advice: `${first(o, "actions", "Actions individuals") || "Review it every month with its owner."} If it does not move in 90 days, adjust the action rather than the target.` };
  }
  return { meaning: `${name} shows whether the change is landing where it matters.`, advice: "Review it every month with its owner. If it does not move in 90 days, adjust the action rather than the target." };
}

/** Three things to do this month, from the largest shifts. */
export function thisMonth(gaps: { o: Orientation; cls: string }[]): string[] {
  const top = gaps.slice(0, 2);
  const out = top.map(({ o }) => first(o, "actions", "Visible signal") || `Make one visible change that builds ${nm(o)}.`).filter(Boolean);
  out.push("Tell staff what you heard from the results and what you will do first, in plain words, within two weeks.");
  return out.slice(0, 3);
}

/** Plain titles and advice for findings that are not one of the four checks. */
export const FINDING_TITLE: Record<string, string> = {
  C1_PERFORMANCE_ALIGNMENT: "Strategy fit", C2_BEHAVIOUR_GAP: "Leadership behaviour", C3_STOP_START: "What to stop and start", C4_MODEL_READINESS: "Business model readiness",
  PERCEPTION_GAP: "Executives and staff see it differently", ENGAGEMENT_MISS: "A voice score needs attention", READINESS_SIGNAL: "A readiness signal", SUBCULTURE: "A group with its own culture",
};
export const FINDING_SAY: Record<string, Say> = {
  PERCEPTION_GAP: { meaning: "Executives and staff describe this orientation differently, so they are not working from the same picture.", advice: "Hold a joint session where each group hears the other describe the organisation, before changing anything." },
  ENGAGEMENT_MISS: { meaning: "One of the eight voice questions is low enough to hold back the change.", advice: "Take it into the next leadership meeting, ask staff what would move it, and name one owner." },
  READINESS_SIGNAL: { meaning: "One of the readiness measures is below where it needs to be for the change ahead.", advice: "Build it before adding new priorities: a short, visible win that uses it is the quickest way." },
  SUBCULTURE: { meaning: "A group of people experiences the culture differently from the organisation as a whole.", advice: "Look at the group in Explore, ask what it does differently, and decide whether to learn from it or bring it closer." },
};

/** The tiles and pre conditions on the action plan page (Q-RD3, 28 Oct 2026). */
export const PLAN_SAY: Record<"actions" | "track" | "p0" | "start", Say> = {
  actions: { meaning: "Every action the plan holds, from the first proposals to the ones already closed. Live actions are the ones being worked on and tracked now.", advice: "Move the proposed actions into the plan or set them aside, so the live list shows only work that has an owner and a date." },
  track: { meaning: "How the live actions are going, judged on their latest KPI reading and their due date. Green is on track, amber at risk, red off track.", advice: "Start each review with the red ones: agree what is in the way and who will clear it before the next reading." },
  p0: { meaning: "Pre conditions are the few things that must happen first, such as listening to the groups who feel least safe to speak up. Actions they hold cannot be published until they are done.", advice: "Close them early. Each open one keeps a priority waiting, and people notice when nothing changes after a survey." },
  start: { meaning: "The date the plan counts from. Due dates, reviews at 90 and 180 days, and the next pulse all follow from it.", advice: "Share the start date and the first review date with the executive team, so the plan has a rhythm everyone knows." },
};

/** The Leadership 360 page (Q-RD3, 28 Oct 2026). */
export const LEADER_SAY: Record<"scope" | "returned" | "results" | "leader", Say> = {
  scope: { meaning: "The leaders recorded as leading a team when the assessment launched. Each one gets a self form and forms for the people who work with them.", advice: "Check the list against who really leads teams now, so no leader is missed and nobody is rated for a team they no longer lead." },
  returned: { meaning: "How many self and rater forms have come back out of all those sent. A leader needs a self form and at least three raters for a result.", advice: "Remind raters for the leaders who are still short, a few days before the window closes." },
  results: { meaning: "Leaders with enough feedback for a fair result. The rest are shown as not enough feedback, never as a weak score.", advice: "Use the results for development only. They never feed pay, promotion or discipline decisions." },
  leader: { meaning: "How this leader's behaviour is seen by others, set against how they see themselves and the leadership the strategy needs.", advice: "Agree one behaviour to start, stop or keep, and one change people will notice within 30 days, in the development plan." },
};

/** The People Leader's own team page (Q-RD3, 28 Oct 2026). */
export const TEAM_SAY: Record<"map" | "vsOrg" | "feedback", Say> = {
  map: { meaning: "Where your team's culture sits Now (solid) and where your team would prefer it to be (dashed). The further apart, the more change your team is asking for.", advice: "Share the picture with your team and ask what one change would move it most. Small, visible steps count more than a big programme." },
  vsOrg: { meaning: "How your team differs from the whole organisation on each orientation. A plus means your team shows more of it than the organisation does.", advice: "Where your team stands far from the organisation, find out why before you act: it can be a strength to keep or a gap to close." },
  feedback: { meaning: "How the people who work with you see your leadership, set against how you see yourself.", advice: "Pick one behaviour from your development plan and make it visible within 30 days. Ask a few raters later whether they noticed." },
};

/** The engagement home tiles (Q-RD3, 28 Oct 2026). */
export const ENG_SAY: Record<"people" | "setup" | "responses" | "reports", Say> = {
  people: { meaning: "The people loaded for this organisation: the roster the survey invitations and every group result are built from.", advice: "Keep it current before launch. Joiners and leavers after launch do not change who was invited." },
  setup: { meaning: "How many of the nine setup sections are agreed. The survey can only launch once all nine are agreed in the workshop.", advice: "Agree the open sections in the next workshop session, starting with strategy and priorities." },
  responses: { meaning: "How many invited people have answered so far. Only counts are shown, never who answered.", advice: "If the rate is low, ask leaders to remind their teams in person. People answer more when they hear it from someone they know." },
  reports: { meaning: "Reports released to the organisation. Drafts stay with PAC until they are checked and released.", advice: "Open the latest report first and read the summary at the top before the detail." },
};
