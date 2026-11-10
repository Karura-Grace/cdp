import type { QA } from "./faq";

// Insights articles for the public site. Prose rule: no dashes and no hyphenated words. Inline links are written [text](/path).
// Byline is the team (owner Q-SEO-20). Dates are ISO; the page shows them as "6 November 2026".
export type Block = { h: string } | { p: string } | { ul: string[] };
export interface Article { slug: string; title: string; description: string; published: string; updated: string; dek: string; kind: string; blocks: Block[]; faq: QA[] }

export const ARTICLES: Article[] = [
  {
    slug: "what-is-the-culture-dynamics-profile",
    title: "What is the Culture Dynamics Profile (CDP)? A plain English guide",
    description: "A plain English guide to the Culture Dynamics Profile (CDP) from Priority Activator Consulting: what it measures, how it works and what an organisation receives.",
    published: "2026-11-06", updated: "2026-11-06", kind: "Article",
    dek: "What the Culture Dynamics Profile measures, how an engagement runs and what you walk away with.",
    blocks: [
      { p: "The Culture Dynamics Profile (CDP) is an organisational culture assessment from Priority Activator Consulting (PAC). It measures whether a culture can deliver the organisation's strategy, shows where the culture will resist, names what to change first with an owner and a deadline, and then measures whether the culture moved. This guide explains each part in plain English. For the quick facts, see [CDP at a glance](/what-is-cdp)." },
      { h: "What problem does the Culture Dynamics Profile solve?" },
      { p: "Most organisations can say what their strategy is. Far fewer can say whether the way people actually work will carry that strategy. A culture can be warm, hard working and loyal and still be the wrong shape for a strategy that needs speed, experiment or discipline. CDP is built to answer one question: can our culture deliver our strategy, and if not, what should change first?" },
      { h: "How does a CDP engagement work?" },
      { p: "PAC runs every engagement on the [4D Framework](/methodology#4d): Diagnose, Design, Develop and Deliver." },
      { ul: [
        "Diagnose: set up the engagement with your executives, then measure the culture you have now and the culture your people believe you need.",
        "Design: test that culture against your strategy, agree the verdict and choose up to four priorities.",
        "Develop: turn each priority into owned, dated actions and leader development plans.",
        "Deliver: track every action, pulse at 90 and 180 days, and reassess at twelve months.",
      ] },
      { p: "The [Culture Dynamics Profile platform](/platform) holds the whole cycle, so what was measured, decided and done stays connected." },
      { h: "What does CDP measure?" },
      { p: "CDP describes every culture as a mix of four orientations: Engage (trust and alignment within teams), Innovate (agile thinking and creative risk taking), Perform (executing at scale with measurable impact) and Govern (stability and ethical standards). Every organisation carries all four. What differs is the mix." },
      { p: "It reads that mix through nine dimensions. Six describe the culture: Cultural DNA, Leadership Blueprint, People Architecture, Cohesion Drivers, Strategic Compass and Victory Conditions. Three describe readiness for change: Digital Readiness, Psychological Safety and Adaptive Capacity. Each person answers from two perspectives, Now and Preferred, and the distance between them is where the work is. The [methodology page](/methodology) walks through all of it." },
      { h: "Are the answers anonymous?" },
      { p: "Yes. A respondent's name is separated from their answers at submission and cannot be put back. Results are shown only for groups of five or more, and no individual answers are visible to managers, HR or PAC. That rule is what lets people be candid." },
      { h: "What does an organisation receive?" },
      { p: "A set of reports shaped to each audience: a Board and Executive Summary, an Organisational Culture Report, Sub culture Reports, Leader Reports, a Leadership Team Report and an Action Plan Report. A certified Culture Practitioner reviews every report before release. The strategic verdict gives four checks that score the culture against your strategy, your KPIs, your change agenda and your business model, and every miss gets a named, time bound intervention." },
      { h: "Who is CDP for, and where do I start?" },
      { p: "CDP is built for mid to large organisations in any sector, where there are enough people to report on groups of five or more. The first step is a short conversation: [book a 15 minute Culture Dynamics Profile briefing](/contact) to see how it would fit your organisation." },
    ],
    faq: [
      { q: "Is the Culture Dynamics Profile the same as other things called CDP?", a: "No. CDP here means the Culture Dynamics Profile from Priority Activator Consulting. It is unrelated to the contractor's design portion in construction contracts, the Conflict Dynamics Profile, the Cultural Data Profile, the environmental disclosure nonprofit CDP, or a customer data platform." },
      { q: "How long does a CDP assessment take?", a: "Each person needs about 35 to 45 minutes. The survey window stays open for at least 10 working days, with pulses at 90 and 180 days and a reassessment at twelve months." },
      { q: "Who reviews the CDP reports?", a: "A certified Culture Practitioner reviews every report before it is released to the organisation." },
    ],
  },
  {
    slug: "culture-assessment-vs-engagement-survey",
    title: "Culture assessment vs engagement survey: what is the difference?",
    description: "An engagement survey measures how people feel. A culture assessment measures how the organisation works and whether that fits its strategy. Here is how they differ and when to use each.",
    published: "2026-11-06", updated: "2026-11-06", kind: "Article",
    dek: "Two tools that sound alike and answer different questions.",
    blocks: [
      { p: "An engagement survey measures how people feel about work: how committed, supported and motivated they are. A culture assessment measures how the organisation actually works, the unwritten norms, leadership habits and priorities behind daily decisions, and, in the case of the Culture Dynamics Profile (CDP), whether that culture can deliver the strategy. They answer different questions, and an organisation can reasonably use both." },
      { h: "What does an engagement survey tell you?" },
      { p: "It gives a reading of sentiment, usually as scores by team and a trend over time. It is good at showing where morale is high or low and whether it is moving. What it does not do on its own is explain the behaviour behind the feeling, or say whether the way people work matches what the strategy needs." },
      { h: "What does a culture assessment tell you?" },
      { p: "It describes the culture itself. In CDP every culture is a mix of four orientations, Engage, Innovate, Perform and Govern, read from two perspectives: the culture people live now and the culture they believe the organisation needs. The result is a profile and a gap, not a satisfaction score." },
      { h: "How do the two differ in practice?" },
      { ul: [
        "The question: an engagement survey asks how people feel. A culture assessment asks how the organisation works and what it rewards.",
        "The result: a score and a trend, versus a profile of the current culture, the preferred culture and the gap between them.",
        "The link to strategy: an engagement survey does not test against strategy. CDP does, with four checks against your strategy, your KPIs, your change agenda and your business model.",
        "What happens next: a survey usually ends with a report and a discussion. CDP ends with up to four priorities, owned and dated actions and leader development plans.",
        "How you know it worked: CDP measures again through pulses at 90 and 180 days and a reassessment at twelve months.",
      ] },
      { h: "When should you use which?" },
      { p: "Use an engagement survey when the question is how people are doing and you want a regular reading. Use a culture assessment when the question is whether the culture will carry a strategy, a transformation or a change in leadership, or when engagement scores look healthy but results are not following. The two fit together: engagement tells you how people feel inside the culture, and the culture assessment tells you what that culture is and what it needs to become." },
      { p: "To see how the Culture Dynamics Profile handles this, read [what CDP is](/what-is-cdp), look at the [methodology](/methodology), or [talk to a PAC consultant](/contact)." },
    ],
    faq: [
      { q: "Can a culture assessment replace an engagement survey?", a: "Not exactly. They answer different questions. An engagement survey reads sentiment over time. A culture assessment describes how the organisation works and whether that fits its strategy. Many organisations use both." },
      { q: "Is a CDP survey anonymous?", a: "Yes. Names are separated from answers at submission, results are shown only for groups of five or more, and no one can see individual answers." },
    ],
  },
  {
    slug: "current-vs-preferred-culture",
    title: "Current vs preferred culture: how to read the gap",
    description: "How to read the gap between the culture you have now and the culture you need, with a simple illustrative example using the four orientations Engage, Innovate, Perform and Govern.",
    published: "2026-11-06", updated: "2026-11-06", kind: "Article",
    dek: "The distance between Now and Preferred is where the culture work is. Here is how to read it.",
    blocks: [
      { p: "The gap between current and preferred culture is the distance between how people say the organisation works today and how they believe it needs to work to succeed. In the Culture Dynamics Profile (CDP) these are called Now and Preferred. The gap shows where culture will have to change to deliver the strategy, and which orientation will resist." },
      { h: "What do Now and Preferred mean?" },
      { p: "Each person describes the organisation twice. Now is the culture they live every day. Preferred is the culture they believe the organisation needs in order to succeed. CDP describes both as a share of four orientations: Engage, Innovate, Perform and Govern. Each profile adds up to 100, so more of one orientation means less of another." },
      { h: "What does a gap look like? A simple illustration" },
      { p: "These numbers are invented to show how to read a result. They are not from a real organisation." },
      { ul: [
        "Engage: Now 20, Preferred 30. The gap is plus 10. People want more trust and alignment.",
        "Innovate: Now 15, Preferred 25. The gap is plus 10. People want more room to experiment.",
        "Perform: Now 40, Preferred 25. The gap is minus 15. People want less of the delivery pressure that dominates today.",
        "Govern: Now 25, Preferred 20. The gap is minus 5. A small easing of rules and control.",
      ] },
      { p: "Read together, this organisation is dominated by Perform and wants to shift toward Engage and Innovate. The question for leadership is whether the strategy needs that shift, and how far it can go before delivery suffers." },
      { h: "How should you read the size and direction of a gap?" },
      { ul: [
        "Size: a large gap is a stronger signal than a small one. Small gaps may be noise or may be fine.",
        "Direction: a plus means people want more of that orientation. A minus means they want less. The release side matters as much as the build side, because moving toward one orientation usually means easing another.",
        "Spread: look at who sees it differently. When executives and staff describe different organisations, that perception gap is itself a finding.",
        "Strategy: ask which gaps the strategy actually depends on. A gap that does not touch the strategy is lower priority than a smaller one that does.",
      ] },
      { h: "What mistakes do people make with the gap?" },
      { p: "The common ones are treating Preferred as a wish list instead of a signal about what the organisation needs, trying to close every gap at once, and ignoring the orientations that need to ease. CDP limits the work to up to four priorities, each with an owner and a deadline, and measures again through pulses at 90 and 180 days and a reassessment at twelve months to check that the gap closed." },
      { p: "To go further, read how CDP defines [the four orientations and nine dimensions](/methodology), see [what CDP is](/what-is-cdp), or [book a briefing](/contact) to look at your own organisation." },
    ],
    faq: [
      { q: "What is the difference between current culture and preferred culture?", a: "Current culture, called Now in CDP, is how people say the organisation works today. Preferred culture is how they believe it needs to work to succeed. The gap between them shows where culture has to change." },
      { q: "Is a bigger gap always worse?", a: "No. A large gap is a stronger signal, but what matters is whether it touches the strategy. CDP tests the gaps against strategy before choosing priorities." },
    ],
  },
];

export const bySlug = (slug: string) => ARTICLES.find((a) => a.slug === slug);
export const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
