// The culture graphics shared by the web report, the PDF and the PowerPoint (owner picks Q-RD4 and Q-RD15 to Q-RD22, 26 Oct 2026): a row of three small framed
// maps (Now, Preferred, the move) with rings at 10, 20, 30 and 40 points, the orientation scores plotted as labelled points on the rings, and a separate concentric
// chart of four slices. Each graphic is a list of plain shapes, so one drawing serves three renderers: toSvg() here, and drawPdf() in export/pdf-graphics.ts.
// Geometry only: every number comes from the frozen score through the export model. Wording is Now and Preferred. No imports, so a script can run it directly.

export type O = "ENGAGE" | "INNOVATE" | "PERFORM" | "GOVERN";
export type Prof = Record<O, number>;
export type Shape =
  | { t: "path"; d: string; fill?: string; fo?: number; stroke?: string; sw?: number; dash?: [number, number]; cap?: "round" | "butt"; arrow?: string }
  | { t: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill?: string; fo?: number; stroke?: string; sw?: number; dash?: [number, number] }
  | { t: "circle"; x: number; y: number; r: number; fill?: string; fo?: number; stroke?: string; sw?: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; dash?: [number, number]; cap?: "round" | "butt" }
  | { t: "text"; x: number; y: number; s: string; size: number; weight?: 400 | 600 | 800; fill: string; anchor?: "start" | "middle" | "end"; ls?: number; rot?: number };
export type Drawing = { w: number; h: number; shapes: Shape[] };

export const ORIENTS: O[] = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"];
export const NAME: Record<O, string> = { ENGAGE: "Engage", INNOVATE: "Innovate", PERFORM: "Perform", GOVERN: "Govern" };
export const HUE: Record<O, string> = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
export const C = { orange: "#EB5733", ink: "#131313", grey: "#727070", line: "#E6DFD4", ring: "#D9D1C4", cream: "#FAF7F2", arrow: "#CFC7BA" };
/** Corner of each square (x, y direction from the centre; y grows downwards). */
export const SQ: Record<O, [number, number]> = { ENGAGE: [-1, -1], INNOVATE: [1, -1], PERFORM: [1, 1], GOVERN: [-1, 1] };
export const RINGS = [10, 20, 30, 40];
/** A full square is 50 points: the four scores add to 100 and no single orientation fills more than half. */
export const FULL = 50;

const sweep = (sx: number, sy: number) => (sx * sy > 0 ? 1 : 0);
const f = (n: number) => Math.round(n * 100) / 100;
const quarter = (c: number, sx: number, sy: number, R: number) => `M${f(c)},${f(c)} L${f(c + sx * R)},${f(c)} A${f(R)},${f(R)} 0 0 ${sweep(sx, sy)} ${f(c)},${f(c + sy * R)} Z`;
const arc = (c: number, sx: number, sy: number, r: number) => `M${f(c + sx * r)},${f(c)} A${f(r)},${f(r)} 0 0 ${sweep(sx, sy)} ${f(c)},${f(c + sy * r)}`;
const R = (v: number, H: number) => (Math.min(v, FULL) / FULL) * (H - 3);
/** Where the organisation sits on the two axes, in points from the centre: x outward, y structured (down). The same sums the engine's culture map uses. */
export const axisPoint = (p: Prof) => ({ x: (p.INNOVATE + p.PERFORM - p.ENGAGE - p.GOVERN) / 2, y: (p.PERFORM + p.GOVERN - p.ENGAGE - p.INNOVATE) / 2 });

function tag(x: number, y: number, s: string, fill: string, ink: string, size = 9): Shape[] {
  const w = s.length * size * 0.62 + 10;
  return [{ t: "rect", x: x - w / 2, y: y - size * 0.95, w, h: size * 1.9, rx: size, fill }, { t: "text", x, y: y + size * 0.36, s, size, weight: 800, fill: ink, anchor: "middle" }];
}

/** The four rounded squares with their names, the rings as quarter arcs with their numbers, and the side arrows and axis words (the Option 2 frame). */
function frame(c: number, H: number, withRings = true): Shape[] {
  const out: Shape[] = [];
  for (const o of ORIENTS) {
    const [sx, sy] = SQ[o], x0 = sx < 0 ? c - H : c + 2, y0 = sy < 0 ? c - H : c + 2, w = H - 2;
    out.push({ t: "rect", x: x0, y: y0, w, h: w, rx: 12, fill: "#ffffff", stroke: C.line, sw: 1.2 });
  }
  if (withRings) {
    for (const k of RINGS) for (const o of ORIENTS) { const [sx, sy] = SQ[o]; out.push({ t: "path", d: arc(c, sx, sy, R(k, H)), stroke: C.ring, sw: 0.8, dash: [2, 3] }); }
    for (const k of RINGS) out.push({ t: "text", x: c + 3, y: c - R(k, H) + 8, s: String(k), size: 6.5, weight: 600, fill: C.grey, anchor: "start" });
  }
  for (const o of ORIENTS) {
    const [sx, sy] = SQ[o], x0 = sx < 0 ? c - H : c + 2, y0 = sy < 0 ? c - H : c + 2, w = H - 2, nm = NAME[o].toUpperCase(), tw = nm.length * 7.2 + 14;
    const lx = sx < 0 ? x0 + 12 : x0 + w - 12 - tw, ly = sy < 0 ? y0 + 12 : y0 + w - 20;
    out.push({ t: "rect", x: lx, y: ly + 1, w: 7, h: 7, fill: HUE[o] }, { t: "text", x: lx + 12, y: ly + 8, s: nm, size: 8.5, weight: 800, fill: C.ink, anchor: "start", ls: 1.1 });
  }
  const g = 22, a = (d: string): Shape => ({ t: "path", d, stroke: C.arrow, sw: 1.1, arrow: C.arrow });
  out.push(
    a(`M${f(c - H * 0.5)},${f(c - H - 8)} V${f(c - H - g + 4)} H${f(c + H * 0.5)} V${f(c - H - 8)}`), a(`M${f(c - H * 0.5)},${f(c + H + 8)} V${f(c + H + g - 4)} H${f(c + H * 0.5)} V${f(c + H + 8)}`),
    a(`M${f(c - H - 8)},${f(c - H * 0.5)} H${f(c - H - g + 4)} V${f(c + H * 0.5)} H${f(c - H - 8)}`), a(`M${f(c + H + 8)},${f(c - H * 0.5)} H${f(c + H + g - 4)} V${f(c + H * 0.5)} H${f(c + H + 8)}`),
    { t: "text", x: c, y: c - H - g + 8, s: "ADAPTIVE", size: 7.5, weight: 800, fill: C.grey, anchor: "middle", ls: 1.8 },
    { t: "text", x: c, y: c + H + g - 1, s: "STRUCTURED", size: 7.5, weight: 800, fill: C.grey, anchor: "middle", ls: 1.8 },
    { t: "text", x: c - H - g + 5, y: c, s: "INWARD", size: 7.5, weight: 800, fill: C.grey, anchor: "middle", ls: 1.8, rot: -90 },
    { t: "text", x: c + H + g - 5, y: c, s: "OUTWARD", size: 7.5, weight: 800, fill: C.grey, anchor: "middle", ls: 1.8, rot: 90 },
  );
  return out;
}

/** The disc of one orientation for one profile (kind): solid Now, dashed Preferred, or the move (Now with the gap shaded and the dashed Preferred outline). */
function discs(c: number, H: number, kind: "now" | "pref" | "move", now: Prof, pref: Prof): Shape[] {
  const out: Shape[] = [];
  for (const o of ORIENTS) {
    const [sx, sy] = SQ[o], rn = R(now[o], H), rp = R(pref[o], H), col = HUE[o];
    const solid: Shape[] = [{ t: "path", d: quarter(c, sx, sy, rn), fill: col, fo: 0.3, stroke: col, sw: 1.4 }];
    const dash: Shape = { t: "path", d: quarter(c, sx, sy, rp), stroke: C.orange, sw: 1.9, dash: [5, 3.5] };
    if (kind === "now") out.push(...solid);
    else if (kind === "pref") out.push(dash);
    else {
      out.push(...solid);
      const lo = Math.min(rn, rp), hi = Math.max(rn, rp), sw = sweep(sx, sy);
      if (hi - lo > 0.5) out.push({ t: "path", d: `M${f(c + sx * lo)},${f(c)} L${f(c + sx * hi)},${f(c)} A${f(hi)},${f(hi)} 0 0 ${sw} ${f(c)},${f(c + sy * hi)} L${f(c)},${f(c + sy * lo)} A${f(lo)},${f(lo)} 0 0 ${1 - sw} ${f(c + sx * lo)},${f(c)} Z`, fill: rp > rn ? C.orange : C.grey, fo: rp > rn ? 0.34 : 0.28 });
      out.push(dash);
    }
  }
  return out;
}

/** The orientation scores as labelled points on the rings: each sits on its square's diagonal at the radius of its score. */
function scorePoints(c: number, H: number, which: ("now" | "pref")[], now: Prof, pref: Prof): Shape[] {
  const out: Shape[] = [], k = Math.SQRT1_2;
  const at = (o: O, v: number): [number, number] => { const [sx, sy] = SQ[o], r = R(v, H); return [c + sx * r * k, c + sy * r * k]; };
  for (const o of ORIENTS) {
    const [nx, ny] = at(o, now[o]), [px, py] = at(o, pref[o]);
    if (which.length === 2) out.push({ t: "line", x1: nx, y1: ny, x2: px, y2: py, stroke: C.orange, sw: 1.4, dash: [2, 2] });
    if (which.includes("now")) out.push({ t: "circle", x: nx, y: ny, r: 3.4, fill: HUE[o], stroke: "#ffffff", sw: 1.2 });
    if (which.includes("pref")) out.push({ t: "circle", x: px, y: py, r: 3.4, fill: "#ffffff", stroke: C.orange, sw: 1.8 });
  }
  // labels after the dots so a label is never under a dot; Now below-outside, Preferred above-inside of its dot
  for (const o of ORIENTS) {
    const [sx, sy] = SQ[o], [nx, ny] = at(o, now[o]), [px, py] = at(o, pref[o]);
    if (which.includes("now")) out.push(...tag(nx + sx * 11, ny + sy * 8, String(Math.round(now[o])), "#ffffff", C.ink, 8.5));
    if (which.includes("pref")) { const near = which.includes("now") && Math.hypot(px - nx, py - ny) < 26; out.push(...tag(px + sx * (11 + (near ? 17 : 0)), py + sy * (8 + (near ? 11 : 0)), String(Math.round(pref[o])), C.orange, "#ffffff", 8.5)); }
  }
  return out;
}

/** The route from Now to Preferred along the axes only, through the stepping stone, with its chip, plus the two map points. */
function route(c: number, H: number, now: Prof, pref: Prof, stone: O | null, pills: boolean): Shape[] {
  const P = (p: Prof): [number, number] => { const q = axisPoint(p); return [c + (q.x / FULL) * H, c + (q.y / FULL) * H]; };
  const a = P(now), b = P(pref), out: Shape[] = [];
  const sh = (p: [number, number], q: [number, number], i0: number, i1: number): [[number, number], [number, number]] => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, ux = (q[0] - p[0]) / d, uy = (q[1] - p[1]) / d; return [[p[0] + ux * i0, p[1] + uy * i0], [q[0] - ux * i1, q[1] - uy * i1]]; };
  let wp: [number, number] | null = null;
  if (stone) {
    const [sx, sy] = SQ[stone], c1: [number, number] = [b[0], a[1]], c2: [number, number] = [a[0], b[1]], inSq = (k: [number, number]) => Math.sign(k[0] - c) === sx && Math.sign(k[1] - c) === sy;
    wp = inSq(c1) ? c1 : inSq(c2) ? c2 : [c + sx * H * 0.2, c + sy * H * 0.2];
  }
  const seg = (p: [number, number], q: [number, number], arrow: boolean): Shape => ({ t: "path", d: `M${f(p[0])},${f(p[1])} L${f(q[0])},${f(q[1])}`, stroke: C.orange, sw: 2.6, cap: "round", arrow: arrow ? C.orange : undefined });
  if (wp) { const r1 = sh(a, wp, 8, 0), r2 = sh(wp, b, 0, 10); out.push(seg(r1[0], r1[1], false), seg(r2[0], r2[1], true)); }
  else { const r = sh(a, b, 8, 10); out.push(seg(r[0], r[1], true)); }
  if (wp && stone) { out.push({ t: "circle", x: wp[0], y: wp[1], r: 4.6, fill: "#ffffff", stroke: C.orange, sw: 2.2 }, ...tag(wp[0] + 32, wp[1] + 15, `via ${NAME[stone]}`, "#ffffff", C.ink, 7.5)); out.push({ t: "rect", x: wp[0] + 32 - (`via ${NAME[stone]}`.length * 7.5 * 0.62 + 10) / 2, y: wp[1] + 15 - 7.5 * 0.95, w: `via ${NAME[stone]}`.length * 7.5 * 0.62 + 10, h: 7.5 * 1.9, rx: 7.5, stroke: C.orange, sw: 1.2 }); }
  out.push({ t: "circle", x: a[0], y: a[1], r: 6, fill: C.ink, stroke: "#ffffff", sw: 2 }, { t: "circle", x: b[0], y: b[1], r: 6, fill: C.orange, stroke: "#ffffff", sw: 2 });
  if (pills) out.push(...tag(a[0] - 26, a[1] + 1, "NOW", C.ink, "#ffffff", 8), ...tag(b[0], b[1] - 17, "PREFERRED", C.orange, "#ffffff", 8));
  return out;
}

/** One framed map. kind now: the Now discs, score points and the NOW dot. pref: the Preferred outlines, points and the PREFERRED dot. move: both, the shaded gap and the route. */
export function mapDrawing(kind: "now" | "pref" | "move", now: Prof, pref: Prof, stone: O | null, W = 300): Drawing {
  const c = W / 2, H = W * 0.37, s: Shape[] = [];
  s.push(...frame(c, H), ...discs(c, H, kind, now, pref));
  s.push(...scorePoints(c, H, kind === "now" ? ["now"] : kind === "pref" ? ["pref"] : ["now", "pref"], now, pref));
  if (kind === "move") s.push(...route(c, H, now, pref, stone, false));
  else {
    const q = axisPoint(kind === "now" ? now : pref), x = c + (q.x / FULL) * H, y = c + (q.y / FULL) * H;
    s.push({ t: "circle", x, y, r: 6, fill: kind === "now" ? C.ink : C.orange, stroke: "#ffffff", sw: 2 }, ...tag(x - (kind === "now" ? 26 : 0), y + (kind === "now" ? 1 : -17), kind === "now" ? "NOW" : "PREFERRED", kind === "now" ? C.ink : C.orange, "#ffffff", 8));
  }
  return { w: W, h: W, shapes: s };
}

/** The separate concentric chart: four 90 degree slices in the squares' corners, rings at 10 to 40 labelled, each slice filled to its Now score with the Preferred edge dashed. */
export function concentricDrawing(now: Prof, pref: Prof, W = 300): Drawing {
  const c = W / 2, H = W * 0.36, s: Shape[] = [];
  const full = R(FULL, H + 3);
  for (const k of RINGS) s.push({ t: "circle", x: c, y: c, r: R(k, H + 3), stroke: C.ring, sw: 0.9 });
  s.push({ t: "circle", x: c, y: c, r: full, stroke: C.ring, sw: 1.2 });
  s.push({ t: "line", x1: c - full, y1: c, x2: c + full, y2: c, stroke: C.ring, sw: 0.9 }, { t: "line", x1: c, y1: c - full, x2: c, y2: c + full, stroke: C.ring, sw: 0.9 });
  for (const o of ORIENTS) {
    const [sx, sy] = SQ[o], rn = R(now[o], H + 3), rp = R(pref[o], H + 3), col = HUE[o];
    s.push({ t: "path", d: quarter(c, sx, sy, rn), fill: col, fo: 0.78, stroke: "#ffffff", sw: 1.6 }, { t: "path", d: arc(c, sx, sy, rp), stroke: C.orange, sw: 2, dash: [5, 3.5] });
  }
  for (const k of RINGS) s.push({ t: "rect", x: c - 9, y: c - R(k, H + 3) - 5, w: 18, h: 10, rx: 5, fill: "#ffffff", fo: 0.9 }, { t: "text", x: c, y: c - R(k, H + 3) + 2.4, s: String(k), size: 7, weight: 600, fill: C.grey, anchor: "middle" });
  const k = Math.SQRT1_2;
  for (const o of ORIENTS) {
    const [sx, sy] = SQ[o], rn = R(now[o], H + 3), rp = R(pref[o], H + 3);
    s.push(...tag(c + sx * rn * k, c + sy * rn * k, String(Math.round(now[o])), "#ffffff", HUE[o], 9));
    s.push(...tag(c + sx * full * 0.86 * k, c + sy * full * 0.86 * k, NAME[o], HUE[o], "#ffffff", 8.5));   // inside its own quadrant, on the outer ring (Erick #66)
    if (Math.abs(rp - rn) > 9) s.push(...tag(c + sx * rp * k, c + sy * rp * k, String(Math.round(pref[o])), C.orange, "#ffffff", 8));
  }
  return { w: W, h: W, shapes: s };
}


// ---------------------------------------------------------------- gauge and heatmap
/** A half circle gauge: a track, the filled part and the value in the middle. The label and the band word are printed by the page, so a colour is never the only signal. */
export function gaugeDrawing(value: number | null, max: number, color: string, digits = 2): Drawing {
  const W = 150, H = 96, cx = 75, cy = 80, r = 56, a0 = Math.PI, fr = value === null ? 0 : Math.max(0, Math.min(1, value / max));
  const pt = (t: number) => `${f(cx + r * Math.cos(a0 + Math.PI * t))},${f(cy + r * Math.sin(a0 + Math.PI * t))}`;
  const shapes: Shape[] = [{ t: "path", d: `M${pt(0)} A${r},${r} 0 0 1 ${pt(1)}`, stroke: "#EADFD5", sw: 13, cap: "round" }];
  if (fr > 0.005) shapes.push({ t: "path", d: `M${pt(0)} A${r},${r} 0 0 1 ${pt(fr)}`, stroke: color, sw: 13, cap: "round" });
  shapes.push({ t: "text", x: cx, y: cy - 6, s: value === null ? "n/a" : value.toFixed(digits), size: 26, weight: 800, fill: C.ink, anchor: "middle" });
  return { w: W, h: H, shapes };
}
/** The colour of a gauge from its share of the maximum. The band word beside it always carries the meaning. */
export const gaugeColor = (value: number | null, max: number) => (value === null ? C.grey : value / max >= 0.7 ? "#58A55C" : value / max >= 0.5 ? "#B7791F" : "#C0392B");

export type HeatRow = { label: string; n: number | null; suppressed: boolean; vals: (number | null)[] };
/** Groups against the organisation: a row per group, a column per orientation, each cell the group's Now score minus the organisation's, in points. A group under five is hatched and named as combined. */
export function heatmapDrawing(rows: HeatRow[], W = 480): Drawing {
  const x0 = 150, cw = (W - x0 - 6) / 4, rh = 28, y0 = 34, h = y0 + rows.length * rh + 22, shapes: Shape[] = [];
  ORIENTS.forEach((o, i) => shapes.push({ t: "text", x: x0 + cw * i + cw / 2, y: 20, s: NAME[o], size: 10, weight: 800, fill: HUE[o], anchor: "middle" }));
  rows.forEach((r, k) => {
    const y = y0 + k * rh;
    shapes.push({ t: "text", x: 2, y: y + 17, s: r.label.length > 24 ? r.label.slice(0, 23) + "." : r.label, size: 9.5, weight: 600, fill: C.ink, anchor: "start" });
    if (r.n !== null && !r.suppressed) shapes.push({ t: "text", x: x0 - 8, y: y + 17, s: "n " + r.n, size: 7.5, weight: 400, fill: C.grey, anchor: "end" });
    if (r.suppressed || r.vals.every((v) => v === null)) {
      const ww = cw * 4 - 4, yy = y + 2, hh = rh - 4;
      shapes.push({ t: "rect", x: x0, y: yy, w: ww, h: hh, rx: 6, fill: "#F3EFEA", stroke: "#CFC8BF", sw: 0.8 });
      for (let a = x0 - hh; a < x0 + ww; a += 8) {
        const t0 = Math.max(0, (x0 - a) / hh), t1 = Math.min(1, (x0 + ww - a) / hh);
        if (t1 > t0) shapes.push({ t: "line", x1: a + hh * t0, y1: yy + hh - hh * t0, x2: a + hh * t1, y2: yy + hh - hh * t1, stroke: "#CFC8BF", sw: 1 });
      }
      shapes.push({ t: "rect", x: x0 + ww / 2 - 92, y: yy + 3, w: 184, h: hh - 6, rx: 8, fill: "#FFFFFF", fo: 0.85 }, { t: "text", x: x0 + ww / 2, y: yy + hh / 2 + 3, s: "group too small to show", size: 8, weight: 600, fill: C.ink, anchor: "middle" });
      return;
    }
    r.vals.forEach((v, i) => {
      if (v === null) return;
      const base = v >= 0 ? HUE[ORIENTS[i]] : C.orange, op = 0.12 + Math.min(Math.abs(v) / 12, 1) * 0.55;
      shapes.push({ t: "rect", x: x0 + cw * i + 1, y: y + 2, w: cw - 4, h: rh - 4, rx: 6, fill: base, fo: op });
      shapes.push({ t: "text", x: x0 + cw * i + (cw - 2) / 2, y: y + 17, s: (v > 0 ? "+" : "") + v.toFixed(1), size: 10, weight: Math.abs(v) >= 8 ? 800 : 600, fill: C.ink, anchor: "middle" });
    });
  });
  shapes.push({ t: "text", x: 2, y: h - 6, s: "Each cell shows how the group differs from the organisation. Bold means a clear difference.", size: 7.5, weight: 400, fill: C.grey, anchor: "start" });
  return { w: W, h, shapes };
}

// ---------------------------------------------------------------- dot and range lines (instead of bar charts, owner Q-RF3)
export type RangeRow = { label: string; color: string; a: number; b: number | null };
/** One thin line per row with a dot for the first value and a ring for the second, joined by a coloured step, and both values written next to their points. */
export function rangeDrawing(rows: RangeRow[], aName: string, bName: string, max = FULL, W = 480): Drawing {
  const x0 = 100, x1 = W - 34, rh = 34, y0 = 30, h = y0 + rows.length * rh + 6, shapes: Shape[] = [];
  const X = (v: number) => x0 + (Math.min(v, max) / max) * (x1 - x0);
  shapes.push({ t: "circle", x: x0 + 2, y: 12, r: 4.5, fill: C.ink }, { t: "text", x: x0 + 11, y: 15.5, s: aName, size: 9, weight: 600, fill: C.ink, anchor: "start" });
  if (rows.some((r) => r.b !== null)) shapes.push({ t: "circle", x: x0 + 8 + aName.length * 5.6 + 28, y: 12, r: 4.5, fill: "#ffffff", stroke: C.orange, sw: 2 }, { t: "text", x: x0 + 8 + aName.length * 5.6 + 37, y: 15.5, s: bName, size: 9, weight: 600, fill: C.ink, anchor: "start" });
  rows.forEach((r, i) => {
    const y = y0 + i * rh + rh / 2;
    shapes.push({ t: "text", x: 2, y: y + 3.5, s: r.label, size: 10.5, weight: 800, fill: r.color, anchor: "start" });
    shapes.push({ t: "line", x1: x0, y1: y, x2: x1, y2: y, stroke: "#E3DCCF", sw: 1.4, cap: "round" });
    for (const k of RINGS) shapes.push({ t: "line", x1: X(k), y1: y - 3, x2: X(k), y2: y + 3, stroke: "#D5CCBC", sw: 1 });
    if (r.b !== null) shapes.push({ t: "line", x1: X(r.a), y1: y, x2: X(r.b), y2: y, stroke: r.b >= r.a ? C.orange : C.grey, sw: 4, cap: "round" });
    shapes.push({ t: "circle", x: X(r.a), y, r: 5.2, fill: C.ink, stroke: "#ffffff", sw: 1.6 });
    shapes.push({ t: "text", x: X(r.a), y: y + (r.b !== null && r.b < r.a ? 17 : -9), s: String(Math.round(r.a)), size: 8.5, weight: 800, fill: C.ink, anchor: "middle" });
    if (r.b !== null) {
      shapes.push({ t: "circle", x: X(r.b), y, r: 5.2, fill: "#ffffff", stroke: C.orange, sw: 2.2 });
      shapes.push({ t: "text", x: X(r.b), y: y + (r.b < r.a ? -9 : 17), s: String(Math.round(r.b)), size: 8.5, weight: 800, fill: C.orange, anchor: "middle" });
    }
  });
  for (const k of RINGS) shapes.push({ t: "text", x: X(k), y: h - 1, s: String(k), size: 7, weight: 600, fill: C.grey, anchor: "middle" });
  return { w: W, h, shapes };
}

// ---------------------------------------------------------------- verdict pills
/** The colour of a verdict. The word beside it always says the same thing, so colour is never the only signal. */
export const verdictColor = (v: string) => (v === "HIT" ? "#58A55C" : v === "PARTIAL_HIT" ? "#B7791F" : v === "MISS" || v === "SYSTEMIC_MISS" ? "#C0392B" : C.grey);

// ---------------------------------------------------------------- SVG renderer (the web report and the preview sheet)
const FONT = "Inter, 'Segoe UI', 'DejaVu Sans', Arial, sans-serif";
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
export function toSvg(d: Drawing, id = "g"): string {
  const marks = new Map<string, string>();
  const body = d.shapes.map((s) => {
    const st = (o: { fill?: string; fo?: number; stroke?: string; sw?: number; dash?: [number, number]; cap?: string }) =>
      `fill="${o.fill ?? "none"}"${o.fo !== undefined ? ` fill-opacity="${o.fo}"` : ""}${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 1}"` : ""}${o.dash ? ` stroke-dasharray="${o.dash[0]} ${o.dash[1]}"` : ""}${o.cap ? ` stroke-linecap="${o.cap}"` : ""}`;
    if (s.t === "path") { let m = ""; if (s.arrow) { const k = `${id}${marks.size}`, heavy = (s.sw ?? 1) >= 2; marks.set(k, (heavy ? "F" : "C") + s.arrow); m = heavy ? ` marker-end="url(#${k})"` : ` marker-start="url(#${k})" marker-end="url(#${k})"`; } return `<path d="${s.d}" ${st(s)}${m}/>`; }
    if (s.t === "rect") return `<rect x="${f(s.x)}" y="${f(s.y)}" width="${f(s.w)}" height="${f(s.h)}"${s.rx ? ` rx="${s.rx}"` : ""} ${st(s)}/>`;
    if (s.t === "circle") return `<circle cx="${f(s.x)}" cy="${f(s.y)}" r="${s.r}" ${st(s)}/>`;
    if (s.t === "line") return `<line x1="${f(s.x1)}" y1="${f(s.y1)}" x2="${f(s.x2)}" y2="${f(s.y2)}" ${st({ stroke: s.stroke, sw: s.sw, dash: s.dash, cap: s.cap })}/>`;
    return `<text x="${f(s.x)}" y="${f(s.y)}" text-anchor="${s.anchor ?? "start"}" font-size="${s.size}" font-weight="${s.weight ?? 400}" fill="${s.fill}" font-family="${FONT}"${s.ls ? ` letter-spacing="${s.ls}"` : ""}${s.rot ? ` transform="rotate(${s.rot} ${f(s.x)} ${f(s.y)})"` : ""}>${esc(s.s)}</text>`;
  }).join("");
  const defs = [...marks].map(([k, v]) => { const col = v.slice(1); return v[0] === "F" ? `<marker id="${k}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1,1 L9,5 L1,9 z" fill="${col}"/></marker>` : `<marker id="${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="${col}" stroke-width="1.8"/></marker>`; }).join("");
  return `<svg viewBox="0 0 ${d.w} ${d.h}" width="100%" style="display:block"><defs>${defs}</defs>${body}</svg>`;
}

// ---------------------------------------------------------------- grouped bars (Erick #67, #68: charts over tables)
export type BarGroup = { label: string; bars: { value: number | null; color: string; ghost?: boolean }[] };
/** Grouped vertical bars with the value on each bar. A ghost bar is drawn pale with a dashed edge (Preferred beside Now). Labels are plain words. */
export function barsDrawing(groups: BarGroup[], max: number, W = 480, H = 220, step = 10): Drawing {
  const left = 26, top = 14, base = H - 30, ch = base - top, gw = (W - left - 6) / groups.length;
  const n = Math.max(...groups.map((g) => g.bars.length)), gap = 3, bw = Math.min(22, (gw * 0.78 - gap * (n - 1)) / n);
  const s: Shape[] = [];
  for (let v = 0; v <= max; v += step) { const y = base - (v / max) * ch; s.push({ t: "line", x1: left, y1: y, x2: W - 4, y2: y, stroke: v ? C.line : C.ring, sw: v ? 0.6 : 1 }, { t: "text", x: left - 5, y: y + 3, s: String(v), size: 7.5, fill: C.grey, anchor: "end" }); }
  groups.forEach((g, i) => {
    const x0 = left + i * gw + (gw - (bw * g.bars.length + gap * (g.bars.length - 1))) / 2;
    g.bars.forEach((b, j) => {
      if (b.value === null || !Number.isFinite(b.value)) return;
      const h = (Math.min(b.value, max) / max) * ch, x = x0 + j * (bw + gap);
      s.push(b.ghost ? { t: "rect", x, y: base - h, w: bw, h, rx: 2, fill: b.color, fo: 0.22, stroke: b.color, sw: 1, dash: [3, 2] } : { t: "rect", x, y: base - h, w: bw, h, rx: 2, fill: b.color });
      s.push({ t: "text", x: x + bw / 2, y: base - h - 3, s: b.value.toFixed(0), size: bw < 12 ? 6.5 : 7.5, weight: 600, fill: C.ink, anchor: "middle" });
    });
    s.push({ t: "text", x: left + i * gw + gw / 2, y: base + 14, s: g.label, size: 8.5, weight: 600, fill: C.ink, anchor: "middle" });
  });
  return { w: W, h: H, shapes: s };
}
