// PAC interpretation library for the full report: fixed wording keyed to frozen values (orientation, band, class, verdict).
// It never computes a score; callers pass values read from the frozen score object, the evaluation or the plan.
// House style for client text: plain English, no dashes, no hyphenated words.
import type { Orientation } from "./format";

export const ORIENT: Record<Orientation, { what: string; strong: string; overdone: string; low: string; leader: string }> = {
  ENGAGE: {
    what: "Engage is the people orientation: belonging, trust, development and care for one another. It asks whether people feel part of something and grow while they work.",
    strong: "Where Engage is strong, people help each other without being asked, stay through difficult periods and invest in the next generation of talent.",
    overdone: "Overdone, Engage turns into comfort: hard conversations are avoided, performance problems linger and loyalty is valued above contribution.",
    low: "When Engage is low, people do their job but give little more. Attrition rises, knowledge leaves with people and change is met with quiet withdrawal.",
    leader: "coaches and team builders",
  },
  INNOVATE: {
    what: "Innovate is the orientation of new ideas: experiment, learn fast, take measured risks and look outward for what comes next.",
    strong: "Where Innovate is strong, people try new ways of working on a small scale, share what they learn and treat a failed experiment as information.",
    overdone: "Overdone, Innovate scatters energy across too many initiatives, and good ideas never reach the discipline needed to scale.",
    low: "When Innovate is low, new ideas wait for permission, pilots take months to approve and competitors set the pace.",
    leader: "visionaries and entrepreneurs",
  },
  PERFORM: {
    what: "Perform is the results orientation: clear targets, competition, accountability and attention to customers and the market.",
    strong: "Where Perform is strong, people know what success looks like, deliver on commitments and measure progress honestly.",
    overdone: "Overdone, Perform burns people out: the number becomes the only story, collaboration suffers and short term wins crowd out long term investment.",
    low: "When Perform is low, goals blur, accountability is soft and good intentions do not convert into results.",
    leader: "drivers and competitors",
  },
  GOVERN: {
    what: "Govern is the orientation of order: clear processes, reliability, control of risk and consistent standards.",
    strong: "Where Govern is strong, work is predictable, risks are managed and customers and regulators can rely on the organisation.",
    overdone: "Overdone, Govern becomes bureaucracy: approvals stack up, initiative waits for permission and the process matters more than the purpose.",
    low: "When Govern is low, quality varies from team to team, risks surface late and people improvise where a clear standard would serve them better.",
    leader: "organisers and process architects",
  },
};

export const DIMENSION: Record<string, { name: string; asks: string }> = {
  D1: { name: "Cultural DNA", asks: "what fundamentally defines the organisation: its character, how it feels to work here and how it responds under pressure" },
  D2: { name: "Leadership Blueprint", asks: "how leaders lead, what they model day to day and what they are recognised for" },
  D3: { name: "People Architecture", asks: "how people are managed, developed and enabled to contribute, including how performance conversations happen" },
  D4: { name: "Cohesion Drivers", asks: "what holds the organisation together through pressure and change, and why people stay" },
  D5: { name: "Strategic Compass", asks: "what really guides priorities and the allocation of money and time when trade offs get hard" },
  D6: { name: "Victory Conditions", asks: "how success is defined, measured and celebrated, and therefore what the culture truly values" },
};

export const GAP_CLASS: Record<string, string> = {
  BUILD: "a significant shift people want: this orientation needs to grow, and the strategy will feel the shortfall until it does",
  STRENGTHEN: "a moderate increase people want: worth building deliberately, alongside the larger shifts",
  KEEP_AND_PROTECT: "close to where people want it: protect it while other parts of the culture change",
  MODERATE: "more than people want: the culture should ease off here, carefully, so the strengths it carries are not lost",
};


export function entropyText(score: string, band: string): string {
  return {
    LOW: `Cultural entropy is ${score} points, which is low: what people experience and what they want are close, and little energy is lost in the distance between them.`,
    MODERATE: `Cultural entropy is ${score} points, which is moderate: there is a clear agenda for change, and it is still within reach of a focused plan.`,
    HIGH: `Cultural entropy is ${score} points, which is high: much of the organisation's energy goes into the distance between how things are and how people want them to be. Expect frustration and slower delivery until the main gaps close.`,
    CRITICAL: `Cultural entropy is ${score} points, which is critical: the culture people live and the one they want are far apart. Change should start with the few gaps that matter most to the strategy rather than all of them at once.`,
  }[band] ?? "";
}

export function tensionText(a: string, b: string, score: string, band: string): string {
  if (band === "LOW") return `The tension between ${a} and ${b} is low (${score} out of 10): the change asked of one does not pull hard against the other.`;
  return `The tension between ${a} and ${b} is ${band.toLowerCase()} (${score} out of 10): people want one to grow while the other shrinks. Name what each protects before asking either to give ground, or the change story will meet passive resistance.`;
}

export function riskText(index: string, band: string, driver: string): string {
  const b = { LOW: "low", MEDIUM: "medium", HIGH: "high" }[band] ?? band.toLowerCase();
  return `The Culture Risk Index is ${index}, a ${b} reading. It is driven most by ${driver}. The index is a measure for setting priorities; it is not a benchmark against other organisations.`;
}

export const READINESS: Record<string, { name: string; what: string; bands: Record<string, string> }> = {
  D7: { name: "Digital readiness", what: "whether the culture adopts technology and data in the way work is done, or quietly resists it",
    bands: { "Digitally resistant": "Technology investment is likely to stall: people will route around new tools unless leaders model them and old ways are retired.",
      "Digitally cautious": "People will adopt new tools when the benefit is clear and support is close at hand. Lead with a few visible wins.",
      "Moderately ready": "The basics are in place. Adoption will follow where leaders use the tools themselves and remove the old routes.",
      "Digitally capable": "Digital ways of working are normal here. The next step is using data to make decisions, not only to report them.",
      "Digitally advanced": "Digital is part of the culture. Protect it and use it to lead the wider change." } },
  D8: { name: "Psychological safety", what: "whether people can speak up, challenge and admit mistakes without fear",
    bands: { "Fear-based culture": "People stay silent to stay safe. Problems will surface late and change will be agreed in the room and resisted outside it.",
      "Cautious / selective candour": "People speak up selectively, usually to peers rather than to leaders. Leaders must invite challenge visibly before it will come.",
      "Moderate safety": "Candour exists in some teams and not in others. Consistency in how leaders respond to bad news will lift it.",
      "Open culture": "People raise problems and ideas openly. Keep it by rewarding the messenger, especially when the news is bad.",
      "Challenge culture: highly safe": "Challenge is expected and welcomed. This is a strong foundation for any change." } },
  D9: { name: "Adaptive capacity", what: "whether the organisation can sustain change over 12 to 24 months, not only start it",
    bands: { "Critical resistance": "Change capacity is the binding constraint. Build the conditions for change before launching change content.",
      "Significant barriers": "The organisation can start change but struggles to sustain it. Sequence priorities and protect capacity for each.",
      "Moderate readiness": "Change is possible with deliberate support: clear ownership, visible progress and time for people to adjust.",
      "Good readiness": "The organisation has absorbed change before and can do so again with standard support.",
      "Strong readiness": "Change capacity is a strength. The organisation can carry several priorities at once." } },
};

export const EOS: { name: string; low: string; high: string }[] = [
  { name: "Would recommend as a place to work", low: "People would not readily recommend the organisation to a friend. This is the clearest early signal of attrition risk.", high: "People would recommend the organisation as a place to work, a strong signal of commitment." },
  { name: "Leadership", low: "Confidence in leadership is weak. Visible, consistent leadership behaviour will matter more than new messages.", high: "People rate the quality of leadership well, a base the change can lean on." },
  { name: "Innovation climate", low: "People do not see a genuine commitment to new ideas. Experiments need permission, protection and visible recognition.", high: "People see a real commitment to trying new approaches." },
  { name: "Development and growth", low: "People do not see a growth path. Expect skilled people to look elsewhere unless development becomes visible and fair.", high: "People value the development and career opportunities on offer." },
  { name: "Communication", low: "People hear decisions without the reasons behind them. Explaining why, early and in person, is a low cost fix.", high: "People rate communication from leadership as open and clear." },
  { name: "Wellbeing", low: "Work and life are out of balance. Change added on top of current load will be resisted however good its intent.", high: "People feel the organisation supports their wellbeing." },
  { name: "Inclusion and fairness", low: "Some people do not feel treated fairly. Look at promotion, pay and voice by group before the gap widens.", high: "People see the workplace as fair and inclusive." },
  { name: "Strategic clarity", low: "People do not see how the strategy connects to their daily work. Translate it into what each team does differently.", high: "People understand the strategy and how their work contributes to it." },
];

// Hits and misses: the priority framework of the PAC reference platform
export const CHECK: Record<string, { name: string; asks: string; risk: string; intervention: string; owner: string; urgency: string }> = {
  C1: { name: "Strategy fit", asks: "Does the culture carry enough of the orientations the declared strategic priorities need?",
    risk: "The strategy depends on behaviour the culture does not yet reward, so delivery slips and the plan is quietly reinterpreted.",
    intervention: "Name the orientation the strategy needs, make one visible change within 30 days, and align recognition and promotion to it.",
    owner: "Chief Executive and Chief People Officer", urgency: "0 to 30 days" },
  C2: { name: "Leadership behaviour", asks: "Do leaders show the behaviours the strategy requires, as staff experience them?",
    risk: "People copy what leaders do, not what they say. A gap here undoes every other intervention.",
    intervention: "Agree five observable leadership behaviours, build them into one to one coaching and the Leadership 360, and review them quarterly.",
    owner: "Executive team", urgency: "0 to 90 days" },
  C3: { name: "What to stop and start", asks: "Do current systems (performance, promotion, reward, approvals) reinforce the culture the organisation wants, or contradict it?",
    risk: "Processes that reward the old culture keep producing it, whatever leaders announce.",
    intervention: "Fix the contradictions in performance management, promotion and reward first; they shape behaviour more than any message.",
    owner: "Chief People Officer and process owners", urgency: "1 to 6 months" },
  C4: { name: "Business model readiness", asks: "Does the culture fit the business model the organisation runs, or plans to move to?",
    risk: "A model change built on a culture that does not fit it will run late and over budget.",
    intervention: "Build the orientations the target model needs before the model goes live, starting with the teams who will run it.",
    owner: "Executive team and the Board", urgency: "6 to 18 months" },
};
export const VERDICT: Record<string, string> = {
  HIT: "Hit: the culture supports this check.",
  PARTIAL_HIT: "Partial hit: the culture supports part of what is needed.",
  MISS: "Miss: the culture does not yet support what is needed.",
  SYSTEMIC_MISS: "Systemic miss: the systems themselves reinforce the culture the organisation wants to leave behind.",
};

export const PHASES = [
  { name: "Foundation and alignment", when: "0 to 90 days", focus: "Agree the findings with the executive team, close the pre conditions, make the first visible changes and set up the culture council." },
  { name: "Activation and build", when: "Months 4 to 12", focus: "Deliver the priorities through owned actions, change the systems that contradict the target culture, and pulse at 90 and 180 days." },
  { name: "Embedding and sustaining", when: "Years 2 to 3", focus: "Build the target culture into hiring, promotion and reward, reassess at twelve months and make culture a standing Board item." },
];

export const FACILITATION = [
  { name: "Session 1. Leadership debrief", length: "Half day", who: "The executive team, led by the consultant",
    purpose: "Agree what the data says before deciding what to do about it.",
    agenda: ["Walk through the scorecard and the Big Three", "Read the gaps, the tensions and the executives and staff view together", "Agree the pre conditions (priority zero) and who owns each"],
    outputs: "A shared reading of the results and the priority zero list." },
  { name: "Session 2. Culture strategy workshop", length: "Full day", who: "Executives and the culture council",
    purpose: "Choose the priorities the organisation can carry, with owners and dates.",
    agenda: ["Review the hits and misses against the strategy", "Choose up to the number of priorities readiness allows", "Agree actions, owners, KPIs and the first 14 days"],
    outputs: "The action plan, ready for approval and publication." },
  { name: "Session 3. People manager cascade", length: "90 minutes per group", who: "People managers, in groups",
    purpose: "Share the results and the plan, and prepare managers to lead the change in their teams.",
    agenda: ["What the organisation said and what will change", "What it means for each team", "What managers need to lead it"],
    outputs: "Managers ready to brief their teams within two weeks." },
];
export const NON_NEGOTIABLES = ["No attempt is ever made to identify who said what.", "Results are only ever shown for groups, never for individuals.",
  "Questions are answered openly, including the uncomfortable ones.", "Every session ends with named owners and dates."];


// What more or less of an orientation means in practice, for a department against the organisation and for leaders (Erick #74, #193).
// Wording only, keyed to the orientation; the direction comes from frozen values.
export const ORIENT_MORE: Record<string, { more: string; less: string }> = {
  ENGAGE: { more: "people here care more about belonging, trust and developing each other. Expect strong team loyalty; watch that decisions are not slowed by the wish to keep everyone on board.",
    less: "relationships and development get less attention here. Watch for people feeling like a resource rather than part of a team, and for quiet exits." },
  INNOVATE: { more: "people here experiment more, move faster and look outward for what comes next. Expect energy for new ideas; watch for initiatives that start and are never finished.",
    less: "new ideas get less room here. Watch for good ideas that never surface, and for the team falling behind changes outside." },
  PERFORM: { more: "people here are driven by targets, competition and results. Expect pace and accountability; watch for burnout, and for winning locally at the cost of other teams.",
    less: "targets and results count for less here. Watch for slipping deadlines and for outcomes that nobody clearly owns." },
  GOVERN: { more: "people here value clear process, control and reliability. Expect consistent, low risk work; watch for slow approvals and rules that outlive their purpose.",
    less: "process and control count for less here. Watch for uneven quality, shortcuts and risks that nobody owns." },
};

/** The executive and staff difference in words: who sees more of which orientation, how big it is, and what to do (Erick #72). */
export function perceptionText(o: string, exec: number, staff: number): string {
  const d = exec - staff, size = Math.abs(d), nm = o.charAt(0) + o.slice(1).toLowerCase();
  const who = d > 0 ? `executives see more ${nm} than staff do` : `staff see more ${nm} than executives do`;
  const read = size < 3 ? "A difference this small is normal: the two groups describe the same organisation."
    : size <= 5 ? "This is worth watching. Leaders may judge progress on a picture staff do not fully share, so check plans against what staff say before announcing them."
    : "This is large enough to treat as a blind spot. Decisions made on the leaders' picture will miss, so leaders should hear staff directly before the plan is agreed.";
  return `The largest difference is in ${nm}: ${who} (${size.toFixed(1)} points). ${read}`;
}

// A short introduction for each chapter: what it measures and how to read it, before any result (Erick #73, owner Q-ER28).
// Drafted 30 Oct 2026 for the owner and Erick to approve.
export const CHAPTER_INTRO: Record<string, string> = {
  current: "Every organisation runs on a mix of four orientations: Engage (people and belonging), Innovate (new ideas and change), Perform (results and pace) and Govern (order and reliability). This chapter shows the mix people experience now. No mix is right or wrong in itself; what matters is whether it fits the strategy, which later chapters test.",
  gaps: "People told us the culture they experience now and the culture they believe the organisation needs. The difference between the two is the gap. A large gap shows where people expect change; a gap in opposite directions on two orientations shows where the change will pull against itself and needs careful handling.",
  voice: "Employee voice is how people feel about working here, not what the culture is. For each of eight parts of working life, people said how likely they are to recommend it, from critics to advocates. A negative score means more critics than advocates and marks a place to listen first.",
  readiness: "Readiness asks whether the organisation can carry the change the gap calls for. It looks at digital readiness, whether people feel safe to speak up, how well the organisation adapts, and whether leaders are aligned. Together they set the Transformation Probability Score, which decides how many priorities can run at once.",
  risk: "Cultural debt builds when gaps stay open: energy goes into working around the culture instead of through it. This chapter compares the headline measures with their targets and shows what drives the risk, so the organisation knows which debt to pay down first.",
  checks: "The four checks test the culture against what the organisation needs from it: the strategy it declared, the behaviour its leaders show, the systems that reward people, and the business model it runs. Each check ends with what the result means here and a proposed intervention.",
  leaders: "Leaders shape culture more than any message. In the Leadership 360 the people around each leader rated how the leader behaves. This chapter shows the overall picture across leaders only; each leader receives a private result for their own development.",
  roadmap: "The plan turns the results into a small number of priorities, each with actions, an owner and a way to measure progress. Priorities are ordered by how much the culture needs them and how much change the organisation can carry at once.",
  kpis: "What gets measured gets managed. This chapter lists the measures the organisation will track, how often, and who reviews them, so progress on culture is reported with the same discipline as financial results.",
};
