/**
 * Fixed-point decimal core (spec §0.1). Every scoring value is a Decimal; binary floats never touch a score.
 *
 * Arithmetic precision and rounding mirror Python's decimal default context (34 digits, ROUND_HALF_EVEN for
 * intermediate results) so that the TypeScript engine and the Python oracle agree to the last digit.
 * Presented, stored and banded values are always produced with q(), which rounds ROUND_HALF_UP (3.085 → 3.09).
 */
import DecimalJS from "decimal.js";

export const Decimal = DecimalJS.clone({ precision: 34, rounding: DecimalJS.ROUND_HALF_EVEN, toExpNeg: -9e15, toExpPos: 9e15 });
export type Decimal = InstanceType<typeof Decimal>;

export const ORIENTATIONS = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];
export const DIMENSIONS_CS = ["D1", "D2", "D3", "D4", "D5", "D6"] as const;
export type Dimension = (typeof DIMENSIONS_CS)[number];
export const LIKERT_DIMS = ["D7", "D8", "D9"] as const;
export type LikertDim = (typeof LIKERT_DIMS)[number];
export type Profile = Record<Orientation, Decimal>;

/** Scale (decimal places) of quantized values, so canonical JSON prints "34.00" exactly like the oracle. */
const SCALE = new WeakMap<Decimal, number>();

export function D(x: Decimal | number | string): Decimal {
  if (x instanceof Decimal) return x;
  if (typeof x === "number" && !Number.isFinite(x)) throw new Error(`Non-finite number ${x}`);
  return new Decimal(x);
}

export const dec = D;

/** Round half-up to `places` decimal places (spec ROUND_HALF_UP). */
export function q(x: Decimal | number | string, places: number): Decimal {
  const r = D(x).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  const out = r.isZero() ? new Decimal(r.abs()) : new Decimal(r);   // never a signed zero (oracle patch P7)
  SCALE.set(out, places);
  return out;
}

export function scaleOf(x: Decimal): number | undefined {
  return SCALE.get(x);
}

export function sum(values: Iterable<Decimal>): Decimal {
  let t = new Decimal(0);
  for (const v of values) t = t.plus(v);
  return t;
}

export function mean(values: Iterable<Decimal | number>): Decimal | null {
  const vs = [...values].map(D);
  if (vs.length === 0) return null;
  return sum(vs).div(vs.length);
}

export const abs = (x: Decimal) => x.abs();
export const max = (...xs: Decimal[]) => xs.reduce((a, b) => (b.gt(a) ? b : a));
export const min = (...xs: Decimal[]) => xs.reduce((a, b) => (b.lt(a) ? b : a));

export function isDecimal(x: unknown): x is Decimal {
  return x instanceof Decimal;
}

/** Decimal → plain string (no exponent). Quantized values keep their scale ("9.00"). */
export function decString(x: Decimal): string {
  const s = SCALE.get(x);
  return s === undefined ? x.toFixed() : x.toFixed(s);
}

export function profileOf(values: readonly (number | string | Decimal)[]): Profile {
  return Object.fromEntries(ORIENTATIONS.map((o, i) => [o, D(values[i])])) as Profile;
}
