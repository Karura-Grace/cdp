// Questions and answers for the public site. The same text is shown on the page and put into FAQPage markup (the two must match word for word).
// Prose rule: no dashes and no hyphenated words in client copy.
export type QA = { q: string; a: string };

export const HOME_FAQ: QA[] = [
  { q: "What is the Culture Dynamics Profile (CDP)?", a: "The Culture Dynamics Profile (CDP) is an organisational culture assessment from Priority Activator Consulting. It measures whether your culture can deliver your strategy, shows where it will resist, names what to change first with an owner and a deadline, and then measures whether the culture actually moved." },
  { q: "How is CDP different from a culture survey?", a: "Most culture surveys stop at a chart of what the culture is. CDP connects what people experience to what the strategy requires, decides what to change, assigns owned actions, and measures again through pulses and a reassessment at twelve months." },
  { q: "Are CDP survey responses anonymous?", a: "Yes. A respondent's name is separated from their answers at submission and cannot be put back. Results are shown only for groups of five or more, and no individual answers are visible to managers, HR or PAC." },
  { q: "What are the four culture orientations in CDP?", a: "ENGAGE (building trust and alignment within teams), INNOVATE (agile thinking and creative risk taking), PERFORM (executing at scale with measurable impact) and GOVERN (systemic stability and ethical standards). Every organisation carries all four, and CDP shows the mix you have now versus the mix you need." },
  { q: "What does CDP measure?", a: "CDP measures nine dimensions. Six describe the culture: Cultural DNA, Leadership Blueprint, People Architecture, Cohesion Drivers, Strategic Compass and Victory Conditions. Three describe readiness for change: Digital Readiness, Psychological Safety and Adaptive Capacity." },
  { q: "What is the 4D Framework?", a: "The 4D Framework is how PAC runs a CDP engagement: Diagnose, Design, Develop and Deliver. It moves from measuring the current and preferred culture, to testing it against strategy, to owned actions, to tracking with pulses at 90 and 180 days and a reassessment at twelve months." },
  { q: "What reports does an organisation receive from CDP?", a: "A Board and Executive Summary, an Organisational Culture Report, Sub culture Reports, Leader Reports, a Leadership Team Report and an Action Plan Report. A certified Culture Practitioner reviews every report before release." },
  { q: "Who is CDP for?", a: "CDP is built for mid to large organisations in any sector. It works best where there are enough people to report on groups of five or more, so that teams and departments can be compared without exposing any individual." },
  { q: "How long does a CDP assessment take?", a: "Each person needs about 35 to 45 minutes to complete the assessment. The survey window stays open for at least 10 working days. After the report, pulses follow at 90 and 180 days and a reassessment at twelve months." },
  { q: "How many people must respond?", a: "Results are only shown for groups of five or more, so every team or department you want to see needs at least five answers. A response rate under 40 percent is flagged as a data quality note in the report." },
  { q: "How do I start a CDP assessment?", a: "Book a 15 minute briefing with a Priority Activator Consulting consultant on the CDP contact page to see how the Culture Dynamics Profile can be tailored to your organisation." },
];

export const BRAND_FAQ: QA[] = [
  { q: "What does CDP stand for at Priority Activator Consulting?", a: "At Priority Activator Consulting (PAC), CDP stands for Culture Dynamics Profile, an organisational culture assessment that links culture to strategy and then measures whether the culture changed." },
  { q: "Is PAC's CDP the same as other things called CDP?", a: "No. The Culture Dynamics Profile from PAC is unrelated to the contractor's design portion in construction contracts, the Conflict Dynamics Profile, the Cultural Data Profile, the environmental disclosure nonprofit CDP, or a customer data platform. The letters are shared; the products are not." },
  { q: "Who makes the Culture Dynamics Profile?", a: "The Culture Dynamics Profile is made and delivered by Priority Activator Consulting (PAC), a Pan African consulting and advisory firm. A certified Culture Practitioner from PAC reviews every report before it reaches a client." },
  { q: "Where can I see CDP and talk to PAC?", a: "The platform and method are described on cdp.pac.africa, and the main PAC site is pac.africa. To talk to a consultant, book a 15 minute briefing on the CDP contact page." },
];
