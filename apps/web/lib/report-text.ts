// The report sections the PAC consultant writes or edits before release. Client safe: no engine import.
export const TEXT_SECTIONS = [
  { key: "what_this_means", label: "What this means", hint: "Plain language reading of the results for this organisation." },
  { key: "what_to_do_next", label: "What to do next", hint: "The consultant's recommended next steps." },
  { key: "quick_wins", label: "First 14 days", hint: "One action per line. Drafted from the findings; edit to fit the client." },
  { key: "facilitation", label: "Facilitation guide", hint: "The debrief sessions. PAC template; edit to fit the client." },
] as const;

