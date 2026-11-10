// The Culture Map geometry (apps/web/lib/culture-map.ts). Run: node --experimental-strip-types scripts/check-culture-map.mts
import assert from "node:assert/strict";
import { MAP_LIMIT, MAP_RINGS, arrowBetween, mapPoint, plotAt, routeVia, SQUARE, stepsBetween } from "../apps/web/lib/culture-map.ts";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);
const at = (E: number, I: number, P: number, G: number) => mapPoint({ ENGAGE: E, INNOVATE: I, PERFORM: P, GOVERN: G });

// equal scores sit dead centre
let p = at(25, 25, 25, 25); near(p.x, 0); near(p.y, 0); assert.equal(p.offScale, false);

// all weight on one orientation is its own corner of the true (unzoomed) square: x and y are +-100 points, so it is off the zoomed map
for (const [scores, sx, sy] of [[[100, 0, 0, 0], -1, 1], [[0, 100, 0, 0], 1, 1], [[0, 0, 100, 0], 1, -1], [[0, 0, 0, 100], -1, -1]] as const) {
  p = at(...scores); near(p.xPts, sx * 100); near(p.yPts, sy * 100);
  near(p.x, sx * MAP_LIMIT); near(p.y, sy * MAP_LIMIT); assert.equal(p.offScale, true);   // pinned to the edge and flagged
}

// the fixture (docs and AC 4.1): Now 22/14/34/30 and Preferred 31/25/28/16
p = at(22, 14, 34, 30); near(p.xPts, -4); near(p.yPts, -28); assert.equal(p.offScale, false);
p = at(31, 25, 28, 16); near(p.xPts, 6); near(p.yPts, 12);

// mirror symmetry: swapping ENGAGE with INNOVATE and PERFORM with GOVERN mirrors left and right; swapping ENGAGE with GOVERN and INNOVATE with PERFORM mirrors up and down
let a = at(40, 20, 10, 30), b = at(20, 40, 30, 10); near(a.xPts, -b.xPts); near(a.yPts, b.yPts);
a = at(40, 20, 10, 30); b = at(30, 10, 20, 40); near(a.xPts, b.xPts); near(a.yPts, -b.yPts);

// the stronger the lead, the nearer the corner: ENGAGE leading at 30, 40, 50 with the rest even moves steadily up and left
const lead = [30, 40, 50].map((e) => at(e, (100 - e) / 3, (100 - e) / 3, (100 - e) / 3));
assert.ok(lead[0].x > lead[1].x && lead[1].x > lead[2].x && lead[0].y < lead[1].y && lead[1].y < lead[2].y);
near(lead[2].xPts, -100 / 3); near(lead[2].yPts, 100 / 3);   // ENGAGE at 50 percent: a third of the way to the corner in each direction

// strings as the frozen score stores them, and scores that do not add to exactly 100 (rounding): normalised, same point
const s = mapPoint({ ENGAGE: "22.00", INNOVATE: "14.00", PERFORM: "34.00", GOVERN: "30.00" }); near(s.xPts, -4);
const r = at(22.2, 13.9, 33.9, 30.1); const r2 = at(22, 14, 34, 30); assert.ok(Math.abs(r.xPts - r2.xPts) < 0.5 && Math.abs(r.yPts - r2.yPts) < 0.5);
near(at(2.5, 2.5, 2.5, 2.5).x, 0);   // only the shares matter

// bad input is refused, never drawn
for (const bad of [[0, 0, 0, 0], [-1, 50, 50, 1], [NaN, 25, 25, 25]]) assert.throws(() => at(...(bad as [number, number, number, number])));

// drawing: centre maps to the middle, an edge to the edge, y flipped (up is smaller)
assert.deepEqual(plotAt({ x: 0, y: 0 }, 150, 150, 100), [150, 150]);
assert.deepEqual(plotAt({ x: MAP_LIMIT, y: MAP_LIMIT }, 150, 150, 100), [250, 50]);
assert.deepEqual(plotAt({ x: -MAP_LIMIT, y: -MAP_LIMIT }, 150, 150, 100), [50, 250]);

// the arrow is shortened at both ends so its tip stays visible, and vanishes when the dots touch
const arrow = arrowBetween([0, 0], [100, 0], 10)!; near(arrow.from[0], 10); near(arrow.to[0], 90);
assert.equal(arrowBetween([0, 0], [15, 0], 10), null);
const diag = arrowBetween([0, 0], [30, 40], 5)!; near(Math.hypot(diag.from[0], diag.from[1]), 5); near(Math.hypot(30 - diag.to[0], 40 - diag.to[1]), 5);

// the move runs along the axes only, never diagonally (owner ruling 22 Oct 2026): one leg on an axis, two legs meeting at a corner across both
const axisOnly = (legs: { from: number[]; to: number[] }[]) => legs.every((l) => Math.abs(l.from[0] - l.to[0]) < 1e-9 || Math.abs(l.from[1] - l.to[1]) < 1e-9);
const one = stepsBetween([0, 0], [100, 0], 10); assert.equal(one.length, 1); near(one[0].from[0], 10); near(one[0].to[0], 90);
const two = stepsBetween([0, 0], [30, 40], 5); assert.equal(two.length, 2); assert.ok(axisOnly(two));
assert.deepEqual(two[0].to[0] > two[0].from[0], false === false ? false : true);   // the bigger move (vertical, 40) goes first: the first leg does not move sideways
near(two[0].from[0], two[0].to[0]); near(two[1].from[1], two[1].to[1]);
near(two[0].to[1], 40); near(two[1].to[0], 30 - 5);   // the corner is (0, 40); the last leg ends one inset short of the preferred dot
assert.equal(stepsBetween([0, 0], [15, 0], 10).length, 0);
for (const [a, b] of [[[10, 10], [-30, 25]], [[-5, 5], [40, -40]], [[0, 0], [0, -60]]] as [[number, number], [number, number]][]) assert.ok(axisOnly(stepsBetween(a, b, 3)));
// a diagonal move goes THROUGH the stepping stone's own square (owner ruling 24 Oct 2026): Govern (bottom left) to Innovate (top right) via Perform (bottom right), or via Engage (top left)
{
  const C = 150, govern: [number, number] = [90, 210], innovate: [number, number] = [210, 90];
  const quad = (p: [number, number]) => [Math.sign(p[0] - C), Math.sign(p[1] - C)];
  const viaP = routeVia(govern, innovate, 6, "PERFORM", C, C), viaE = routeVia(govern, innovate, 6, "ENGAGE", C, C);
  assert.deepEqual(quad(viaP.waypoint!), SQUARE.PERFORM); assert.deepEqual(quad(viaE.waypoint!), SQUARE.ENGAGE);
  assert.notDeepEqual(viaP.waypoint, viaE.waypoint);
  for (const r of [viaP, viaE]) { assert.equal(r.legs.length, 2); assert.ok(r.legs.every((l) => Math.abs(l.from[0] - l.to[0]) < 1e-9 || Math.abs(l.from[1] - l.to[1]) < 1e-9), "axis legs only"); }
  // dots close to the centre lines still pass through the stone's square
  const near = routeVia([C - 3, C + 3], [C + 3, C - 3], 2, "PERFORM", C, C);
  assert.deepEqual(quad(near.waypoint!), SQUARE.PERFORM);
  // no stone, no waypoint, and the move is still axis only
  const plain = routeVia([90, 90], [210, 120], 6, null, C, C); assert.equal(plain.waypoint, null); assert.ok(plain.legs.every((l) => Math.abs(l.from[0] - l.to[0]) < 1e-9 || Math.abs(l.from[1] - l.to[1]) < 1e-9));
}
assert.deepEqual(MAP_RINGS, [-40, -30, -20, -10, 0, 10, 20, 30, 40]);
console.log("culture map ok");
