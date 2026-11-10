/** ISO calendar dates (UTC, no clock reads). The engine never calls Date.now(); callers pass `today`. */
export type ISODate = string;
const MS = 86_400_000;
export const toDay = (d: ISODate) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / MS;
export const fromDay = (n: number): ISODate => new Date(n * MS).toISOString().slice(0, 10);
export const addDays = (d: ISODate, days: number): ISODate => fromDay(toDay(d) + days);
export const daysBetween = (a: ISODate, b: ISODate) => toDay(b) - toDay(a);

/** Working days from open to close inclusive, excluding weekends and the tenant's public holidays (§0.1). */
export function workingDays(open: ISODate, close: ISODate, holidays: ISODate[] = []): number {
  const h = new Set(holidays);
  let n = 0;
  for (let d = toDay(open); d <= toDay(close); d++) {
    const wd = new Date(d * MS).getUTCDay();
    if (wd !== 0 && wd !== 6 && !h.has(fromDay(d))) n++;
  }
  return n;
}

/** The date `n` working days after `from` (reminder scheduling: working day 3, 6 …). */
export function addWorkingDays(from: ISODate, n: number, holidays: ISODate[] = []): ISODate {
  const h = new Set(holidays);
  let d = toDay(from), k = 0;
  while (k < n) { d++; const wd = new Date(d * MS).getUTCDay(); if (wd !== 0 && wd !== 6 && !h.has(fromDay(d))) k++; }
  return fromDay(d);
}
