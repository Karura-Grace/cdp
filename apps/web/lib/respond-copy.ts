// Text for the respondent steps, taken from the live site's instrument-data.json by a one-off script (not retyped).
// The live data splits each dimension title across `name` and the start of `sub` ("Cultural" + "DNA What ..."), which
// the live screen shows as "D1 - Cultural"; the titles are rejoined here.
export const DIMS = [
  {
    "name": "Cultural DNA",
    "sub": "What fundamentally defines who we are as an organisation"
  },
  {
    "name": "Leadership Blueprint",
    "sub": "How leaders lead, what they model, and how they are recognised"
  },
  {
    "name": "People Architecture",
    "sub": "How employees are managed, developed, and enabled to contribute"
  },
  {
    "name": "Cohesion Drivers",
    "sub": "What unites this organisation and holds it together across time and change"
  },
  {
    "name": "Strategic Compass",
    "sub": "What guides our strategic priorities and shapes how resources are allocated"
  },
  {
    "name": "Victory Conditions",
    "sub": "How we define, measure, and celebrate what it means to succeed"
  }
] as const;
export const WHYS = {
  "d7": "Digital transformation is among the most consequential challenges facing organisations today, and the pace of this transformation is accelerating across all sectors in Africa and globally. Yet most culture assessment instruments were designed before the digital era and fail to measure how organisational culture enables or actively resists technology adoption. This dimension fills that gap directly, generating data that informs digital transformation strategies with genuine cultural precision.",
  "d8": "Research consistently demonstrates that psychological safety is the single strongest predictor of high-performing teams. In many organisational contexts, hierarchical norms, power distance, and fear of authority create invisible barriers to candour - barriers that dramatically suppress the intelligence and creativity of the workforce. This dimension measures the extent to which people feel genuinely safe to be candid, take interpersonal risks, and challenge the status quo without realistic fear of punishment, marginalisation, or humiliation. These are conditions that directly determine whether the organisation's intelligence is accessible or suppressed.",
  "d9": "Culture change fails in organisations not primarily because the strategy is wrong - it fails because the organisation lacks the structural and cultural conditions to sustain transformation over a 12-24 month period. Adaptive Capacity measures the organisation's actual ability to initiate, maintain momentum through, and successfully embed meaningful change. This is not a measure of leadership intent but of demonstrated systemic capacity. High scores here indicate that culture transformation programmes will succeed with standard investment. Low scores are the most important early warning signal in the entire CDP - they indicate that transformation infrastructure must be built before transformation content is deployed."
} as const;
export const QUAL_TITLES = [
  "Q1 - Culture Strengths",
  "Q2 - Culture Challenges",
  "Q3 - The One Change"
] as const;
