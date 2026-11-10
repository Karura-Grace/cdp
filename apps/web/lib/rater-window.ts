// Rater window (owner decision, 18 October 2026): one open date and one close date per leader for the 360 raters of an assessment. Pure
// TypeScript with no imports. The window sits inside the assessment window (both ends inclusive, whole days).
const isRealDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

export interface RaterWindow { opens_on: string; closes_on: string }

/** Problems with a rater window, empty when it is fine. `asmOpen` and `asmClose` are the assessment window, `YYYY-MM-DD` or longer. */
export function raterWindowErrors(w: { opens_on: unknown; closes_on: unknown }, asmOpen: string | null | undefined, asmClose: string | null | undefined): string[] {
  if (!isRealDay(w.opens_on) || !isRealDay(w.closes_on)) return ["Give real dates for the rater window (YYYY-MM-DD)."];
  const out: string[] = [];
  if (w.closes_on < w.opens_on) out.push("The rater window must close on or after the day it opens.");
  if (!asmOpen || !asmClose) out.push("Set the assessment window before setting rater windows.");
  else {
    if (w.opens_on < asmOpen.slice(0, 10)) out.push(`The rater window cannot open before the assessment window (${asmOpen.slice(0, 10)}).`);
    if (w.closes_on > asmClose.slice(0, 10)) out.push(`The rater window cannot close after the assessment window (${asmClose.slice(0, 10)}).`);
  }
  return out;
}

/** What a link issue does for one leader's raters today: issue now (with the close date), wait for the open date, or skip because it closed. */
export function raterWindowAction(w: RaterWindow | undefined, today: string): { issue: boolean; expires_at: string | null; why?: string } {
  if (!w) return { issue: true, expires_at: null };
  if (today < w.opens_on) return { issue: false, expires_at: null, why: `the rater window opens on ${w.opens_on}` };
  if (today > w.closes_on) return { issue: false, expires_at: null, why: `the rater window closed on ${w.closes_on}` };
  return { issue: true, expires_at: `${w.closes_on}T23:59:59Z` };
}
