// Tenant calendar rules (spec 1.4.4 I4, Table 15). Pure TypeScript with no imports.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isRealDay = (s: unknown): s is string => typeof s === "string" && DAY.test(s) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

/** The survey window overlaps the performance review period when the two ranges share at least one day (both ends inclusive). */
export const reviewOverlaps = (open: string, close: string, start: string | null, end: string | null) =>
  !!start && !!end && open.slice(0, 10) <= end && close.slice(0, 10) >= start;

export interface CalendarInput { holidays: { day: string; label: string }[]; review_period_start: string | null; review_period_end: string | null }

/** Errors for a calendar body, or the cleaned calendar. */
export function checkCalendar(b: Record<string, unknown>): { ok: CalendarInput } | { errors: string[] } {
  const errors: string[] = [];
  const hs = b.holidays;
  if (!Array.isArray(hs) || hs.length > 200) errors.push("holidays must be a list of at most 200 days.");
  const holidays: CalendarInput["holidays"] = [];
  for (const h of Array.isArray(hs) ? hs : []) {
    const d = (h as Record<string, unknown>)?.day, l = typeof (h as Record<string, unknown>)?.label === "string" ? ((h as Record<string, unknown>).label as string).trim() : "";
    if (!isRealDay(d)) { errors.push("Each holiday needs a real date (YYYY-MM-DD)."); continue; }
    if (!l || l.length > 120) { errors.push(`The holiday on ${d} needs a name of up to 120 characters.`); continue; }
    holidays.push({ day: d, label: l });
  }
  if (new Set(holidays.map((h) => h.day)).size !== holidays.length) errors.push("Each date can be listed once.");
  const s = b.review_period_start ?? null, e = b.review_period_end ?? null;
  const has = (v: unknown) => v !== null && v !== "";
  if (has(s) !== has(e)) errors.push("Give both ends of the review period, or neither.");
  else if (has(s) && (!isRealDay(s) || !isRealDay(e))) errors.push("The review period needs real dates (YYYY-MM-DD).");
  else if (has(s) && (e as string) < (s as string)) errors.push("The review period must end on or after the day it starts.");
  if (errors.length) return { errors };
  return { ok: { holidays: holidays.sort((a, b) => a.day.localeCompare(b.day)), review_period_start: has(s) ? (s as string) : null, review_period_end: has(e) ? (e as string) : null } };
}
