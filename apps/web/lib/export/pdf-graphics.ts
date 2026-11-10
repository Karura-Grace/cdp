import type PDFDocument from "pdfkit";
import type { Model } from "./model";
import type { Drawing, Shape } from "../graphics/culture";

// Direction D marks for the PDF reports (owner picks Q-GR7, Q-GR8, 24 and 25 Oct 2026): the four orientation symbols, the culture fingerprint (quarter discs:
// today, preferred, or the two overlaid with the gap shaded) and the culture map with its stepping stone route. Geometry only: every number is read from the
// frozen score through the export model, nothing is computed here.
type Doc = InstanceType<typeof PDFDocument>;
type O = "ENGAGE" | "INNOVATE" | "PERFORM" | "GOVERN";

export const HUE: Record<O, string> = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
export const ORDER: O[] = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"];
const ORANGE = "#eb5733", INK = "#151c26";
const SQ: Record<O, [number, number]> = { ENGAGE: [-1, -1], INNOVATE: [1, -1], PERFORM: [1, 1], GOVERN: [-1, 1] };
const LABEL: Record<O, string> = { ENGAGE: "Engage", INNOVATE: "Innovate", PERFORM: "Perform", GOVERN: "Govern" };

/** The orientation symbol on a soft round tile, centred at (cx, cy). Engage two overlapping circles, Innovate a spark, Perform a target, Govern a shield. */
export function symbol(doc: Doc, o: O, cx: number, cy: number, r: number, tile = true) {
  const c = HUE[o];
  if (tile) doc.circle(cx, cy, r).fillColor(c).fillOpacity(0.16).fill().fillOpacity(1);
  const k = r * 0.58;
  doc.lineWidth(Math.max(1, r / 7)).strokeColor(c).lineCap("round").lineJoin("round");
  if (o === "ENGAGE") { doc.circle(cx - k * 0.38, cy, k * 0.62).stroke(); doc.circle(cx + k * 0.38, cy, k * 0.62).stroke(); }
  else if (o === "INNOVATE") {
    const p: [number, number][] = [];
    for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i - Math.PI / 8, rr = i % 2 ? k * 0.45 : k; p.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    doc.polygon(...p).stroke();
  } else if (o === "PERFORM") { doc.circle(cx, cy, k).stroke(); doc.circle(cx, cy, k * 0.58).stroke(); doc.circle(cx, cy, k * 0.18).fillColor(c).fill(); }
  else doc.path(`M${cx},${cy - k} L${cx + k * 0.85},${cy - k * 0.5} L${cx + k * 0.85},${cy + k * 0.15} Q${cx + k * 0.85},${cy + k * 0.75} ${cx},${cy + k} Q${cx - k * 0.85},${cy + k * 0.75} ${cx - k * 0.85},${cy + k * 0.15} L${cx - k * 0.85},${cy - k * 0.5} Z`).stroke();
  doc.lineCap("butt").lineJoin("miter");
}

type Prof = Record<O, number>;
/** The four profile scores as numbers for geometry (50 fills a quarter). */
export const profiles = (m: Model) => {
  const now = {} as Prof, pref = {} as Prof;
  for (const o of ORDER) { const r = m.profile.find((p) => p.name === LABEL[o])!; now[o] = r.nowN; pref[o] = r.prefN; }
  return { now, pref };
};

const quarter = (cx: number, cy: number, sx: number, sy: number, R: number) => `M${cx},${cy} L${cx + sx * R},${cy} A${R},${R} 0 0 ${sx * sy > 0 ? 1 : 0} ${cx},${cy + sy * R} Z`;

/** The culture fingerprint: four quarter discs sized by how much of each orientation there is. mode "now" solid, "pref" dashed outline,
 *  "overlay" today solid with the preferred outline on top and the gap shaded (orange: more wanted than today, grey: less wanted). */
export function fingerprint(doc: Doc, cx: number, cy: number, half: number, p: { now: Prof; pref: Prof }, mode: "now" | "pref" | "overlay", frame = true) {
  const rad = (v: number) => Math.min((half - 2) * Math.min(v / 50, 1) * 1.12, half - 2);   // a disc never leaves its own square
  for (const o of ORDER) {
    const [sx, sy] = SQ[o], x0 = sx < 0 ? cx - half : cx + 1.5, y0 = sy < 0 ? cy - half : cy + 1.5;
    if (frame) doc.roundedRect(x0, y0, half - 1.5, half - 1.5, 6).fillColor(HUE[o]).fillOpacity(0.06).fill().fillOpacity(1).roundedRect(x0, y0, half - 1.5, half - 1.5, 6).strokeColor(HUE[o]).strokeOpacity(0.3).lineWidth(0.6).stroke().strokeOpacity(1);
  }
  for (const o of ORDER) {
    const [sx, sy] = SQ[o], c = HUE[o], Rn = rad(p.now[o]), Rp = rad(p.pref[o]);
    const solid = () => doc.path(quarter(cx, cy, sx, sy, Rn)).fillColor(c).fillOpacity(0.4).fill().fillOpacity(1).path(quarter(cx, cy, sx, sy, Rn)).strokeColor(c).lineWidth(1).stroke();
    const dashed = () => doc.path(quarter(cx, cy, sx, sy, Rp)).dash(4, { space: 2.5 }).strokeColor(ORANGE).lineWidth(1.8).stroke().undash();
    if (mode === "now") solid();
    else if (mode === "pref") dashed();
    else {
      solid();
      const lo = Math.min(Rn, Rp), hi = Math.max(Rn, Rp), sw = sx * sy > 0 ? 1 : 0;
      if (hi - lo > 0.5) doc.path(`M${cx + sx * lo},${cy} L${cx + sx * hi},${cy} A${hi},${hi} 0 0 ${sw} ${cx},${cy + sy * hi} L${cx},${cy + sy * lo} A${lo},${lo} 0 0 ${1 - sw} ${cx + sx * lo},${cy} Z`)
        .fillColor(Rp > Rn ? ORANGE : INK).fillOpacity(Rp > Rn ? 0.4 : 0.22).fill().fillOpacity(1);
      dashed();
    }
  }
}


// ---------------------------------------------------------------- the shared drawings (lib/graphics/culture.ts) drawn with pdfkit
/** Points of a path made only of M, L, H and V (the frame brackets and the route), to put an arrow head on it. */
function pathPoints(d: string): [number, number][] {
  const out: [number, number][] = []; let x = 0, y = 0;
  for (const m of d.matchAll(/([MLHV])\s*(-?[\d.]+)(?:[ ,](-?[\d.]+))?/g)) {
    if (m[1] === "H") x = Number(m[2]); else if (m[1] === "V") y = Number(m[2]); else { x = Number(m[2]); y = Number(m[3]); }
    out.push([x, y]);
  }
  return out;
}
function head(doc: Doc, from: [number, number], to: [number, number], fill: boolean, col: string, sw: number) {
  const ang = Math.atan2(to[1] - from[1], to[0] - from[0]), hl = fill ? 7 : 5;
  doc.save().lineJoin("round");
  doc.moveTo(to[0] - hl * Math.cos(ang - 0.45), to[1] - hl * Math.sin(ang - 0.45)).lineTo(to[0], to[1]).lineTo(to[0] - hl * Math.cos(ang + 0.45), to[1] - hl * Math.sin(ang + 0.45));
  if (fill) doc.closePath().fillColor(col).fill(); else doc.strokeColor(col).lineWidth(sw).stroke();
  doc.restore();
}
/** Draws a shared drawing with its top left at (x, y), scaled to width w. Text uses the embedded Inter for weights 600 and up, the serif below. */
export function drawPdf(doc: Doc, d: Drawing, x: number, y: number, w: number) {
  const k = w / d.w;
  doc.save().translate(x, y).scale(k);
  for (const sh of d.shapes as Shape[]) {
    const dash = (o: { dash?: [number, number] }) => (o.dash ? doc.dash(o.dash[0], { space: o.dash[1] }) : doc);
    if (sh.t === "path") {
      if (sh.fill) doc.path(sh.d).fillColor(sh.fill).fillOpacity(sh.fo ?? 1).fill().fillOpacity(1);
      if (sh.stroke) { doc.save(); dash(sh); doc.path(sh.d).lineCap(sh.cap ?? "butt").strokeColor(sh.stroke).lineWidth(sh.sw ?? 1).stroke(); doc.restore(); }
      if (sh.arrow) { const pts = pathPoints(sh.d); if (pts.length > 1) { const heavy = (sh.sw ?? 1) >= 2; head(doc, pts[pts.length - 2], pts[pts.length - 1], heavy, sh.arrow, sh.sw ?? 1); if (!heavy) head(doc, pts[1], pts[0], false, sh.arrow, sh.sw ?? 1); } }
    } else if (sh.t === "rect") {
      if (sh.fill) doc.roundedRect(sh.x, sh.y, sh.w, sh.h, sh.rx ?? 0).fillColor(sh.fill).fillOpacity(sh.fo ?? 1).fill().fillOpacity(1);
      if (sh.stroke) { doc.save(); dash(sh); doc.roundedRect(sh.x, sh.y, sh.w, sh.h, sh.rx ?? 0).strokeColor(sh.stroke).lineWidth(sh.sw ?? 1).stroke(); doc.restore(); }
    } else if (sh.t === "circle") {
      if (sh.fill) doc.circle(sh.x, sh.y, sh.r).fillColor(sh.fill).fillOpacity(sh.fo ?? 1).fill().fillOpacity(1);
      if (sh.stroke) doc.circle(sh.x, sh.y, sh.r).strokeColor(sh.stroke).lineWidth(sh.sw ?? 1).stroke();
    } else if (sh.t === "line") {
      doc.save(); dash(sh); doc.moveTo(sh.x1, sh.y1).lineTo(sh.x2, sh.y2).lineCap(sh.cap ?? "butt").strokeColor(sh.stroke).lineWidth(sh.sw).stroke(); doc.restore();
    } else {
      doc.save();
      if (sh.rot) doc.rotate(sh.rot, { origin: [sh.x, sh.y] });
      doc.font((sh.weight ?? 400) >= 600 ? "Head" : "Serif").fontSize(sh.size).fillColor(sh.fill);
      const tw = doc.widthOfString(sh.s, { characterSpacing: sh.ls ?? 0 }), x0 = sh.anchor === "middle" ? sh.x - tw / 2 : sh.anchor === "end" ? sh.x - tw : sh.x;
      doc.text(sh.s, x0, sh.y - sh.size * 0.8, { lineBreak: false, characterSpacing: sh.ls ?? 0 });
      doc.restore();
    }
  }
  doc.restore();
}
