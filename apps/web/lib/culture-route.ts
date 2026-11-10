import * as E from "@pac/cdp-engine";

type Prof = Record<"ENGAGE" | "INNOVATE" | "PERFORM" | "GOVERN", string | number>;
const top = (p: Prof) => (Object.keys(p) as (keyof Prof)[]).reduce((a, b) => (parseFloat(String(p[b])) > parseFloat(String(p[a])) ? b : a));

/** The stepping stone for the Culture Map (server side, because the rule lives in the engine): when the leading orientation today and the leading
 *  one preferred sit on opposite corners, the neighbour the shift runs through (spec 6.5.1). null for any other move, which is drawn without one. */
export function mapStone(now: Prof, pref: Prof): E.Orientation | null {
  const origin = top(now), target = top(pref);
  if (E.DIAGONAL[origin] !== target) return null;
  return E.steppingStone(origin, target, Object.fromEntries(E.ORIENTATIONS.map((o) => [o, E.D(String(now[o]))])) as E.Profile);
}
