/**
 * Plain wording for findings (spec 4.5.1 to 4.5.3, Tables 63 and 64). Wording only, no calculation, so the oracle has no copy.
 * Held here as reference data so a wording change is a versioned release, not a screen edit.
 */
export type OverrideCode = "OVERRIDE_1_BELOW_THRESHOLD" | "OVERRIDE_2_LOWEST" | "OVERRIDE_3_NOT_DOMINANT";

const names = (o: string[]) => o.map((x) => x.charAt(0) + x.slice(1).toLowerCase());
const list = (o: string[]) => (o.length < 2 ? o.join("") : `${o.slice(0, -1).join(", ")} and ${o[o.length - 1]}`);

/** The decisive override in plain words for a C1 or C4 tile, for example "Engage is the lowest orientation Now, so this is capped at Miss". */
export function overridePlain(code: string, orientations: string[]): string {
  const n = list(names(orientations)), many = orientations.length > 1;
  switch (code as OverrideCode) {
    case "OVERRIDE_1_BELOW_THRESHOLD": return `${n} ${many ? "have" : "has"} not passed the required level, so this is capped at Partial hit.`;
    case "OVERRIDE_2_LOWEST": return `${n} ${many ? "include the lowest orientation" : "is the lowest orientation"} Now, so this is capped at Miss.`;
    case "OVERRIDE_3_NOT_DOMINANT": return `${n} ${many ? "are" : "is"} not the dominant orientation Now, so this is capped at Partial hit.`;
    default: return "";
  }
}

/** What a C2 (behaviour gap) recommendation must contain, by intensity (Table 63). */
export const C2_RESPONSE: Record<"MARGINAL" | "SUBSTANTIVE" | "ENTRENCHED", string> = {
  MARGINAL: "Coaching and explicit recognition of the target behaviour. State how close the profile is, so the client is not over-sold a programme.",
  SUBSTANTIVE: "A structured leadership workstream: a development programme, a CDP anchored 360 baseline and re-measure, and a culture stewardship objective in every people manager's review.",
  ENTRENCHED: "The workstream, plus system levers (promotion criteria, reward mix, performance management redesign) and a leadership KPI carried at the executive committee.",
};

/** What a C3 (stop and start) response must contain, by verdict (Table 64), and the identity risk modifier. */
export const C3_RESPONSE: Record<"HIT" | "PARTIAL_HIT" | "SYSTEMIC_MISS", string> = {
  HIT: "Reinforce publicly, and name the existing ritual that already signals the desired behaviour.",
  PARTIAL_HIT: "Redesign the contradicting mechanism within 90 days: the recognition ritual if the contradiction is in D6, the bonding narrative if it is in D4.",
  SYSTEMIC_MISS: "Redesign the HR systems within 90 days (performance management, promotion criteria, incentives, onboarding), and change at least one visible ritual within 30 days.",
};
export const C3_IDENTITY_RISK = "Frame the change as preserving the bonding narrative while redirecting its energy, using the pathway's bridging narrative.";
