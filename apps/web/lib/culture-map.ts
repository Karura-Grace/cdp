// The Culture Map: where a culture profile sits on the four squares of the landing page. Geometry only. It feeds no score, no finding and no
// threshold; the numbers printed beside the map are always the frozen score's own strings. The web page, the PDF and the PowerPoint all use
// this one module so they cannot disagree. No imports on purpose, so scripts/check-culture-map.mts can run it directly.
//
// Squares as on the landing page: ENGAGE top left, INNOVATE top right, PERFORM bottom right, GOVERN bottom left
// (Adaptive on top, Structured at the bottom, Inward on the left, Outward on the right).
//   x (Inward to Outward) = (INNOVATE + PERFORM) - (ENGAGE + GOVERN)     in score points, positive is right
//   y (Structured to Adaptive) = (ENGAGE + INNOVATE) - (PERFORM + GOVERN)  in score points, positive is up
// That is the share weighted centroid of the four corners: equal scores sit dead centre, a leading orientation pulls the point toward its
// own corner, the stronger the lead the nearer the corner.
export const MAP_LIMIT = 40;   // the edge of the map, in points on each axis. A display scale, not a classification threshold.
export const MAP_STEP = 10;    // gridlines every 10 points

export type MapScores = { ENGAGE: number | string; INNOVATE: number | string; PERFORM: number | string; GOVERN: number | string };
export interface MapPoint {
  x: number;          // clamped to the map, for drawing
  y: number;
  xPts: number;       // the true position in points, before clamping
  yPts: number;
  offScale: boolean;  // true when the true position is beyond the edge of the map
}

const n = (v: number | string) => (typeof v === "number" ? v : parseFloat(v));

/** Position of a profile. Scores are normalised to 100 first, so rounding in stored scores cannot move the point. */
export function mapPoint(s: MapScores): MapPoint {
  const e = n(s.ENGAGE), i = n(s.INNOVATE), p = n(s.PERFORM), g = n(s.GOVERN);
  const total = e + i + p + g;
  if (![e, i, p, g].every(Number.isFinite) || [e, i, p, g].some((v) => v < 0) || !(total > 0)) throw new Error("four scores of zero or more, adding to more than zero, are needed");
  const f = 100 / total;
  const xPts = (i + p - e - g) * f, yPts = (e + i - p - g) * f;
  const clamp = (v: number) => Math.max(-MAP_LIMIT, Math.min(MAP_LIMIT, v));
  return { x: clamp(xPts), y: clamp(yPts), xPts, yPts, offScale: Math.abs(xPts) > MAP_LIMIT || Math.abs(yPts) > MAP_LIMIT };
}

/** Drawing position inside a square plot of the given half width, centre at (cx, cy); y grows downward on screen so it is flipped. */
export function plotAt(p: Pick<MapPoint, "x" | "y">, cx: number, cy: number, half: number): [number, number] {
  return [cx + (p.x / MAP_LIMIT) * half, cy - (p.y / MAP_LIMIT) * half];
}

/** The arrow from one point to another, shortened at both ends by the dot radius so the arrowhead tip is never hidden under a dot. */
export function arrowBetween(a: [number, number], b: [number, number], inset: number): { from: [number, number]; to: [number, number] } | null {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len <= inset * 2) return null;   // the two dots touch: no arrow to draw
  const ux = dx / len, uy = dy / len;
  return { from: [a[0] + ux * inset, a[1] + uy * inset], to: [b[0] - ux * inset, b[1] - uy * inset] };
}

/** Gridline positions in points, both sides of centre: -40, -30 ... 30, 40. */
export const MAP_RINGS = Array.from({ length: (MAP_LIMIT / MAP_STEP) * 2 + 1 }, (_, k) => -MAP_LIMIT + k * MAP_STEP);

export type Leg = { from: [number, number]; to: [number, number] };

/** The move from today to preferred as legs along the two axes only, never diagonally (owner ruling 22 Oct 2026, Erick Ngala comment 61: culture
 *  moves between adjacent orientations). The bigger move goes first. Each leg is shortened by `inset` at a dot, so no tip hides under a dot. A move
 *  already along one axis is one leg; a move across both axes is two, meeting at the corner between them (the stepping stone). */
export function stepsBetween(a: [number, number], b: [number, number], inset: number): Leg[] {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
  const corner: [number, number] = horizontalFirst ? [b[0], a[1]] : [a[0], b[1]];
  const legs: Leg[] = [];
  const leg = (p: [number, number], q: [number, number], insetStart: number, insetEnd: number) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len <= insetStart + insetEnd) return;
    const ux = (q[0] - p[0]) / len, uy = (q[1] - p[1]) / len;
    legs.push({ from: [p[0] + ux * insetStart, p[1] + uy * insetStart], to: [q[0] - ux * insetEnd, q[1] - uy * insetEnd] });
  };
  const twoLegs = Math.abs(dx) > 1e-9 && Math.abs(dy) > 1e-9;
  if (twoLegs) { leg(a, corner, inset, 0); leg(corner, b, 0, inset); } else leg(a, b, inset, inset);
  return legs;
}

// Which square each orientation owns, in drawing terms (x: -1 left, +1 right; y: -1 top, +1 bottom).
export const SQUARE: Record<string, [number, number]> = { ENGAGE: [-1, -1], INNOVATE: [1, -1], PERFORM: [1, 1], GOVERN: [-1, 1] };

/** The route from today to preferred, drawn along the axes only. For a diagonal shift the engine names a stepping stone (a neighbouring orientation,
 *  spec 6.5.1) and the route passes through that orientation's own square: Today, the stepping stone, Preferred (owner ruling 24 Oct 2026). The
 *  waypoint is the corner of the two axis legs that lies in the stone's square; if no corner does, it is pushed into that square (at least 14 units
 *  from the centre lines) so the route never skips it. With no stone (an adjacent move) the corner follows the larger axis and nothing is labelled.
 *  Coordinates are drawing coordinates; `inset` shortens the first and last leg so arrowheads and dots do not overlap. */
export function routeVia(a: [number, number], b: [number, number], inset: number, stone: string | null, cx: number, cy: number): { legs: Leg[]; waypoint: [number, number] | null } {
  const c1: [number, number] = [b[0], a[1]], c2: [number, number] = [a[0], b[1]];
  const sq = stone ? SQUARE[stone] : undefined;
  const inSq = (c: [number, number]) => !!sq && Math.sign(c[0] - cx) === sq[0] && Math.sign(c[1] - cy) === sq[1];
  let corner: [number, number];
  if (sq) {
    corner = inSq(c1) ? c1 : inSq(c2) ? c2 : (() => {
      const near = Math.hypot(c1[0] - (cx + sq[0] * 60), c1[1] - (cy + sq[1] * 60)) <= Math.hypot(c2[0] - (cx + sq[0] * 60), c2[1] - (cy + sq[1] * 60)) ? c1 : c2;
      return [cx + sq[0] * Math.max(Math.abs(near[0] - cx), 14), cy + sq[1] * Math.max(Math.abs(near[1] - cy), 14)] as [number, number];
    })();
  } else {
    corner = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? c1 : c2;
  }
  const first: [number, number] = corner;
  // two axis legs: a to corner, corner to b. A forced waypoint can leave the legs slightly off axis, so each leg is split into its own horizontal or vertical move.
  const legs: Leg[] = [];
  const leg = (p: [number, number], q: [number, number], i0: number, i1: number) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len <= i0 + i1) return;
    const ux = (q[0] - p[0]) / len, uy = (q[1] - p[1]) / len;
    legs.push({ from: [p[0] + ux * i0, p[1] + uy * i0], to: [q[0] - ux * i1, q[1] - uy * i1] });
  };
  const via = (p: [number, number], q: [number, number]) => ((Math.abs(p[0] - q[0]) < 1e-9 || Math.abs(p[1] - q[1]) < 1e-9) ? [[p, q]] : [[p, [q[0], p[1]] as [number, number]], [[q[0], p[1]] as [number, number], q]]) as [[number, number], [number, number]][];
  const parts = [...via(a, first), ...via(first, b)];
  parts.forEach(([p, q], i) => leg(p, q, i === 0 ? inset : 0, i === parts.length - 1 ? inset : 0));
  return { legs, waypoint: stone ? first : null };
}
