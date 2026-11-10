import PptxGenJS from "pptxgenjs";
import { kpiTargets } from "@pac/cdp-engine";
import type { Model } from "./model";
import type { FullModel } from "./full-model";
import type { LoadedReport } from "../report-data";
import type { Extras } from "../report-extras";
import { CHECK } from "../report-library";
import { EOS_NAMES } from "../report-story";
import { clean } from "./full-model";
import { LOGO_COLOUR, LOGO_WHITE } from "./logos";

// The deck on the approved template (SPEC group 4, 2; owner Q-D8-39, Q-D8-40, Q-D9-26): 16:9, paper slides, a brand section
// label and the colour logo on every slide, one headline finding with one brand number, native PowerPoint charts (editable),
// Inter for labels and numbers, Georgia for prose. Headline 24 pt, body 14 pt, tables 12 pt, chart text 10 pt at least.
// Every number is read from the frozen score object, the stored evaluation, plan and extras.
const C = { brand: "EA5732", ink: "131313", muted: "727070", paper: "FAF7F2", surface: "FBE9E3", accent: "8F3A24", white: "FFFFFF", grid: "DDDDDD", neg: "C0392B", pos: "2E86C1", hit: "2F6F40", partial: "C77C0E", miss: "A93226" };
const O4 = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"] as const;
type O = (typeof O4)[number];
const HUE: Record<O, string> = { ENGAGE: "2E86C1", INNOVATE: "6C3483", PERFORM: "C0392B", GOVERN: "58A55C" };
const ONAME: Record<O, string> = { ENGAGE: "Engage", INNOVATE: "Innovate", PERFORM: "Perform", GOVERN: "Govern" };
const UI = { fontFace: "Inter" }, PROSE = { fontFace: "Georgia" };
const PT = 1 / 72, L = 48 * PT, R = 912 * PT, W = R - L;   // inches: 13.33 x 7.5 slide, 48 pt margins
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the frozen payload as stored (strings for every Decimal)
type S = Record<string, any>;
const n = (v: unknown) => (v === null || v === undefined || v === "" ? NaN : Number(v));
const num = (v: number, d = 2) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
const sgn = (v: number, d = 2) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
const human = (t: string) => { const z = String(t ?? "").toLowerCase().replace(/_/g, " "); return z.charAt(0).toUpperCase() + z.slice(1); };
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export async function buildPptx(m: Model, full?: FullModel | null, l?: LoadedReport, x?: Extras): Promise<Buffer> {
  const p = new PptxGenJS();
  p.subject = m.trace;   // version and hashes in the file properties only (owner Q-ER9)
  p.layout = "LAYOUT_WIDE";
  p.title = `${m.org}: Culture Dynamics Profile`;
  p.company = "Priority Activator Consulting";
  const s = (l?.score ?? {}) as unknown as S, os = s.orientation_scores ?? { now: {}, preferred: {}, gap: {} }, rd = s.readiness ?? {}, a = s.analytics ?? {};
  const now = Object.fromEntries(O4.map((o) => [o, n(os.now[o])])) as Record<O, number>, pref = Object.fromEntries(O4.map((o) => [o, n(os.preferred[o])])) as Record<O, number>, gap = Object.fromEntries(O4.map((o) => [o, n(os.gap[o])])) as Record<O, number>;
  const byNow = [...O4].sort((p0, q) => now[q] - now[p0]), lead = byNow[0], second = byNow[1], lastO = byNow[3];
  const upMost = [...O4].sort((p0, q) => gap[q] - gap[p0])[0];
  const checks = (l?.evaluation?.checks ?? {}) as Record<string, string>, CK = ["C1", "C2", "C3", "C4"].filter((k) => checks[k]), hits = CK.filter((k) => checks[k] === "HIT").length;
  const exec = s.cohorts?.executive, staff = s.cohorts?.staff, pg = (s.perception_gap ?? null) as S | null, pgTop = pg ? [...O4].sort((p0, q) => n(pg[q]) - n(pg[p0]))[0] : null;
  const eos = (i: number) => n(s.eos?.[`Q${i + 1}`]), neg = EOS_NAMES.map((nm, i) => ({ nm, v: eos(i) })).filter((z) => z.v < 0).sort((p0, q) => p0.v - q.v);
  const secs = (l?.rep.sections_json ?? {}) as Record<string, string>, accd = (l?.rep.accepted_json ?? {}) as Record<string, unknown>;
  /** The consultant accepted AI headline for a chapter (prompt v2), else the data written one. */
  const aiHead = (k: string, fallback: string) => { const t = secs[`ai_${k}`] && `ai_${k}` in accd ? /^HEADLINE:\s*(.+)$/m.exec(secs[`ai_${k}`])?.[1] : null; return t ? t.replace(/(^|[\s(])-(?=\d)/g, "$1−") : fallback; };
  let page = 0;

  /** A content slide: paper, section label, colour logo, footer rule, footer line and slide number (SPEC group 4, 2). */
  const slide = (label: string, head: string, hi?: string) => {
    const sl = p.addSlide(); page++;
    sl.background = { color: C.paper };
    sl.addText(label.toUpperCase(), { x: L, y: 28 * PT, w: 8, h: 12 * PT, fontSize: 10, bold: true, color: C.brand, charSpacing: 0.6, margin: 0, ...UI });
    sl.addImage({ data: `image/png;base64,${LOGO_COLOUR}`, x: R - (22 * PT * 591) / 221, y: 22 * PT, w: (22 * PT * 591) / 221, h: 22 * PT });
    // one brand number in the headline (owner rule): the first number that matches `hi` is coloured
    const at = hi ? head.indexOf(hi) : -1;
    const runs = at < 0 ? [{ text: head, options: { color: C.ink } }] : [{ text: head.slice(0, at), options: { color: C.ink } }, { text: hi!, options: { color: C.brand, bold: true } }, { text: head.slice(at + hi!.length), options: { color: C.ink } }];
    sl.addText(runs, { x: L, y: 64 * PT, w: W, h: 72 * PT, fontSize: head.length > 120 ? 19 : head.length > 95 ? 21 : 24, valign: "top", margin: 0, fit: "none", ...UI });   // two lines at most (deck.headline)
    sl.addShape("line", { x: L, y: 508 * PT, w: W, h: 0, line: { color: C.brand, width: 0.75 } });
    sl.addText(`Confidential. Prepared for ${m.org} · Released ${m.released || "(to be confirmed)"}`, { x: L, y: 514 * PT, w: 8, h: 14 * PT, fontSize: 9, color: C.muted, margin: 0, ...UI });
    sl.addText(String(page), { x: R - 1, y: 514 * PT, w: 1, h: 14 * PT, fontSize: 9, bold: true, color: C.ink, align: "right", margin: 0, ...UI });
    return sl;
  };
  const kicker = (sl: PptxGenJS.Slide, t: string, x0: number, y0: number, w0: number) => {
    sl.addText(t.toUpperCase(), { x: x0, y: y0, w: w0, h: 0.2, fontSize: 10, bold: true, color: C.brand, charSpacing: 0.6, margin: 0, ...UI });
    sl.addShape("line", { x: x0, y: y0 + 0.24, w: w0, h: 0, line: { color: C.ink, width: 0.5 } });
  };
  const soWhat = (sl: PptxGenJS.Slide, t: string, x0: number, y0: number, w0: number, h0 = 0.95) => {
    sl.addShape("rect", { x: x0, y: y0, w: w0, h: h0, fill: { color: C.surface }, line: { color: C.surface } });
    sl.addShape("rect", { x: x0, y: y0, w: w0, h: 0.03, fill: { color: C.brand }, line: { color: C.brand } });
    sl.addText("SO WHAT", { x: x0 + 0.15, y: y0 + 0.1, w: 2, h: 0.2, fontSize: 10, bold: true, charSpacing: 0.6, color: C.ink, margin: 0, ...UI });
    sl.addText(t, { x: x0 + 0.15, y: y0 + 0.32, w: w0 - 0.3, h: h0 - 0.38, fontSize: 14, color: C.ink, valign: "top", margin: 0, ...PROSE });
  };
  /** Finding, Evidence, Consequence, Action as run in lines (deck.body). */
  const fec = (sl: PptxGenJS.Slide, rows: [string, string][], x0: number, y0: number, w0: number, h0: number) =>
    sl.addText(rows.filter(([, v]) => v).flatMap(([k, v]) => [{ text: `${k}. `, options: { bold: true } }, { text: v, options: { breakLine: true } }, { text: " ", options: { fontSize: 6, breakLine: true } }]), { x: x0, y: y0, w: w0, h: h0, fontSize: 14, color: C.ink, valign: "top", margin: 0, paraSpaceAfter: 4, ...PROSE });
  const head = (cells: string[]) => cells.map((t, i) => ({ text: t, options: { bold: true, color: C.white, fill: { color: C.ink }, fontSize: 12, align: (i ? "right" : "left") as "right" | "left", ...UI } }));
  const row = (cells: (string | { t: string; fill?: string; color?: string; b?: boolean })[], band: boolean, left = 1) => cells.map((c0, i) => { const c = typeof c0 === "string" ? { t: c0 } : c0;
    return { text: c.t, options: { color: c.color ?? C.ink, bold: i === 0 || !!c.b, fill: { color: c.fill ?? (band ? C.surface : C.white) }, fontSize: 12, align: (i < left ? "left" : "right") as "right" | "left", ...UI } }; });
  const table = (sl: PptxGenJS.Slide, h: string[], rows: (string | { t: string; fill?: string; color?: string; b?: boolean })[][], x0: number, y0: number, colW: number[], left = 1) =>
    sl.addTable([head(h), ...rows.map((r, i) => row(r, i % 2 === 1, left))], { x: x0, y: y0, w: colW.reduce((t, v) => t + v, 0), colW, margin: [4, 8, 4, 8], border: { type: "solid", color: C.grid, pt: 0.5 }, rowH: 0.32 });
  const chartBase = { catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, dataLabelFontSize: 10, legendFontSize: 11, catAxisLabelFontFace: "Inter", valAxisLabelFontFace: "Inter", dataLabelFontFace: "Inter", legendFontFace: "Inter", valGridLine: { style: "none" as const }, catAxisLineShow: true, showValue: true };

  // ================================================================ 1 title (owner Q-D8-40: the diagonal bar, as on the report cover)
  const t = p.addSlide(); page++;
  t.background = { color: C.brand };
  t.addShape("custGeom" as PptxGenJS.ShapeType, { x: 10.6, y: 4.4, w: 2.73, h: 3.1, fill: { color: C.accent }, line: { color: C.accent }, points: [{ x: 2.73, y: 0 }, { x: 2.73, y: 0.6 }, { x: 0.6, y: 3.1 }, { x: 0, y: 3.1 }, { close: true }] } as never);
  t.addImage({ data: `image/png;base64,${LOGO_WHITE}`, x: L, y: L, w: (48 * PT * 568) / 213, h: 48 * PT });
  t.addText("CULTURE DYNAMICS PROFILE", { x: L, y: 2.9, w: 9, h: 0.25, fontSize: 10, bold: true, charSpacing: 0.6, color: C.ink, margin: 0, ...UI });
  t.addText(m.org, { x: L, y: 3.2, w: 10, h: 0.75, fontSize: 40, bold: true, color: C.white, margin: 0, ...UI });
  t.addText("Results and priorities", { x: L, y: 4.0, w: 10, h: 0.45, fontSize: 24, color: C.white, margin: 0, ...UI });
  t.addText(`${n(s.counts?.now) || ""} of ${x?.invited ?? n(s.counts?.now)} invited answered · ${exec?.n ?? "n/a"} executives, ${staff?.n ?? "n/a"} staff · Released ${m.released || "(to be confirmed)"}`, { x: L, y: 452 * PT, w: 10, h: 0.3, fontSize: 12, color: C.ink, margin: 0, ...UI });
  t.addText("Confidential", { x: L, y: 6.9, w: 4, h: 0.25, fontSize: 9, color: C.ink, margin: 0, ...UI });

  if (!l) return (await p.write({ outputType: "nodebuffer" })) as Buffer;   // non organisational reports keep the title only

  // ================================================================ 2 executive summary
  {
    const sl = slide("Executive summary", aiHead("summary", `${ONAME[lead]} leads the culture at ${num(now[lead])} points, yet people want ${ONAME[upMost]} to rise by ${num(gap[upMost])} points.`), num(gap[upMost]));
    const tiles: [string, string, string][] = [["Leading orientation", num(now[lead]), `${ONAME[lead]}, ${num(now[lead] - now[second])} ahead of ${ONAME[second]}`], ["Largest shift wanted", sgn(gap[upMost]), `${ONAME[upMost]}, ${num(now[upMost])} to ${num(pref[upMost])}`],
      ["Strategy checks met", `${hits} of ${CK.length || 4}`, CK.map((k) => `${k} ${human(checks[k])}`).join(", ")], ["Culture Risk Index", a.risk ? String(Math.round(n(a.risk.index))) : "n/a", a.risk ? `${human(a.risk.band)} band; lower is better` : ""]];
    tiles.forEach(([k, v, c0], i) => { const w0 = (W - 0.6) / 4, x0 = L + i * (w0 + 0.2);
      sl.addShape("rect", { x: x0, y: 2.0, w: w0, h: 1.5, fill: { color: C.white }, line: { color: C.white } });
      sl.addText(k.toUpperCase(), { x: x0 + 0.15, y: 2.12, w: w0 - 0.3, h: 0.25, fontSize: 10, bold: true, charSpacing: 0.5, color: C.ink, margin: 0, ...UI });
      sl.addText(v, { x: x0 + 0.15, y: 2.4, w: w0 - 0.3, h: 0.55, fontSize: 30, bold: true, color: C.ink, margin: 0, ...UI });
      sl.addText(c0, { x: x0 + 0.15, y: 3.0, w: w0 - 0.3, h: 0.4, fontSize: 11, italic: true, color: C.muted, margin: 0, valign: "top", ...PROSE }); });
    kicker(sl, "Three things to act on", L, 3.75, W);
    const three: [string, string][] = [
      [checks.C1 === "MISS" ? "Strategy fit is a miss" : "Strategy fit", `${ONAME[lastO]} is the weakest orientation at ${num(now[lastO])}; people would raise it to ${num(pref[lastO])}.`],
      ...(pg && pgTop ? [["Executives and staff see two organisations", `${ONAME[pgTop]} is ${num(n(pg[pgTop]))} points apart: executives ${num(n(exec.now[pgTop]))}, staff ${num(n(staff.now[pgTop]))}.`] as [string, string]] : []),
      ...(neg.length ? [[`${neg.length} of 8 voice scores below zero`, `${neg[0].nm} is lowest at ${num(neg[0].v, 0)}; ${list(neg.slice(1).map((z) => num(z.v, 0)))} follow.`] as [string, string]] : []),
    ];
    three.slice(0, 3).forEach(([h0, b0], i) => { const w0 = (W - 0.4) / 3, x0 = L + i * (w0 + 0.2);
      sl.addText(h0, { x: x0, y: 4.15, w: w0, h: 0.5, fontSize: 14, bold: true, color: C.ink, margin: 0, valign: "top", ...UI });
      sl.addText(b0, { x: x0, y: 4.7, w: w0, h: 1.0, fontSize: 14, color: C.ink, margin: 0, valign: "top", ...PROSE }); });
    soWhat(sl, `The strategy needs ${ONAME[lastO]}, yet the culture rewards ${ONAME[lead]} at ${num(now[lead])}. Close that gap first.`, L, 5.8, W, 0.95);
  }

  // ================================================================ 3 the culture now: Now and Preferred by orientation (native clustered chart)
  {
    const sl = slide("03 · The culture now", aiHead("current", `${ONAME[lead]} leads the culture now at ${num(now[lead])} points, only ${num(now[lead] - now[second])} ahead of ${ONAME[second]}.`), num(now[lead]));
    kicker(sl, "Orientation profile, Now and Preferred", L, 2.0, 5.6);
    sl.addChart(p.ChartType.bar, O4.map((o) => ({ name: ONAME[o], labels: ["Now", "Preferred"], values: [now[o], pref[o]] })), {
      x: L, y: 2.35, w: 5.6, h: 4.5, barDir: "col", barGrouping: "clustered", chartColors: O4.map((o) => HUE[o]), showLegend: true, legendPos: "b",
      valAxisMinVal: 0, valAxisMaxVal: 40, valAxisMajorUnit: 10, dataLabelFormatCode: "0.0", ...chartBase });
    fec(sl, [["Finding", `${ONAME[lead]} leads at ${num(now[lead])}, with ${ONAME[second]} second at ${num(now[second])}.`], ["Evidence", `People would move ${ONAME[upMost]} to ${num(pref[upMost])} and cut ${ONAME[lead]} to ${num(pref[lead])}.`],
      ["Consequence", "A plan that pushes delivery harder will meet a workforce asking for the opposite."], ["Action", `Build the plan around ${list(O4.filter((o) => gap[o] > 0).map((o) => ONAME[o]))}, and keep the delivery standards customers see.`]], 6.7, 2.0, R - 6.7, 3.6);
    soWhat(sl, `The gap is about how people are led, not what they deliver.`, 6.7, 5.85, R - 6.7, 0.95);
  }

  // ================================================================ 4 the culture gap: diverging bars split by sign (pptxgenjs colours a series, not a point)
  {
    const sl = slide("04 · The culture gap", aiHead("gaps", `People want ${ONAME[upMost]} up by ${num(gap[upMost])} points and ${list(O4.filter((o) => gap[o] < 0).map((o) => ONAME[o]))} down.`), num(gap[upMost]));
    kicker(sl, "Gap by orientation, Preferred minus Now", L, 2.0, 6.2);
    const srt = [...O4].sort((p0, q) => gap[p0] - gap[q]);
    sl.addChart(p.ChartType.bar, [{ name: "Want more", labels: srt.map((o) => ONAME[o]), values: srt.map((o) => (gap[o] > 0 ? gap[o] : 0)) }, { name: "Want less", labels: srt.map((o) => ONAME[o]), values: srt.map((o) => (gap[o] < 0 ? gap[o] : 0)) }], {
      x: L, y: 2.35, w: 6.2, h: 4.5, barDir: "bar", barGrouping: "stacked", chartColors: [C.pos, C.neg], showLegend: true, legendPos: "b", valAxisMinVal: -15, valAxisMaxVal: 15, valAxisMajorUnit: 5, dataLabelFormatCode: "+0.00;−0.00;;", catAxisLabelPos: "low", ...chartBase });
    table(sl, ["Orientation", "Now", "Preferred", "Gap"], O4.map((o) => [ONAME[o], num(now[o]), num(pref[o]), { t: sgn(gap[o]), b: o === upMost }]), 7.2, 2.1, [1.75, 1.0, 1.15, 1.0]);
    soWhat(sl, `The wish is clear and shared: build ${list(O4.filter((o) => gap[o] > 0).map((o) => ONAME[o]))}, ease off ${list(O4.filter((o) => gap[o] < 0).map((o) => ONAME[o]))}.`, 7.2, 5.85, R - 7.2, 0.95);
  }

  // ================================================================ 5 strategy checks: verdict cards (shapes)
  if (CK.length) {
    const sl = slide("05 · Strategy checks", aiHead("checks", `${hits} of ${CK.length} strategy checks ${hits === 1 ? "is a full hit" : "are full hits"}.${checks.C1 === "MISS" ? ` The strategy goal is a miss, with ${ONAME[lastO]} at ${num(now[lastO])}.` : ""}`), checks.C1 === "MISS" ? num(now[lastO]) : undefined);
    const col = (v: string) => (v === "HIT" ? C.hit : v === "PARTIAL_HIT" ? C.partial : C.miss);
    CK.forEach((k, i) => { const w0 = (W - 0.3) / 2, x0 = L + (i % 2) * (w0 + 0.3), y0 = 2.0 + Math.floor(i / 2) * 2.05, f0 = full?.checks.find((c) => c.code === k);
      sl.addShape("rect", { x: x0, y: y0, w: w0, h: 1.85, fill: { color: C.white }, line: { color: C.white } });
      sl.addText(`${k} · ${CHECK[k]?.name ?? k}`.toUpperCase(), { x: x0 + 0.2, y: y0 + 0.15, w: w0 - 0.4, h: 0.25, fontSize: 10, bold: true, charSpacing: 0.5, color: C.ink, margin: 0, ...UI });
      sl.addText(human(checks[k]).toUpperCase(), { x: x0 + 0.2, y: y0 + 0.5, w: 1.8, h: 0.36, fontSize: 11, bold: true, color: C.white, fill: { color: col(checks[k]) }, align: "center", margin: 0, ...UI });
      sl.addText(clean(f0?.result ?? "").split(/(?<=\.)\s/).slice(0, 2).join(" "), { x: x0 + 0.2, y: y0 + 0.98, w: w0 - 0.4, h: 0.8, fontSize: 12, color: C.ink, valign: "top", margin: 0, ...PROSE }); });
  }

  // ================================================================ 6 executives and staff
  if (exec && staff && pg && pgTop) {
    const sl = slide("06 · Executives and staff", aiHead("perception", `Executives rate ${ONAME[pgTop]} ${num(n(pg[pgTop]))} points ${n(exec.now[pgTop]) > n(staff.now[pgTop]) ? "higher" : "lower"} than staff do, the widest gap between the groups.`), num(n(pg[pgTop])));
    kicker(sl, "Executives and staff, Now", L, 2.0, 6.2);
    sl.addChart(p.ChartType.bar, [{ name: `Executives, ${exec.n}`, labels: O4.map((o) => ONAME[o]), values: O4.map((o) => n(exec.now[o])) }, { name: `Staff, ${staff.n}`, labels: O4.map((o) => ONAME[o]), values: O4.map((o) => n(staff.now[o])) }], {
      x: L, y: 2.35, w: 6.2, h: 4.5, barDir: "col", barGrouping: "clustered", chartColors: [C.ink, "B9B4AD"], showLegend: true, legendPos: "b", valAxisMinVal: 0, valAxisMaxVal: 40, valAxisMajorUnit: 10, dataLabelFormatCode: "0.0", ...chartBase });
    table(sl, ["Orientation", "Executives", "Staff", "Gap", "Flag"], O4.map((o) => [ONAME[o], num(n(exec.now[o])), num(n(staff.now[o])), num(n(pg[o])), { t: s.perception_flags?.[o] === "SHADOW_CULTURE" ? "Shadow culture" : "No flag", b: s.perception_flags?.[o] === "SHADOW_CULTURE" }]), 7.2, 2.1, [1.45, 1.15, 0.85, 0.8, 1.45]);
    soWhat(sl, `Executives see ${ONAME[pgTop]} at ${num(n(exec.now[pgTop]))}; staff at ${num(n(staff.now[pgTop]))}. Messages from the top will land as out of touch until that gap is heard.`, 7.2, 5.6, R - 7.2, 1.2);
  }

  // ================================================================ 7 readiness
  if (rd.tps) {
    const sl = slide("07 · Readiness for change", aiHead("readiness", `Readiness for change stands at ${num(n(rd.tps))} out of 5, in the ${human(rd.tps_band ?? "").toLowerCase()} band.`), num(n(rd.tps)));
    kicker(sl, "Readiness, 1 to 5", L, 2.0, 6.2);
    const ms: [string, number][] = [["Readiness overall", n(rd.tps)], ["Digital readiness", n(rd.d7)], ["Psychological safety", n(rd.d8)], ["Adaptive capacity", n(rd.d9)]];
    sl.addChart(p.ChartType.bar, [{ name: "Score", labels: ms.map((z) => z[0]), values: ms.map((z) => z[1]) }], { x: L, y: 2.35, w: 6.2, h: 4.5, barDir: "bar", chartColors: [C.ink], showLegend: false, valAxisMinVal: 1, valAxisMaxVal: 5, valAxisMajorUnit: 1, dataLabelFormatCode: "0.00", ...chartBase });
    table(sl, ["Measure", "Score", "Band"], [["Readiness overall", num(n(rd.tps)), human(rd.tps_band ?? "")], ["Digital readiness", num(n(rd.d7)), rd.d7_band ?? ""], ["Psychological safety", num(n(rd.d8)), rd.d8_band ?? ""], ["Adaptive capacity", num(n(rd.d9)), rd.d9_band ?? ""]], 7.2, 2.1, [2.0, 0.8, 2.4], 1);
    soWhat(sl, "Willingness is there, but the floor is low. Build skills and safety first, then scale the change.", 7.2, 5.85, R - 7.2, 0.95);
  }

  // ================================================================ 8 employee voice: diverging, split by sign
  {
    const sl = slide("08 · Employee voice", aiHead("voice", `${neg.length} of the eight voice scores are below zero${neg[0] ? `; ${neg[0].nm.toLowerCase()} is lowest at ${num(neg[0].v, 0)}` : ""}.`), neg[0] ? num(neg[0].v, 0) : undefined);
    kicker(sl, "Employee voice scores, minus 100 to plus 100", L, 2.0, W);
    const vs = EOS_NAMES.map((nm, i) => ({ nm, v: eos(i) })).sort((p0, q) => p0.v - q.v);
    sl.addChart(p.ChartType.bar, [{ name: "Above zero", labels: vs.map((z) => z.nm), values: vs.map((z) => (z.v > 0 ? z.v : 0)) }, { name: "Below zero", labels: vs.map((z) => z.nm), values: vs.map((z) => (z.v < 0 ? z.v : 0)) }], {
      x: L, y: 2.35, w: 8.0, h: 4.5, barDir: "bar", barGrouping: "stacked", chartColors: [C.pos, C.neg], showLegend: true, legendPos: "b", valAxisMinVal: -50, valAxisMaxVal: 50, valAxisMajorUnit: 25, dataLabelFormatCode: "+0;−0;;", catAxisLabelPos: "low", ...chartBase });
    soWhat(sl, `Critics outnumber supporters on ${neg.length} of the scores. Start the listening on ${neg[0] ? neg[0].nm.toLowerCase() : "the lowest score"}.`, 9.0, 2.35, R - 9.0, 1.6);
  }

  // ================================================================ 9 departments: the heatmap as a table with step fills
  if (x?.depts?.length) {
    const shown = x.depts.filter((d) => !d.suppressed && d.now), other = shown.filter((d) => d.dominant && d.dominant !== lead);
    const sl = slide("09 · Departments", aiHead("departments", `${other.length} of ${shown.length} departments are led by a different orientation from the organisation.`));
    kicker(sl, "Difference from the organisation, in points", L, 2.0, W);
    const step = (v: number) => (v < -8 ? [C.neg, C.white] : v < -4 ? ["E9BAB5", C.ink] : v <= 4 ? [C.white, C.ink] : v <= 8 ? ["B6D5E9", C.ink] : [C.pos, C.white]);
    table(sl, ["Department", "People", ...O4.map((o) => ONAME[o]), "Leads"], x.depts.map((d) => [d.label, String(d.n ?? ""), ...O4.map((o) => { if (d.suppressed || !d.now) return { t: "Not shown", fill: "EEEEEE" }; const v = n(d.now[o]) - now[o], [f0, c0] = step(v); return { t: sgn(v, 1), fill: f0, color: c0, b: Math.abs(v) > 8 }; }), { t: d.suppressed ? "" : ONAME[d.dominant as O] ?? "" }]), L, 2.4, [2.9, 1.1, 1.55, 1.55, 1.55, 1.55, 1.7]);
    soWhat(sl, `${list(other.map((d) => d.label))} ${other.length === 1 ? "differs" : "differ"} from the organisation's ${ONAME[lead]} lead. Agree with each head whether the difference fits the work before the programme starts.`, L, 5.6, W, 1.1);
  }

  // ================================================================ 10 leadership 360
  if (x?.leaders) {
    const Ld = x.leaders, g = Object.entries(Ld.growth).sort((p0, q) => q[1] - p0[1])[0]?.[0] as O | undefined, dft = Object.entries(Ld.defaults).sort((p0, q) => q[1] - p0[1])[0]?.[0] as O | undefined;
    const sl = slide("10 · Leadership 360 summary", aiHead("leaders", `${Ld.valid} of ${Ld.scored} leaders have a usable 360 result; most default to ${dft ? ONAME[dft] : "n/a"} and the most common growth area is ${g ? ONAME[g] : "n/a"}.`));
    kicker(sl, "Growth areas and default styles, number of leaders", L, 2.0, 7.4);
    sl.addChart(p.ChartType.bar, [{ name: "Growth area", labels: O4.map((o) => ONAME[o]), values: O4.map((o) => Number(Ld.growth[o] ?? 0)) }, { name: "Default style", labels: O4.map((o) => ONAME[o]), values: O4.map((o) => Number(Ld.defaults[o] ?? 0)) }], {
      x: L, y: 2.35, w: 7.4, h: 4.4, barDir: "col", barGrouping: "clustered", chartColors: [C.brand, C.ink], showLegend: true, legendPos: "b", valAxisMinVal: 0, dataLabelFormatCode: "0", ...chartBase });
    soWhat(sl, `Leaders default to ${dft ? ONAME[dft] : "n/a"} while the culture leads with ${ONAME[lead]}. Moving toward ${g ? ONAME[g] : "the growth area"} needs coaching and visible recognition, not a one off course. No leader is named; results are for development only.`, 8.4, 2.35, R - 8.4, 2.2);
  }

  // ================================================================ 11 priorities
  if (x?.plan?.priorities.length) {
    const pris = x.plan.priorities.slice(0, 3);
    const sl = slide("12 · What to do next", `${pris.length} priorities, in order. Start with the ${num(Math.abs(gap[pris[0].orientation as O]))} point gap on ${ONAME[pris[0].orientation as O]}.`, num(Math.abs(gap[pris[0].orientation as O])));
    pris.forEach((pri, i) => { const o = pri.orientation as O, act = x.plan!.actions.filter((z) => z.priority_id === pri.priority_id).sort((u, v) => Number(v.priority_score ?? 0) - Number(u.priority_score ?? 0))[0];
      const w0 = (W - 0.4) / 3, x0 = L + i * (w0 + 0.2);
      sl.addShape("rect", { x: x0, y: 2.0, w: w0, h: 4.75, fill: { color: C.white }, line: { color: C.white } }); sl.addShape("rect", { x: x0, y: 2.0, w: w0, h: 0.03, fill: { color: C.brand }, line: { color: C.brand } });
      sl.addText(`PRIORITY ${i + 1} · ${ONAME[o].toUpperCase()}`, { x: x0 + 0.2, y: 2.15, w: w0 - 0.4, h: 0.25, fontSize: 10, bold: true, charSpacing: 0.5, color: C.ink, margin: 0, ...UI });
      sl.addText(`${gap[o] > 0 ? "Build" : "Rebalance"} ${ONAME[o]}`, { x: x0 + 0.2, y: 2.45, w: w0 - 0.4, h: 0.4, fontSize: 18, bold: true, color: C.ink, margin: 0, ...UI });
      sl.addText([{ text: num(now[o]), options: { color: C.muted } }, { text: "  to  ", options: { color: C.muted, fontSize: 12 } }, { text: num(pref[o]), options: { color: HUE[o], bold: true } }, { text: `   ${sgn(gap[o])}`, options: { color: C.ink, bold: true } }], { x: x0 + 0.2, y: 2.95, w: w0 - 0.4, h: 0.4, fontSize: 16, margin: 0, ...UI });
      sl.addText(act ? clean(`${act.objective}. ${act.intervention}`) : "", { x: x0 + 0.2, y: 3.5, w: w0 - 0.4, h: 2.6, fontSize: 13, color: C.ink, valign: "top", margin: 0, ...PROSE });
      sl.addText(`Owner: ${pri.owner_role ? pri.owner_role.split("+").join(" and ") : "to be confirmed"}`, { x: x0 + 0.2, y: 6.25, w: w0 - 0.4, h: 0.32, fontSize: 11, bold: true, color: C.ink, fill: { color: C.surface }, rectRadius: 0.16, shape: p.ShapeType.roundRect, margin: [0, 8, 0, 8], ...UI }); });
  }

  // ================================================================ 12 KPI scorecard: platform targets (owner Q-D8-28, Q-D8-34)
  {
    const kp: [string, number, "up" | "down", [string, string], number][] = [[`${ONAME[upMost]}, share of the culture`, now[upMost], "up", ["0", "100"], 2], [`${ONAME[lastO]}, share of the culture`, now[lastO], "up", ["0", "100"], 2],
      ...(pg && pgTop ? [[`Executive and staff gap on ${ONAME[pgTop]}`, n(pg[pgTop]), "down", ["0", "100"], 2] as [string, number, "up" | "down", [string, string], number]] : []),
      ...neg.slice(0, 3).map((z) => [`Voice: ${z.nm}`, z.v, "up", ["-100", "100"], 2] as [string, number, "up" | "down", [string, string], number]),
      ...(rd.tps ? [["Readiness, 1 to 5", n(rd.tps), "up", ["1", "5"], 2] as [string, number, "up" | "down", [string, string], number]] : []),
      ...(a.risk ? [["Culture Risk Index, lower is better", n(a.risk.index), "down", ["0", "100"], 0] as [string, number, "up" | "down", [string, string], number]] : [])];
    const sl = slide("13 · Culture KPI scorecard", `${kp.length} measures track the plan. ${ONAME[upMost]} has the furthest to travel, from ${num(now[upMost])} now.`, num(now[upMost]));
    table(sl, ["KPI", "Baseline", "12 month", "18 month"], kp.map(([k, v, dir, sc, d]) => { const [t12, t18] = kpiTargets(String(v), dir, sc, d).map(Number); return [k, num(v, k.startsWith("Voice") ? 0 : d), num(t12, d), { t: num(t18, d), b: true }]; }), L, 2.0, [6.2, 1.9, 1.9, 1.9]);
    sl.addText("Targets are set by the platform and may be changed by the Culture Practitioner before release.", { x: L, y: 2.0 + 0.32 * (kp.length + 1) + 0.12, w: W, h: 0.3, fontSize: 9, italic: true, color: C.muted, margin: 0, ...PROSE });
  }

  // ================================================================ 13 roadmap: three phases and the milestones
  {
    const sl = slide("12 · Phase plan", "Three phases over 18 months, with the culture measured again at months 12 and 18.");
    ([["Months 1 to 3", "Listen and respond", "Listening round and a written executive response; the first priority starts."], ["Months 4 to 9", "Pilot and connect", "Pilots on the next priorities; boundary sessions between departments; pulses at months 3 and 6."], ["Months 10 to 18", "Scale and embed", "Scale what worked; build the new behaviour into goals and recognition; reassess at 12 and 18."]] as const).forEach(([k, t0, b0], i) => {
      const w0 = (W - 0.4) / 3, x0 = L + i * (w0 + 0.2);
      kicker(sl, k, x0, 2.0, w0);
      sl.addText(t0, { x: x0, y: 2.4, w: w0, h: 0.4, fontSize: 18, bold: true, color: C.ink, margin: 0, ...UI });
      sl.addText(b0, { x: x0, y: 2.9, w: w0, h: 1.6, fontSize: 14, color: C.ink, valign: "top", margin: 0, ...PROSE }); });
    const mx = (mm: number) => L + (W * mm) / 18;
    sl.addShape("line", { x: L, y: 5.4, w: W, h: 0, line: { color: C.ink, width: 1 } });
    for (const [mm, k] of [[3, "Pulse"], [6, "Pulse"], [12, "Reassess"], [18, "Reassess"]] as const) {
      sl.addShape("diamond", { x: mx(mm) - 0.1, y: 5.3, w: 0.2, h: 0.2, fill: { color: mm >= 12 ? C.ink : C.paper }, line: { color: C.ink, width: 1.5 } });
      sl.addText(`${k}, month ${mm}`, { x: mm === 18 ? mx(mm) - 1.8 : mx(mm) - 0.9, y: 5.6, w: 1.8, h: 0.3, fontSize: 11, bold: true, color: C.ink, align: mm === 18 ? "right" : "center", margin: 0, ...UI }); }
  }

  // ================================================================ 14 back
  const b = p.addSlide();
  b.background = { color: C.brand };
  b.addImage({ data: `image/png;base64,${LOGO_WHITE}`, x: L, y: L, w: (48 * PT * 568) / 213, h: 48 * PT });
  b.addText("Consulting Built for\nReal World Impact", { x: L, y: 3.6, w: 9, h: 1.3, fontSize: 40, bold: true, color: C.white, margin: 0, ...UI });
  b.addText("Priority Activator Consulting · Suite E2, 1st Floor, Jasmine Centre, Westlands, Nairobi · info@pac.africa · www.pac.africa", { x: L, y: 5.2, w: 11, h: 0.3, fontSize: 12, color: C.white, margin: 0, ...UI });
  return (await p.write({ outputType: "nodebuffer" })) as Buffer;
}
