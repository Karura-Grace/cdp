// Drawing primitives for the DRAFT8 report template (docs/design-agent/template, SPEC groups 1 to 4, owner Q-D8-1 to Q-D8-45):
// tokens, text placed on the template's line boxes, the page frame, panels, tables, the so what callout, icons and the charts.
// Every size here is the template's measured value in points. Page builders live in pdf-template.ts.
import PDFDocument from "pdfkit";
import { SERIF, SERIF_BOLD } from "./fonts";
import { INTER_400, INTER_600, INTER_700, SERIF_ITALIC } from "./fonts-template";

export const C = { brand: "#EA5732", ink: "#131313", muted: "#727070", paper: "#FAF7F2", surface: "#FBE9E3", accent: "#8F3A24", white: "#FFFFFF",
  grid: "#DDDDDD", band: "#EEEEEE", band2: "#DDDDDD", hatch: "#C7C6C6", neg: "#C0392B", pos: "#2E86C1",
  hit: "#2F6F40", partial: "#C77C0E", miss: "#A93226" } as const;
export const O4 = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"] as const;
export type O = (typeof O4)[number];
export const HUE: Record<O, string> = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
export const TINT: Record<O, string> = { ENGAGE: "#B6D5E9", INNOVATE: "#CCB8D4", PERFORM: "#E9BAB5", GOVERN: "#C5E0C6" };
export const ONAME: Record<O, string> = { ENGAGE: "Engage", INNOVATE: "Innovate", PERFORM: "Perform", GOVERN: "Govern" };
export const PW = 595.28, PH = 841.89, X0 = 48, CW = 499.28, X1 = 547.28, TOP = 72, LIMIT = 777.89, HALF = 241.64, GAP = 16;

type Doc = InstanceType<typeof PDFDocument>;
export type F = "I4" | "I6" | "I7" | "S" | "SB" | "SI";
const NAT: Record<F, number> = { I4: 1.21, I6: 1.21, I7: 1.21, S: 1.2695, SB: 1.2695, SI: 1.2695 };
export const ui = (f: F) => f.startsWith("I");

/** A signed number with a true minus (template rule): +11.34, −10.15. */
export const sgn = (v: number, d = 2) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
/** A plain number with a true minus. */
export const num = (v: number, d = 2) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
/** Counts zero to ten as words in prose (owner Q-D8-30). */
export const count = (k: number) => (k >= 0 && k <= 10 && Number.isInteger(k) ? WORDS[k] : String(k));
export const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export function newDoc(info: { Title: string; Subject: string; Keywords: string }) {
  const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, info: { ...info, Author: "Priority Activator Consulting" } });
  doc.registerFont("I4", Buffer.from(INTER_400, "base64")).registerFont("I6", Buffer.from(INTER_600, "base64")).registerFont("I7", Buffer.from(INTER_700, "base64"))
    .registerFont("S", Buffer.from(SERIF, "base64")).registerFont("SB", Buffer.from(SERIF_BOLD, "base64")).registerFont("SI", Buffer.from(SERIF_ITALIC, "base64"));
  return doc;
}

export interface TOpt { f?: F; size?: number; lead?: number; color?: string; w?: number; align?: "left" | "right" | "center"; cs?: number; one?: boolean; caps?: boolean }
const tnum = (f: F) => (ui(f) ? { features: ["tnum"] as never } : {});
/** Text on the template line box: y is the top of the first line box (SPEC group 1, 0.1). Returns the bottom of the last line box. */
export function tx(doc: Doc, t: string, x: number, y: number, o: TOpt = {}): number {
  const f = o.f ?? "S", size = o.size ?? 10, lead = o.lead ?? (ui(f) ? size * 1.25 : 14), gap = lead - size * NAT[f], s = o.caps ? t.toUpperCase() : t;
  doc.font(f).fontSize(size).fillColor(o.color ?? C.ink);
  const opt = { width: o.w, align: o.align, lineGap: gap, characterSpacing: o.cs ?? 0, lineBreak: !o.one, ellipsis: o.one || undefined, ...tnum(f) };
  const h = o.w ? doc.heightOfString(s, opt) : lead;
  doc.text(s, x, y + gap / 2, opt);
  return y + Math.max(lead, Math.round(h / lead) * lead);
}
export const tw = (doc: Doc, t: string, f: F, size: number, cs = 0) => doc.font(f).fontSize(size).widthOfString(t, { characterSpacing: cs, ...tnum(f) });
export const th = (doc: Doc, t: string, w: number, f: F = "S", size = 10, lead = 14) => { doc.font(f).fontSize(size); const h = doc.heightOfString(t, { width: w, lineGap: lead - size * NAT[f] }); return Math.max(lead, Math.round(h / lead) * lead); };

/** Rich text in one style family: segments marked `hi` print in brand, Inter 700 (one brand number per page). */
export function rich(doc: Doc, segs: { t: string; hi?: boolean; b?: boolean }[], x: number, y: number, w: number, o: { f?: F; size?: number; lead?: number } = {}) {
  // laid out word by word so a brand number can sit mid line (pdfkit "continued" text breaks lines unevenly across fonts)
  const f = o.f ?? "I6", size = o.size ?? 14, lead = o.lead ?? 19, gap = (lead - size * NAT[f]) / 2;
  const words = segs.flatMap((sg) => sg.t.split(/(\s+)/).filter((z) => z.length).map((t) => ({ t, f: (sg.hi ? "I7" : sg.b ? (ui(f) ? "I7" : "SB") : f) as F, col: sg.hi ? C.brand : C.ink })));
  let cx = x, cy = y, pend = 0;   // pend: width of the spaces waiting before the next word
  const placed: { t: string; f: F; col: string; x: number; y: number }[] = [];
  for (const z of words) {
    const ww = doc.font(z.f).fontSize(size).widthOfString(z.t, tnum(z.f));
    if (/^\s+$/.test(z.t)) { if (cx > x) pend += ww; continue; }
    if (cx + pend + ww > x + w && cx > x) { cy += lead; cx = x; pend = 0; }
    cx += pend; pend = 0; placed.push({ ...z, x: cx, y: cy }); cx += ww;
  }
  for (const z of placed) doc.font(z.f).fontSize(size).fillColor(z.col).text(z.t, z.x, z.y + gap, { lineBreak: false, ...tnum(z.f) });
  return cy + lead;
}

// ---------------------------------------------------------------- frame
export function frame(doc: Doc, logo: Buffer, head: string, foot: string, page: number, total: number, noHead = false) {
  if (!noHead) {
    tx(doc, head, X0, 30.27, { f: "I4", size: 7.5, lead: 10, color: C.muted, w: 435.14, one: true });
    doc.image(logo, 499.14, 24, { height: 18 });
    doc.moveTo(X0, 46).lineTo(X1, 46).lineWidth(0.75).strokeColor(C.brand).stroke();
  }
  doc.moveTo(X0, 789.89).lineTo(X1, 789.89).lineWidth(0.75).strokeColor(C.brand).stroke();
  tx(doc, foot, X0, 798.16, { f: "I4", size: 7.5, lead: 10, color: C.muted, w: 380, one: true });
  tx(doc, `Page ${page} of ${total}`, 447.28, 797.62, { f: "I7", size: 9, lead: 10, w: 100, align: "right" });
}
export const paper = (doc: Doc) => doc.rect(0, 0, PW, PH).fill(C.paper);

/** Chapter opener: number tile and title bar (SPEC group 1, 6). Two lines grow both to 48. Returns the y under the bar. */
export function opener(doc: Doc, n: string, title: string) {
  const one = tw(doc, title.toUpperCase(), "I7", 12, 0.6) <= 443.28, h = one ? 32 : 48;
  doc.rect(X0, TOP, 32, h).fill(C.brand); doc.rect(80, TOP, 467.28, h).fill(C.ink);
  tx(doc, n, X0, TOP + (h - 16) / 2, { f: "I7", size: 16, lead: 16, color: C.white, w: 32, align: "center" });
  tx(doc, title, 92, TOP + (h - (one ? 14 : 28)) / 2, { f: "I7", size: 12, lead: 14, color: C.white, w: 443.28, caps: true, cs: 0.6 });
  return TOP + h;
}
/** Section heading on a continuation page: "3.2  The six dimensions" (type.h1, number column 28 or number width + 8). */
export function section(doc: Doc, n: string, title: string, y = TOP) {
  const nw = Math.max(30, tw(doc, n, "I7", 14) + 10);
  tx(doc, n, X0, y, { f: "I7", size: 14, lead: 18 }); tx(doc, title, X0 + nw, y, { f: "I7", size: 14, lead: 18, w: CW - nw });
  return y + 18;
}
export const headline = (doc: Doc, segs: { t: string; hi?: boolean }[], y: number) => rich(doc, segs, X0, y, CW);
export const h2 = (doc: Doc, t: string, y: number, x = X0, w = CW) => tx(doc, t, x, y, { f: "I6", size: 11, lead: 14, w });

// ---------------------------------------------------------------- panels and callouts
export function panel(doc: Doc, x: number, y: number, w: number, h: number, title?: string) {
  // editorial (owner Q-D9-22): charts sit on the page; the title is a brand kicker over a hairline, no white box.
  // Without a title the block is a card that must read as one object (tiles, check cards, principles), so it keeps its white panel.
  if (!title) { if (h > 0) doc.roundedRect(x, y, w, h, 4).fill(C.white); return; }
  tx(doc, title, x, y + 2, { f: "I7", size: 7.5, lead: 10, color: C.brand, w, caps: true, cs: 0.6, one: true });
  doc.moveTo(x, y + 16).lineTo(x + w, y + 16).lineWidth(0.5).strokeColor(C.ink).stroke();
}
/** A white card where a block must read as one object (finding cards, priority cards); charts never use it. */
export const card = (doc: Doc, x: number, y: number, w: number, h: number) => doc.roundedRect(x, y, w, h, 4).fill(C.white);
export function soWhat(doc: Doc, text: string, y: number, label = "So what", x = X0, w = CW) {
  const h = 30 + th(doc, text, w - 24) + 12;
  doc.roundedRect(x, y, w, h, 4).fill(C.surface); doc.rect(x, y, w, 1.5).fill(C.brand);
  tx(doc, label, x + 12, y + 12, { f: "I7", size: 8, lead: 10, caps: true, cs: 0.5 });
  tx(doc, text, x + 12, y + 30, { w: w - 24 });
  return y + h;
}

/** Legend row at a baseline-ish y: [label, kind, colour]. Kinds: fill, now (tint with outline), pref, dash, dot, diamond, line. */
export function legend(doc: Doc, items: [string, "fill" | "now" | "dash" | "dot" | "diamond" | "line" | "hatch", string][], x: number, y: number) {
  let cx = x;
  for (const [t, k, col] of items) {
    if (k === "fill") doc.roundedRect(cx, y, 10, 7, 2).fill(col);
    else if (k === "now") doc.roundedRect(cx, y, 10, 7, 2).fill(col || C.band);
    else if (k === "hatch") { doc.rect(cx, y, 10, 7).fill(C.white); hatch(doc, cx, y, 10, 7); doc.rect(cx, y, 10, 7).lineWidth(0.5).strokeColor(C.ink).stroke(); }
    else if (k === "dash") doc.moveTo(cx, y + 3.5).lineTo(cx + 10, y + 3.5).dash(2, { space: 2 }).lineWidth(0.75).strokeColor(col).stroke().undash();
    else if (k === "line") doc.moveTo(cx, y + 3.5).lineTo(cx + 10, y + 3.5).lineWidth(1.5).strokeColor(col).stroke();
    else if (k === "dot") doc.circle(cx + 5, y + 3.5, 3.5).fill(col);
    else { doc.circle(cx + 5, y + 3.5, 3.5).lineWidth(1.5).fillAndStroke(C.paper, col); }
    tx(doc, t, cx + 14, y - 2, { f: "I4", size: 8, lead: 10, color: C.muted });
    cx += 14 + tw(doc, t, "I4", 8) + 14;
  }
}
export function hatch(doc: Doc, x: number, y: number, w: number, h: number) {
  doc.save().rect(x, y, w, h).clip();
  for (let k = -h; k < w; k += 4) doc.moveTo(x + k, y + h).lineTo(x + k + h, y).lineWidth(0.5).strokeColor(C.hatch).stroke();
  doc.restore();
}
export function diamond(doc: Doc, cx: number, cy: number, r: number, filled: boolean, col: string = C.ink) {
  doc.polygon([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]);
  if (filled) doc.fill(col); else doc.fillAndStroke(C.white, col).lineWidth(1);
}

// ---------------------------------------------------------------- icons (drawn, 10 x 10 box at x, y)
export type Icon = "check" | "cross" | "half" | "watch" | "star";
export function icon(doc: Doc, k: Icon, x: number, y: number, col: string = C.ink, s = 10) {
  const u = s / 10;
  doc.save().lineWidth(1.4 * u).strokeColor(col).fillColor(col).lineCap("round").lineJoin("round");
  if (k === "check") doc.moveTo(x + 1.5 * u, y + 5.2 * u).lineTo(x + 4 * u, y + 7.8 * u).lineTo(x + 8.7 * u, y + 2.2 * u).stroke();
  else if (k === "cross") doc.moveTo(x + 2 * u, y + 2 * u).lineTo(x + 8 * u, y + 8 * u).moveTo(x + 8 * u, y + 2 * u).lineTo(x + 2 * u, y + 8 * u).stroke();
  else if (k === "half") { doc.lineWidth(1 * u).circle(x + 5 * u, y + 5 * u, 4 * u).stroke(); doc.path(`M ${x + 5 * u} ${y + 1 * u} A ${4 * u} ${4 * u} 0 0 0 ${x + 5 * u} ${y + 9 * u} Z`).fill(); }
  else if (k === "watch") { doc.lineWidth(1 * u).polygon([x + 5 * u, y + 0.8 * u], [x + 9.6 * u, y + 9 * u], [x + 0.4 * u, y + 9 * u]).stroke(); doc.moveTo(x + 5 * u, y + 3.8 * u).lineTo(x + 5 * u, y + 6.2 * u).stroke(); doc.circle(x + 5 * u, y + 7.7 * u, 0.55 * u).fill(); }
  else { const pts: [number, number][] = []; for (let i = 0; i < 10; i++) { const r = (i % 2 ? 2 : 4.8) * u, a = -Math.PI / 2 + (i * Math.PI) / 5; pts.push([x + 5 * u + r * Math.cos(a), y + 5.2 * u + r * Math.sin(a)]); } doc.lineWidth(0.9 * u).polygon(...pts).stroke(); }
  doc.restore();
}
/** A verdict tile: coloured fill, white icon and word (Hit, Partial hit, Miss; Flag tiles are ink). */
export function verdictTile(doc: Doc, kind: "HIT" | "PARTIAL_HIT" | "MISS" | "FLAG", word: string, x: number, y: number, minW = 100.82, h = 24) {
  const col = kind === "HIT" ? C.hit : kind === "PARTIAL_HIT" ? C.partial : kind === "MISS" ? C.miss : C.ink;
  const ic: Icon = kind === "HIT" ? "check" : kind === "PARTIAL_HIT" ? "half" : kind === "MISS" ? "cross" : "watch";
  const lines = word.toUpperCase().split("\n"), w = Math.min(160, Math.max(minW, 30 + Math.max(...lines.map((l) => tw(doc, l, "I7", 8, 0.5))) + 10));
  doc.roundedRect(x, y, w, h, 3).fill(col); icon(doc, ic, x + 8, y + (h - 10) / 2, C.white);
  lines.forEach((l, i) => tx(doc, l, x + 24, y + (h - lines.length * 10) / 2 + i * 10, { f: "I7", size: 8, lead: 10, color: C.white, cs: 0.5, one: true, w: w - 28 }));
  return w;
}

// ---------------------------------------------------------------- tables (SPEC group 2, 3.2)
export interface Cell { t: string; icon?: Icon; star?: boolean; b?: boolean; muted?: string }
export type Row = (string | Cell)[];
export interface TableSpec { head: string[]; rows: Row[]; cols: number[]; right?: number[]; dense?: boolean; group?: { label: string; from: number; to: number }[] }
const cell = (c: string | Cell): Cell => (typeof c === "string" ? { t: c } : c);
function rowH(doc: Doc, r: Row, ws: number[], pad: number) {
  return 8 + Math.max(...r.map((c, i) => { const k = cell(c); const iw = ws[i] - 2 * pad - (k.icon || k.star ? 14 : 0); doc.font(i === 0 || k.b ? "I6" : "I4").fontSize(8.5); return Math.max(1, Math.round(doc.heightOfString(k.t || " ", { width: iw, lineGap: 11 - 8.5 * 1.21 }) / 11)) * 11 + (k.muted ? 9 : 0); }));
}
/** Draws a table; returns the bottom. Splits are the caller's job (tables here are sized to fit their page). */
export function table(doc: Doc, t: TableSpec, y: number, x = X0, w = CW) {
  const pad = t.dense || t.cols.length >= 7 ? 4 : t.cols.length === 6 ? 8 : 12, ws = t.cols.map((c) => c * w), xs = ws.map((_, i) => x + ws.slice(0, i).reduce((a, b) => a + b, 0));
  const right = new Set(t.right ?? t.cols.map((_, i) => i).slice(1));
  if (t.group) {
    doc.rect(x, y, w, 18).fill(C.ink);
    for (const g of t.group) { const gx = xs[g.from], gw = ws.slice(g.from, g.to + 1).reduce((a, b) => a + b, 0); tx(doc, g.label, gx, y + 4, { f: "I6", size: 8, lead: 10, color: C.white, w: gw, align: "center" }); doc.moveTo(gx + 6, y + 17).lineTo(gx + gw - 6, y + 17).lineWidth(0.5).strokeColor("#5a5a5a").stroke(); }
    y += 18;
  }
  doc.rect(x, y, w, 18).fill(C.ink);
  t.head.forEach((h, i) => tx(doc, h, xs[i] + pad, y + 4, { f: "I6", size: 8, lead: 10, color: C.white, w: ws[i] - 2 * pad, align: right.has(i) ? "right" : "left", one: true }));
  y += 18;
  t.rows.forEach((r, ri) => {
    const h = rowH(doc, r, ws, pad);
    if (ri % 2) doc.rect(x, y, w, h).fill(C.surface);
    r.forEach((c0, i) => {
      const k = cell(c0), al = right.has(i) ? "right" : "left", f: F = i === 0 || k.b || k.star ? "I6" : "I4";
      const iw = ws[i] - 2 * pad, mark = k.icon ?? (k.star ? "star" : undefined);
      if (mark) {
        const textW = tw(doc, k.t, f, 8.5), ix = al === "right" ? xs[i] + ws[i] - pad - textW - 14 : xs[i] + pad;
        icon(doc, mark, ix, y + 4.5, C.ink);
        tx(doc, k.t, al === "right" ? xs[i] + pad : ix + 14, y + 4, { f, size: 8.5, lead: 11, w: al === "right" ? iw : iw - 14, align: al });
      } else tx(doc, k.t, xs[i] + pad, y + 4, { f, size: 8.5, lead: 11, w: iw, align: al });
      if (k.muted) tx(doc, k.muted, xs[i] + pad, y + h - 13, { f: "I4", size: 7, lead: 9, color: C.muted, w: iw, align: al });
    });
    if (ri < t.rows.length - 1) doc.moveTo(x, y + h).lineTo(x + w, y + h).lineWidth(0.5).strokeColor(C.grid).stroke();
    y += h;
  });
  doc.moveTo(x, y).lineTo(x + w, y).lineWidth(0.75).strokeColor(C.ink).stroke();
  return y + 0.75;
}
/** Star the highest numeric value (ties all starred) in the given column indexes of each row, or across rows for a column. */
export function starRows(rows: Row[], cols: number[]): Row[] {
  return rows.map((r) => { const vals = cols.map((i) => parseFloat(String(cell(r[i]).t).replace("−", "-"))); const top = Math.max(...vals);
    return r.map((c, i) => (cols.includes(i) && parseFloat(String(cell(c).t).replace("−", "-")) === top ? { ...cell(c), star: true } : c)); });
}
export function starCol(rows: Row[], col: number, skip: (r: Row) => boolean = () => false): Row[] {
  const vals = rows.map((r) => (skip(r) ? -Infinity : parseFloat(String(cell(r[col]).t).replace("−", "-")))), top = Math.max(...vals);
  return rows.map((r, i) => (vals[i] === top ? r.map((c, j) => (j === col ? { ...cell(c), star: true } : c)) : r));
}

// ---------------------------------------------------------------- charts (panel local geometry, SPEC group 2, 4)
const lab7 = (doc: Doc, t: string, x: number, y: number, o: { w?: number; align?: "left" | "right" | "center"; b?: boolean; color?: string; knock?: boolean; f?: F } = {}) => {
  // chart text 8 pt (owner Q-D9-9: text too small); names Inter 600, values Inter 700 when asked
  const f: F = o.f ?? (o.b ? "I6" : "I4"), w = o.w ?? tw(doc, t, f, 8) + 6;
  if (o.knock) { const ww = tw(doc, t, f, 8) + 3, kx = o.align === "center" ? x + (w - ww) / 2 : o.align === "right" ? x + w - ww : x - 1.5; doc.rect(kx, y, ww, 10).fill(C.paper); }
  tx(doc, t, x, y - 0.5, { f, size: 8, lead: 10, color: o.color ?? C.ink, w, align: o.align ?? "left" });
};
export const label7 = lab7;
/** A bar with rounded ends (soft modern touch kept in the blend). */
export const rbar = (doc: Doc, x: number, y: number, w: number, h: number, col: string) => { if (w > 0.5) doc.roundedRect(x, y, w, h, Math.min(h / 2, w / 2)).fill(col); };
/** An orientation name with its colour dot. */
export function oname(doc: Doc, o: O, x: number, y: number, w = 80) { doc.circle(x + 3.5, y + 5, 3.5).fill(HUE[o]); lab7(doc, ONAME[o], x + 11, y, { b: true, w: w - 11 }); }
/** Vertical grouped bars. Each group: label and bars {v, o, now?} (now = tint with series outline, else solid with keyline). Values may be negative (gap charts). */
export function vbars(doc: Doc, x: number, y: number, w: number, h: number, groups: { label: string; bars: { v: number; col: string; tint?: string; now?: boolean; show?: string }[] }[], o: { min: number; max: number; step: number; ref?: number; dec?: number; sub?: string[] }) {
  const L = x + 4, R = x + w - 4, T = y + 12, B = y + h - (o.sub ? 28 : 18), sy = (v: number) => B - ((v - o.min) / (o.max - o.min)) * (B - T);
  if (o.ref !== undefined) { doc.moveTo(L, sy(o.ref)).lineTo(R, sy(o.ref)).dash(1.5, { space: 2 }).lineWidth(0.6).strokeColor(C.muted).stroke().undash(); }
  const gw = (R - L) / groups.length;
  groups.forEach((g, gi) => {
    const nb = g.bars.length, bw = Math.min(18, (gw * 0.8) / nb), gx = L + gi * gw + (gw - bw * nb - 2 * (nb - 1)) / 2;
    g.bars.forEach((b, bi) => {
      if (!Number.isFinite(b.v)) return;
      const bx = gx + bi * (bw + 2), y0 = sy(Math.max(0, o.min)), y1 = sy(b.v), top = Math.min(y0, y1), hh = Math.abs(y1 - y0);
      doc.roundedRect(bx, top, bw, hh, Math.min(2, hh / 2)).fill(b.now ? (b.tint ?? C.band) : b.col);
      const txt = b.show ?? (o.min < 0 ? sgn(b.v, o.dec ?? 0) : b.v.toFixed(o.dec ?? 1));
      lab7(doc, txt, bx - 9, b.v >= 0 ? top - 11 : top + hh + 1, { w: bw + 18, align: "center", knock: true, f: b.now ? "I4" : "I7", color: b.now ? C.muted : C.ink });
    });
    lab7(doc, g.label, L + gi * gw, B + 5, { w: gw, align: "center", b: true });
    if (o.sub?.[gi]) lab7(doc, o.sub[gi], L + gi * gw, B + 15, { w: gw, align: "center", color: C.muted });
  });
  doc.moveTo(L, sy(Math.max(0, o.min))).lineTo(R, sy(Math.max(0, o.min))).lineWidth(0.75).strokeColor(C.ink).stroke();
}
/** Horizontal bars, diverging around zero when min < 0. Rows: label, value, colour, optional sub label and right text. Bands shade |v| ranges. */
export function hbars(doc: Doc, x: number, y: number, w: number, rows: { label: string; sub?: string; v: number; col: string; show?: string; right?: string; o?: O }[], o: { min: number; max: number; step: number; lw?: number; rw?: number; rowH?: number; bands?: { from: number; to: number; fill: string }[]; ref?: { v: number; label: string }; axis?: [string, string]; dec?: number; ticks?: boolean }) {
  const lw = o.lw ?? 86, rw = o.rw ?? 0, L = x + lw, R = x + w - rw - 30, rh = o.rowH ?? 24, T = y + (o.ref ? 14 : 0), B = T + rows.length * rh, sx = (v: number) => L + 26 + ((v - o.min) / (o.max - o.min)) * (R - L - 26);
  for (const b of o.bands ?? []) doc.rect(sx(b.from), T, sx(b.to) - sx(b.from), B - T).fill(b.fill);
  if (o.ticks) for (let v = o.min; v <= o.max + 1e-9; v += o.step) lab7(doc, o.min < 0 && v > 0 ? `+${v}` : num(v, 0), sx(v) - 12, B + 3, { w: 24, align: "center", color: C.muted });
  if (o.ref) { doc.moveTo(sx(o.ref.v), T - 4).lineTo(sx(o.ref.v), B).dash(1.5, { space: 2 }).lineWidth(0.75).strokeColor(C.ink).stroke().undash(); lab7(doc, o.ref.label, sx(o.ref.v) + 3, T - 14); }
  rows.forEach((r, i) => {
    const ry = T + i * rh, bh = Math.min(11, rh * 0.5), by = ry + (rh - bh) / 2, z = sx(Math.max(0, o.min)), e = sx(Math.max(o.min, Math.min(o.max, r.v)));
    rbar(doc, Math.min(z, e), by, Math.abs(e - z), bh, r.col);
    if (r.o) oname(doc, r.o, x, ry + rh / 2 - 5, lw - 4);
    else lab7(doc, r.label, x, ry + (r.sub ? rh / 2 - 10 : rh / 2 - 5), { b: true, w: lw - 6 });
    if (r.sub) lab7(doc, r.sub, x, ry + rh / 2, { w: lw - 6, color: C.muted });
    const sh = r.show ?? (o.min < 0 ? sgn(r.v, o.dec ?? 1) : r.v.toFixed(o.dec ?? 1));
    lab7(doc, sh, r.v >= 0 ? e + 4 : e - tw(doc, sh, "I7", 8) - 6, by + bh / 2 - 5, { f: "I7" });
    if (r.right) lab7(doc, r.right, x + w - rw, ry + rh / 2 - 5, { w: rw, align: "right" });
  });
  if (o.min < 0) doc.moveTo(sx(0), T - 2).lineTo(sx(0), B + 2).lineWidth(0.75).strokeColor(C.ink).stroke();
  if (o.axis) { lab7(doc, o.axis[0], L, B + (o.ticks ? 14 : 4), { color: C.muted }); lab7(doc, o.axis[1], R - tw(doc, o.axis[1], "I4", 8), B + (o.ticks ? 14 : 4), { color: C.muted }); }
  return B + (o.axis ? 24 : 12);
}
/** Dot plot: per row, points (circle filled, diamond hollow, arrow from a to b). */
export function dots(doc: Doc, x: number, y: number, w: number, rows: { label: string; a: number; b: number; col: string; right?: string; o?: O; hi?: boolean }[], o: { min: number; max: number; step: number; lw?: number; rw?: number; rowH?: number; arrow?: boolean; ref?: number; show?: boolean; ticks?: boolean }) {
  const lw = o.lw ?? 60, rw = o.rw ?? 0, L = x + lw + 20, R = x + w - rw - 26, rh = o.rowH ?? 28, B = y + rows.length * rh, sx = (v: number) => L + ((v - o.min) / (o.max - o.min)) * (R - L);
  if (o.ticks) for (let v = o.min; v <= o.max + 1e-9; v += o.step) lab7(doc, num(v, 0), sx(v) - 12, B + 2, { w: 24, align: "center", color: C.muted });
  if (o.ref !== undefined) { doc.moveTo(sx(o.ref), y).lineTo(sx(o.ref), B).dash(1.5, { space: 2 }).lineWidth(0.6).strokeColor(C.muted).stroke().undash(); lab7(doc, `Even share ${o.ref}`, sx(o.ref) - 35, B + (o.ticks ? 12 : 2), { w: 70, align: "center", color: C.muted }); }
  rows.forEach((r, i) => {
    const cy = y + i * rh + rh / 2, xa = sx(r.a), xb = sx(r.b), d = xb >= xa ? 1 : -1;
    doc.moveTo(L - 10, cy).lineTo(R + 10, cy).lineWidth(0.4).strokeColor(C.grid).stroke();
    if (r.o) oname(doc, r.o, x, cy - 5, lw + 16); else lab7(doc, r.label, x, cy - 5, { b: true, w: lw + 16 });
    if (o.arrow) {
      if (Math.abs(xb - xa) > 8) doc.moveTo(xa + d * 4, cy).lineTo(xb - d * 6, cy).lineWidth(2.5).strokeColor(r.col).stroke();
      doc.polygon([xb, cy], [xb - d * 8, cy - 5], [xb - d * 8, cy + 5]).fill(r.col); doc.circle(xa, cy, 4.5).lineWidth(2).fillAndStroke(C.paper, r.col);
      if (o.show !== false) { lab7(doc, num(r.a, 1), d > 0 ? xa - 38 : xa + 8, cy - 5, { w: 30, align: d > 0 ? "right" : "left", color: C.muted }); lab7(doc, num(r.b, 1), d > 0 ? xb + 5 : xb - 37, cy - 5, { w: 32, align: d > 0 ? "left" : "right", f: "I7", color: r.col }); }
    } else {
      doc.roundedRect(Math.min(xa, xb), cy - 2.5, Math.abs(xb - xa), 5, 2.5).fill(r.hi ? "#F6B9A6" : "#DDD7CE");
      doc.circle(xa, cy, 5).fill(r.col); doc.circle(xb, cy, 5).lineWidth(2).fillAndStroke(C.paper, r.col);
      if (o.show !== false) { const up = r.a >= r.b; lab7(doc, num(r.a, 1), xa - 15, up ? cy - 17 : cy + 7, { w: 30, align: "center", f: "I7" }); lab7(doc, num(r.b, 1), xb - 15, up ? cy + 7 : cy - 17, { w: 30, align: "center", color: C.muted }); }
    }
    if (r.right) lab7(doc, r.right, x + w - rw, cy - 5, { w: rw, align: "right", f: r.hi ? "I7" : "I4", color: r.hi ? C.brand : C.ink });
  });
  return B + 14;
}
/** Semicircle gauge with band label: centre cx, cy, radius r, value on [lo, hi]. */
export function gauge(doc: Doc, cx: number, cy: number, r: number, v: number, lo: number, hi: number, col: string = C.brand) {
  const arc = (a0: number, a1: number, rr: number) => { const p = (a: number) => [cx + rr * Math.cos(a), cy - rr * Math.sin(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M ${x0} ${y0} A ${rr} ${rr} 0 ${Math.abs(a1 - a0) > Math.PI ? 1 : 0} 1 ${x1} ${y1}`; };
  const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  doc.path(arc(Math.PI, 0, r)).lineWidth(r * 0.28).strokeColor(C.band).stroke();
  if (t > 0) doc.path(arc(Math.PI, Math.PI - t * Math.PI, r)).lineWidth(r * 0.28).strokeColor(col).stroke();
  const ax = cx + (r + r * 0.18) * Math.cos(Math.PI - t * Math.PI), ay = cy - (r + r * 0.18) * Math.sin(Math.PI - t * Math.PI), ix = cx + (r - r * 0.18) * Math.cos(Math.PI - t * Math.PI), iy = cy - (r - r * 0.18) * Math.sin(Math.PI - t * Math.PI);
  doc.moveTo(ix, iy).lineTo(ax, ay).lineWidth(1.5).strokeColor(C.ink).stroke();
}
/** Share ring (donut) of four values, with a centre label. */
export function ring(doc: Doc, cx: number, cy: number, r: number, vals: { v: number; col: string }[], centre: [string, string]) {
  const tot = vals.reduce((a, b) => a + b.v, 0) || 1; let a = -Math.PI / 2;
  for (const s of vals) { const a1 = a + (s.v / tot) * 2 * Math.PI, p = (q: number, rr: number) => `${cx + rr * Math.cos(q)} ${cy + rr * Math.sin(q)}`, ri = r * 0.6;
    doc.path(`M ${p(a, r)} A ${r} ${r} 0 ${a1 - a > Math.PI ? 1 : 0} 1 ${p(a1, r)} L ${p(a1, ri)} A ${ri} ${ri} 0 ${a1 - a > Math.PI ? 1 : 0} 0 ${p(a, ri)} Z`).fill(s.col);
    doc.path(`M ${p(a, r)} A ${r} ${r} 0 ${a1 - a > Math.PI ? 1 : 0} 1 ${p(a1, r)} L ${p(a1, ri)} A ${ri} ${ri} 0 ${a1 - a > Math.PI ? 1 : 0} 0 ${p(a, ri)} Z`).lineWidth(0.75).strokeColor(C.white).stroke(); a = a1; }
  doc.circle(cx, cy, r * 0.6).fill(C.white);
  lab7(doc, centre[0], cx - r * 0.55, cy - 12, { w: r * 1.1, align: "center", b: true });
  tx(doc, centre[1], cx - r * 0.55, cy - 2, { f: "I7", size: 12, lead: 14, w: r * 1.1, align: "center" });
}
/** Radar of four orientations at top, right, bottom, left: Now dashed ink, Preferred brand line, even share dotted square. */
export function radar(doc: Doc, cx: number, cy: number, r: number, now: Record<O, number>, pref: Record<O, number>, max = 40) {
  const ang: Record<O, number> = { ENGAGE: -Math.PI * 0.75, INNOVATE: -Math.PI * 0.25, PERFORM: Math.PI * 0.25, GOVERN: Math.PI * 0.75 };
  const pt = (o: O, v: number): [number, number] => [cx + (r * v / max) * Math.cos(ang[o]), cy + (r * v / max) * Math.sin(ang[o])];
  for (const k of [10, 20, 30, 40]) doc.polygon(...O4.map((o) => pt(o, k))).lineWidth(0.5).strokeColor(C.grid).stroke();
  for (const o of O4) doc.moveTo(cx, cy).lineTo(...pt(o, max)).lineWidth(0.5).strokeColor(C.grid).stroke();
  doc.polygon(...O4.map((o) => pt(o, 25))).dash(1, { space: 2 }).lineWidth(0.75).strokeColor(C.muted).stroke().undash();
  doc.polygon(...O4.map((o) => pt(o, now[o]))).dash(3, { space: 2 }).lineWidth(1).strokeColor(C.ink).stroke().undash();
  doc.polygon(...O4.map((o) => pt(o, pref[o]))).lineWidth(1.5).strokeColor(C.brand).stroke();
  for (const o of O4) { const [px, py] = pt(o, pref[o]); doc.circle(px, py, 2.2).fill(C.brand); const [nx, ny] = pt(o, now[o]); doc.circle(nx, ny, 1.8).fill(C.ink); }
}
