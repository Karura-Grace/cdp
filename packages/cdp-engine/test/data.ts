import { profileOf } from "../src/index.js";
import type { Dimension, Profile } from "../src/index.js";

export const DIM_NOW: Record<Dimension, number[]> = { D1: [20, 14, 30, 36], D2: [18, 16, 38, 28], D3: [22, 12, 30, 36], D4: [26, 12, 34, 28], D5: [22, 16, 34, 28], D6: [24, 14, 38, 24] };
export const fixtureDims = () => Object.fromEntries(Object.entries(DIM_NOW).map(([d, v]) => [d, profileOf(v)])) as Record<Dimension, Profile>;

/** 60 integer ratings whose section means equal the given averages (10 items A–D, 5 items E–H). */
export function ratingsFor(avgs: Record<string, number>): number[] {
  const out: number[] = [];
  ["A", "B", "C", "D", "E", "F", "G", "H"].forEach((s, i) => {
    const n = i < 4 ? 10 : 5, total = Math.round(avgs[s] * n), v = Array(n).fill(Math.floor(total / n));
    const rem = total - v.reduce((a: number, b: number) => a + b, 0);
    for (let k = 0; k < rem; k++) v[k]++;
    out.push(...v);
  });
  return out;
}
export const illustrativeRatings = () => ({
  self: ratingsFor({ A: 3.4, B: 3.1, C: 4.4, D: 3.8, E: 4.6, F: 4.0, G: 3.6, H: 3.5 }),
  other: ratingsFor({ A: 2.6, B: 3.0, C: 4.2, D: 3.5, E: 4.3, F: 2.8, G: 3.4, H: 3.0 }),
});
