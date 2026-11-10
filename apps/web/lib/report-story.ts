// The organisational report in the shape of the PAC reference report (Geminia, April 2026): scorecard tiles, the Big Three,
// rule based narrative for two audiences, and PAC template text the consultant edits before release.
// Every number comes from the frozen score object or the stored evaluation; this module only chooses and words them.
// Wording rules for client text: plain English, no dashes, no hyphenated words.
import { GLOSSARY_AZ } from "./glossary";
import { D } from "@pac/cdp-engine";
import type { Evaluation, Score } from "./report-data";
import { checkTiles, type EvalPayload } from "./findings-view";
import { ORIENTATIONS, ORIENT_NAME, dp as dp0, human, signed as signed0, type Orientation } from "./format";
import { prose } from "./precision";
// one decimal in prose becomes two while the AI text is built (owner Q-D9-24), so its headlines quote the numbers the tables show
const dp = (x: string | number, p: number) => dp0(x, p === 1 ? prose.places : p);
const signed = (x: string | number, p = 0) => signed0(x, p === 1 ? prose.places : p);

const name = (o: string) => ORIENT_NAME[o as Orientation] ?? o;

export const EOS_NAMES = ["Would recommend as a place to work", "Leadership", "Innovation climate", "Development and growth", "Communication",
  "Wellbeing", "Inclusion and fairness", "Strategic clarity"];

// ---------------------------------------------------------------- scorecard tiles
export interface Tile { label: string; value: string; note: string }
export function scorecard(s: Score, e: Evaluation | undefined): Tile[] {
  const a = s.analytics, rd = s.readiness;
  const tiles: Tile[] = [];
  if (a?.risk) tiles.push({ label: "Culture Risk Index", value: a.risk.index, note: `${human(a.risk.band)} risk` });
  if (rd.d9) tiles.push({ label: "Change readiness", value: `${dp(rd.d9, 2)} / 5`, note: rd.d9_band ?? "" });
  if (rd.tps) tiles.push({ label: "Transformation Probability Score (TPS)", value: `${dp(rd.tps, 2)} / 5`, note: `${human(rd.tps_band ?? "")}${rd.provisional ? " (provisional)" : ""}` });
  if (e?.checks.C1) tiles.push({ label: "Strategy fit", value: human(e.checks.C1), note: "Does the culture support the strategy?" });
  if (a) tiles.push({ label: "Cultural entropy", value: a.entropy.score, note: `${human(a.entropy.band)} · mean gap in points` });
  return tiles;
}

// ---------------------------------------------------------------- the Big Three: one accelerator, two blockers
export interface Big { kind: "Accelerator" | "Blocker 1" | "Blocker 2"; title: string; text: string; figure: string }
export function bigThree(s: Score): Big[] {
  const os = s.orientation_scores, rd = s.readiness;
  const dom = s.dominance.dominant[0];
  const out: Big[] = [{ kind: "Accelerator", title: `${name(dom)} as the foundation`,
    text: `The culture runs on ${name(dom)} now${s.classification[dom] === "MODERATE" ? ", although people feel it is overdone" : ", and people want to keep it"}. It is the base the change can build on.`,
    figure: `${dp(os.now[dom], 1)} points now` }];
  const build = [...ORIENTATIONS].filter((o) => D(os.gap[o]).gt(0)).sort((a, b) => D(os.gap[b]).comparedTo(D(os.gap[a])))[0];
  if (build) out.push({ kind: "Blocker 1", title: `${name(build)} deficit`,
    text: `People want much more ${name(build)} than they experience now. Until it grows, the strategy depends on behaviour the culture does not yet reward.`,
    figure: `${signed(os.gap[build], 1)} points wanted` });
  const shadow = s.perception_flags ? ORIENTATIONS.filter((o) => s.perception_flags![o] === "SHADOW_CULTURE") : [];
  if (shadow.length && s.perception_gap) out.push({ kind: "Blocker 2", title: "Shadow culture between executives and staff",
    text: `Executives and staff describe different cultures on ${shadow.map(name).join(" and ")}. Leaders may believe the change is further along than staff experience it.`,
    figure: `${dp(s.perception_gap[shadow[0]], 1)} point difference` });
  else {
    const low = (["d7", "d8", "d9"] as const).filter((k) => rd[k]).sort((a, b) => D(rd[a]!).comparedTo(D(rd[b]!)))[0];
    const label = { d7: "Digital readiness", d8: "Psychological safety", d9: "Adaptive capacity" } as const;
    if (low) out.push({ kind: "Blocker 2", title: `${label[low]} is the weakest readiness`,
      text: `Of the three readiness measures, ${label[low].toLowerCase()} is lowest. Change that leans on it will meet resistance first.`, figure: `${dp(rd[low]!, 2)} / 5` });
  }
  return out;
}

// ---------------------------------------------------------------- rule based narrative, by audience
export function narrative(s: Score, e: Evaluation | undefined, audience: "BOARD" | "PEOPLE"): string[] {
  const os = s.orientation_scores, a = s.analytics;
  const dom = s.dominance.dominant.map(name).join(" and ");
  const gaps = [...ORIENTATIONS].sort((x, y) => D(os.gap[y]).abs().comparedTo(D(os.gap[x]).abs()));
  const lines = [`The culture now is led by ${dom}. People most want to change ${name(gaps[0])} (${signed(os.gap[gaps[0]], 1)} points) and ${name(gaps[1])} (${signed(os.gap[gaps[1]], 1)}).`];
  if (e?.checks.C1) lines.push(e.checks.C1 === "HIT" ? "The culture as measured supports the strategy you declared." : `On the strategy check the result is ${human(e.checks.C1).toLowerCase()}: the culture does not yet fully support the strategy you declared.`);
  if (a?.risk) lines.push(`The Culture Risk Index is ${a.risk.index} (${human(a.risk.band).toLowerCase()}), driven most by ${[["the gap between Now and Preferred", a.risk.gap], ["disagreement between respondents", a.risk.dispersion], ["distance between executives and staff", a.risk.misalignment]].sort((x, y) => Number(y[1]) - Number(x[1]))[0][0]}.`);
  if (audience === "BOARD") {
    if (s.readiness.tps) lines.push(`The Transformation Probability Score (TPS) stands at ${dp(s.readiness.tps, 2)} out of 5 (${human(s.readiness.tps_band ?? "").toLowerCase()}), which sets how many priorities the organisation can carry at once.`);
  } else {
    const low = EOS_NAMES.map((n, i) => [n, s.eos[`Q${i + 1}` as keyof Score["eos"]]] as const).filter(([, v]) => v !== null && v !== undefined && Number(v) < 0);
    if (low.length) lines.push(`Employees are negative on ${low.map(([n, v]) => `${n.toLowerCase()} (${v})`).join(", ")}. These are the first places to listen.`);
    const hi = a?.tensions.filter((t) => t.band === "HIGH") ?? [];
    if (hi.length) lines.push(`Tension is high between ${hi.map((t) => `${name(t.a)} and ${name(t.b)}`).join(", and between ")}: people want one to grow while the other shrinks. Name what each protects before asking it to give ground.`);
  }
  return lines;
}

// ---------------------------------------------------------------- template text (consultant edits before release)
export function quickWinsDraft(s: Score, e: Evaluation | undefined): string {
  const build = [...ORIENTATIONS].sort((a, b) => D(s.orientation_scores.gap[b]).comparedTo(D(s.orientation_scores.gap[a])))[0];
  return [
    "Chief Executive shares a short culture commitment statement with all staff.",
    "Share the headline results with every team, including what was hard to hear.",
    `Name one visible change that shows more ${name(build)} within 30 days, with an owner.`,
    "Form a culture council of executives and staff representatives to own the plan.",
    ...(e?.findings.some((f) => f.blocking) ? ["Close the blocking findings before any priority is published."] : []),
  ].join("\n");
}

export const FACILITATION_TEMPLATE = [
  "Session 1. Leadership debrief (half day, executive team). Walk through the results, agree what the data says before deciding what to do, and record priority zero.",
  "Session 2. Culture strategy workshop (full day, executives and the culture council). Choose up to the number of priorities the readiness allows, with owners and dates.",
  "Session 3. People manager cascade (90 minutes per group). Share the results and the plan, and gather what managers need to lead the change.",
  "Non negotiables: no attempt to identify who said what; results shown only for groups of five or more; questions answered openly, including the uncomfortable ones.",
].join("\n");

export const CHANGE_PRINCIPLES = [
  "Lead with what the culture already does well before asking it to change.",
  "Change what leaders do and reward before changing what they say.",
  "Make every priority visible to staff within 30 days.",
  "Measure the change: pulse at 90 and 180 days, and reassess at twelve months.",
  "Keep the people who answered informed of what changed because they did.",
];

export const GOVERNANCE = [
  ["Quarterly", "Executive team reviews action progress, KPI readings and evidence."],
  ["Every six months", "Pulse on the priority watch list; the consultant reviews any trigger."],
  ["Annually", "Full reassessment against this baseline."],
  ["Board", "Culture as a standing agenda item, with the scorecard below."],
];


// the one glossary lives in glossary.ts (owner request 26 Oct 2026); reports and the web page read it from here
export const GLOSSARY: [string, string][] = GLOSSARY_AZ;

export const ETHICS = "The Culture Dynamics Profile is presented by a trained consultant. Results are reported for groups, never for individuals, and are never used to make decisions about individuals. Answers are separated from names when submitted. Data is held under the Kenya Data Protection Act 2019 and the retention period agreed with your organisation.";

// ---------------------------------------------------------------- the system drafted "What to do next" (owner ruling 22 Oct 2026)
/** What to do next, drafted from the findings alone. The consultant does not edit it: comments go to the client in the debrief, outside the report. */
export function nextStepsDraft(s: Score, e: Evaluation | undefined): string {
  const os = s.orientation_scores;
  const up = [...ORIENTATIONS].filter((o) => D(os.gap[o]).gt(0)).sort((x, y) => D(os.gap[y]).comparedTo(D(os.gap[x])));
  const lines: string[] = [];
  if (up.length) lines.push(`Start by building more ${name(up[0])}: people want ${name(up[0])} ${signed(os.gap[up[0]], 1)} points higher than it is now.`);
  const tiles = e ? checkTiles(e as unknown as EvalPayload).filter((t) => t.response) : [];
  for (const t of tiles) lines.push(`${t.name}: ${t.response}`);
  const blocking = e?.findings.filter((f) => f.blocking).length ?? 0;
  if (blocking) lines.push(`${blocking} finding${blocking === 1 ? " blocks" : "s block"} related priorities. Close ${blocking === 1 ? "it" : "them"} before those priorities are published.`);
  if (s.readiness.tps_band) lines.push(`The Transformation Probability Score (TPS) is ${human(s.readiness.tps_band).toLowerCase()}, which sets how many priorities the organisation can carry at once. Choose priorities within that limit.`);
  lines.push("Your leadership team reviews the proposed actions in the action plan, ranks them and accepts the ones it will own. Each action opens to its reasons, owner, measure and the signal people will see within 30 days.");
  return lines.join("\n");
}
