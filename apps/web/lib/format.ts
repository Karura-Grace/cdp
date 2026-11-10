import { D, q } from "@pac/cdp-engine";

export const ORIENTATIONS = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];
export const ORIENT_NAME: Record<Orientation, string> = { ENGAGE: "Engage", INNOVATE: "Innovate", PERFORM: "Perform", GOVERN: "Govern" };
export const ORIENT_COLOR: Record<Orientation, string> = { ENGAGE: "#0e8a72", INNOVATE: "#d97a00", PERFORM: "#b3261e", GOVERN: "#1f4e8c" };

/** "ENABLEMENT_REQUIRED" -> "Enablement required" */
export const human = (s: string) => { const t = s.replace(/_/g, " ").toLowerCase(); return t[0].toUpperCase() + t.slice(1); };

// Display rounding goes through the engine's Decimal helper, never a JS number (CLAUDE.md §1).
export const dp = (x: string | number, places: number) => q(D(x), places).toFixed(places);
export const signed = (x: string | number, places = 0) => { const v = dp(x, places); return D(x).gt(0) && !v.startsWith("-") ? `+${v}` : v; };
