/** The paid parts of the platform (owner ruling 22 Oct 2026, Erick Ngala comment 40). No server imports, so client screens can use it. */
export const SERVICES = ["LEADERSHIP_360", "CLIENT_LOGO", "PULSE", "GROUP_RESULTS"] as const;
export type Service = (typeof SERVICES)[number];
export const SERVICE_LABEL: Record<Service, { name: string; what: string }> = {
  LEADERSHIP_360: { name: "Leadership 360", what: "360 tab, rater choice, 360 links and leader reports" },
  CLIENT_LOGO: { name: "Client logo on reports", what: "logo upload and the logo on the cover of reports" },
  PULSE: { name: "Pulse surveys", what: "pulse screens, links and results" },
  GROUP_RESULTS: { name: "Results by group", what: "the Results by group tab, its export and the sub culture report" },
};

