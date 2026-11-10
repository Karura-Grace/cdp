// One definition of the four orientations and the one diagram that shows them. Every page that draws the
// four-quadrant system uses these, so position, colour, labels and arrows cannot drift apart:
//   ENGAGE top left, INNOVATE top right, PERFORM bottom right, GOVERN bottom left (Adaptive on top, Inward on the left).

export const ORIENTATIONS = [
  { name: "ENGAGE", desc: "Building radical trust and alignment within teams.", axes: "Adaptive · Inward", colour: "#2E86C1", dot: "o-e" },
  { name: "INNOVATE", desc: "Fostering agile thinking and creative risk-taking.", axes: "Adaptive · Outward", colour: "#6C3483", dot: "o-i" },
  { name: "PERFORM", desc: "Executing at scale with measurable impact.", axes: "Structured · Outward", colour: "#C0392B", dot: "o-p" },
  { name: "GOVERN", desc: "Ensuring systemic stability and ethical standards.", axes: "Structured · Inward", colour: "#58A55C", dot: "o-g" },
] as const;
