// DRAFT9 (DRAFT8 plus owner Q-D9-1 to Q-D9-22): the full organisational report on the approved template (docs/design-agent/template, CDP Report Template Pack,
// owner Q-D8-1 to Q-D8-45). Findings first: every page opens with a headline finding that cites the client's numbers, then the
// charts, the table and one "So what". Definitions live in the glossary. Every number is read from the frozen score object,
// the stored evaluation, plan and extras; nothing is computed here beyond choosing and ordering values already frozen.
import { kpiTargets } from "@pac/cdp-engine";
import type { LoadedReport } from "../report-data";
import type { Extras } from "../report-extras";
import type { Model } from "./model";
import { CHECK as CHECK0, DIMENSION, FACILITATION, NON_NEGOTIABLES, READINESS } from "../report-library";
import { clean } from "./full-model";
import { GLOSSARY, EOS_NAMES } from "../report-story";
import { LOGO_CDP, LOGO_COLOUR, LOGO_WHITE } from "./logos";
import { C, CW, GAP, HALF, HUE, LIMIT, O4, ONAME, PH, PW, TINT, TOP, X0, X1, cap, count, diamond, dots, frame, gauge, h2, hatch, hbars, headline, icon, label7, legend, newDoc, num, opener,
  panel, paper, radar, rbar, oname, section, sgn, soWhat, starCol, starRows, table, th, tw, tx, verdictTile, vbars, type O, type Row } from "./pdf-kit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the frozen payload as stored (strings for every Decimal)
type S = Record<string, any>;
// library wording as the client reads it: no hyphens, plain names (the same clean() the earlier report used)
const CHECK = Object.fromEntries(Object.entries(CHECK0).map(([k, v]) => [k, { ...v, risk: clean(v.risk), intervention: clean(v.intervention) }])) as typeof CHECK0;
const n = (v: unknown) => (v === null || v === undefined || v === "" ? NaN : Number(v));
const d2 = (v: unknown) => num(n(v), 2), d1 = (v: unknown) => num(n(v), 1);
const human = (t: string) => cap(String(t ?? "").toLowerCase().replace(/_/g, " "));
const DIMS = ["D1", "D2", "D3", "D4", "D5", "D6"] as const;
const R3 = ["D7", "D8", "D9"] as const;
const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const role = (r: string) => r.split("+").map((z) => (/^[A-Za-z]{2,5}$/.test(z.trim()) && z.trim() === z.trim().toUpperCase() ? z.trim().toUpperCase() : human(z.trim()))).join(" and ");
const horizon = (h: string) => human(h).replace(/^Quick win /, "").replace(/(\d+) (\d+)\s?m$/, "$1 to $2 months").replace(/(\d+)m$/, "$1 months");
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

interface Toc { num: string; title: string; page: number; subs: { n: string; title: string; page: number }[] }

export function buildTemplatePdf(l: LoadedReport, x: Extras, m: Model, brief = false): Promise<Buffer> {
  const s = l.score as unknown as S, e = l.evaluation, os = s.orientation_scores, rd = s.readiness ?? {}, a = s.analytics ?? {};
  const org = l.tenantName ?? "The organisation", released = m.released || "(to be confirmed)";
  const now = Object.fromEntries(O4.map((o) => [o, n(os.now[o])])) as Record<O, number>, pref = Object.fromEntries(O4.map((o) => [o, n(os.preferred[o])])) as Record<O, number>, gap = Object.fromEntries(O4.map((o) => [o, n(os.gap[o])])) as Record<O, number>;
  const byNow = [...O4].sort((p, q) => now[q] - now[p]), lead = byNow[0], second = byNow[1], lastO = byNow[3];
  const byGap = [...O4].sort((p, q) => Math.abs(gap[q]) - Math.abs(gap[p])), upMost = [...O4].sort((p, q) => gap[q] - gap[p])[0], downMost = [...O4].sort((p, q) => gap[p] - gap[q])[0];
  const checks = (e?.checks ?? {}) as Record<string, string>, ck = Object.entries(checks);
  const hits = ck.filter(([, v]) => v === "HIT").length, partials = ck.filter(([, v]) => v === "PARTIAL_HIT").length, misses = ck.filter(([, v]) => v === "MISS").length;
  const exec = s.cohorts?.executive, staff = s.cohorts?.staff, pg = (s.perception_gap ?? null) as S | null;
  const pgTop = pg ? [...O4].sort((p, q) => n(pg[q]) - n(pg[p]))[0] : null;
  const shadow = O4.filter((o) => s.perception_flags?.[o] === "SHADOW_CULTURE");
  const eos = (i: number) => n(s.eos?.[`Q${i + 1}`]), det = (s.eos_detail ?? {}) as S;
  const negVoice = EOS_NAMES.map((nm, i) => ({ nm, v: eos(i), i })).filter((z) => z.v < 0).sort((p, q) => p.v - q.v);
  const adv = (x.advice ?? []).filter((v) => v.level !== "LEADER");
  const advFor = (o: string) => { const v = adv.find((z) => z.section.startsWith("gaps.") && z.section.includes(o) && (z.actions.length || z.risks.length)); return v ? { ...v, risks: v.risks.map(clean), actions: v.actions.map((z) => ({ ...z, text: clean(z.text) })), signal: clean(v.signal ?? "") } : undefined; };
  const themes = (() => { try { return JSON.parse(String((l.rep.sections_json as Record<string, string>)?.themes ?? "null")) as { n: number; items: { theme: string; share: number; says: string; tone?: string }[] } | null; } catch { return null; } })();
  const depts = (x.depts ?? []).filter((d) => !d.suppressed && d.now);
  const P = x.plan, L = x.leaders;
  const nResp = n(s.counts?.now), invited = x.invited ?? null;
  const signalOf = (v: number) => (v > 0 ? "Positive" : v < 0 ? "Critical" : "Neutral");

  const real = newDoc({ Title: `${org}: Culture Dynamics Profile${brief ? ", executive brief" : ""}`, Subject: brief ? "Executive brief" : "Organisational culture report", Keywords: m.trace });
  // brief mode: the pages the brief leaves out go to a scratch document; `show(false)` sends drawing there until the next `show(true)`
  const scratch = brief ? newDoc({ Title: "", Subject: "", Keywords: "" }) : real;
  let doc = real;
  const show = (on: boolean) => { doc = on || !brief ? real : scratch; };
  
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => { real.on("data", (c: Buffer) => chunks.push(c)).on("end", () => resolve(Buffer.concat(chunks))).on("error", reject); });
  const logoC = Buffer.from(LOGO_COLOUR, "base64"), logoW = Buffer.from(LOGO_WHITE, "base64"), logoCdp = Buffer.from(LOGO_CDP, "base64");
  const toc: Toc[] = [];
  const pageNo = () => doc.bufferedPageRange().count;
  const realNo = () => real.bufferedPageRange().count;
  const addPage = () => { doc.addPage(); paper(doc); };
  /** Start a chapter: opener and headline. Returns the content start. */
  const chapter = (num0: string, title: string, segs: { t: string; hi?: boolean }[]) => {
    addPage(); toc.push({ num: num0, title, page: pageNo(), subs: [] });
    const k = KEYOF[title], A = ai(k); soKey = A.s ? k : undefined;
    const y = opener(doc, num0, title) + 16;
    return segs.length ? headline(doc, A.h ? aiSegs(A.h, segs.some((z) => z.hi)) : segs, y) + 16 : y;
  };
  /** A continuation page with its own numbered section heading. */
  const cont = (title: string, segs: string, first = false) => {
    const t = toc[toc.length - 1], k = t.subs.length + 1, nn = `${t.num.replace(/^0/, "")}.${k}`;
    if (first) { t.subs.push({ n: nn, title, page: pageNo() }); return 0; }
    addPage(); t.subs.push({ n: nn, title, page: pageNo() });
    const ck = KEYOF[title], A = ai(ck); soKey = A.s ? ck : undefined;
    const y = section(doc, nn, title) + 8;
    return headline(doc, [{ t: A.h ?? segs }], y) + 16;
  };
  // AI lines (prompt v2, owner Q-D9-3): an accepted draft replaces the rule written headline and the first So what of its page
  const secs = (l.rep.sections_json ?? {}) as Record<string, string>, accd = (l.rep.accepted_json ?? {}) as Record<string, unknown>;
  const KEYOF: Record<string, string> = { "Executive summary": "summary", "The culture now": "current", "The six dimensions": "dimensions", "The culture gap": "gaps", "Strategy checks": "checks", "Executives and staff": "perception",
    "Readiness and risk": "readiness", "Culture Risk Index": "risk", "Employee voice": "voice", "Departments": "departments", "Leadership 360 summary": "leaders", "What this means": "meaning", "Culture KPI scorecard": "kpis" };   // no roadmap: its draft is written before the plan exists (rules 2.2)
  const ai = (key?: string) => {
    const t = key && secs[`ai_${key}`] && `ai_${key}` in accd ? secs[`ai_${key}`] : "";
    const fix = (z?: string) => z?.trim().replace(/(^|[\s(])-(?=\d)/g, "$1\u2212");
    return { h: fix(/^HEADLINE:\s*(.+)$/m.exec(t)?.[1]), s: fix(/^SO WHAT:\s*(.+)$/m.exec(t)?.[1]) };
  };
  const aiSegs = (h: string, hi: boolean) => { const mm = hi ? /[+\u2212]?\d+(?:\.\d+)?/.exec(h) : null; return mm ? [{ t: h.slice(0, mm.index) }, { t: mm[0], hi: true }, { t: h.slice(mm.index + mm[0].length) }] : [{ t: h }]; };
  let soKey: string | undefined;
  const so = (t: string, y: number) => { const k = soKey; soKey = undefined; return soWhat(doc, ai(k).s ?? t, y) + GAP; };

  // ================================================================ 1 cover
  show(false);
  doc.rect(0, 0, PW, 380).fill(C.brand);
  doc.save().polygon([PW, 236], [PW, 268], [PW - 120, 380], [PW - 152, 380]).fill(C.accent).restore();
  doc.rect(0, 380, PW, PH - 380).fill(C.paper);
  doc.image(logoW, 48, 64, { height: 46 });
  tx(doc, "Prepared for", 48, 268, { f: "I7", size: 8, lead: 10, color: C.white, caps: true, cs: 0.5 });
  tx(doc, org, 48, 284, { f: "I7", size: 36, lead: 40, color: C.white, w: 440 });
  doc.image(logoCdp, 48, 450, { width: 130 });
  tx(doc, "Full assessment report", 48, 556, { f: "I6", size: 14, lead: 19 });
  doc.moveTo(48, 610).lineTo(X1, 610).lineWidth(0.75).strokeColor(C.brand).stroke();
  ([["Respondents", `${nResp} of ${invited ?? nResp} invited`, `${exec?.n ?? "n/a"} executives, ${staff?.n ?? "n/a"} staff`], ["Assessment date", m.released || "To be confirmed", "Supplied by the platform"],
    ["Instrument", "Culture Dynamics Profile", "Four orientations, six dimensions"], ["Reference", "PAC/CDP/RPT/NNN", "Number supplied by the platform"]] as const).forEach(([k, v, c], i) => {
    const cx = 48 + i * 128.82;
    tx(doc, k, cx, 622, { f: "I7", size: 7, lead: 9, caps: true, cs: 0.5 });
    tx(doc, v, cx, 636, { f: "I6", size: 9, lead: 12, w: 118 }); tx(doc, c, cx, 662, { f: "SI", size: 7.5, lead: 10, color: C.muted, w: 118 });
  });
  tx(doc, "Confidential", 48, 800, { f: "I4", size: 7.5, lead: 10, color: C.muted }); tx(doc, "www.pac.africa", 447.28, 800, { f: "I4", size: 7.5, lead: 10, color: C.muted, w: 100, align: "right" });

  // ================================================================ 2 about
  addPage();
  let y = tx(doc, "About this report", X0, TOP, { f: "I7", size: 14, lead: 18 }) + 8;
  y = tx(doc, `The Culture Dynamics Profile shows how ${org} works today, how its people want it to work, and where the culture supports or holds back the strategy. It reads culture through four orientations: Engage, Innovate, Perform and Govern.`, X0, y, { w: 330 }) + 6;
  y = tx(doc, `Each chapter leads with a finding, shows the evidence behind it and ends with what it means for ${org}.`, X0, y, { w: 330 }) + 20;
  y = h2(doc, "Document control", y) + 8;
  y = table(doc, { head: ["Field", "Detail"], cols: [0.26, 0.74], right: [], rows: [["Reference", "PAC/CDP/RPT/NNN (number supplied by the platform)"], ["Organisation", org], ["Report", "Culture Dynamics Profile, full assessment report"], ["Audience", m.audience || "To be confirmed"], ["Released", released], ["Prepared by", "Priority Activator Consulting (PAC Africa). Culture Practitioner: to be confirmed"], ["Classification", "Confidential"]] }, y) + 20;
  y = h2(doc, "Participation", y) + 8;
  ([["Invited", String(invited ?? nResp), "People asked to take part"], ["Responded", String(nResp), invited ? `${Math.round((nResp / invited) * 100)} percent of those invited` : "Responses scored"], ["Executives", String(exec?.n ?? "n/a"), "Executive group"], ["Staff", String(staff?.n ?? "n/a"), "Staff group"]] as const).forEach(([k, v, c], i) => {
    const cx = X0 + i * (112.82 + 16.67); panel(doc, cx, y, 112.82, 62);
    tx(doc, k, cx + 10, y + 10, { f: "I6", size: 7, lead: 9, caps: true, cs: 0.5 }); tx(doc, v, cx + 10, y + 22, { f: "I7", size: 20, lead: 22 }); tx(doc, c, cx + 10, y + 46, { f: "SI", size: 7, lead: 9, color: C.ink, w: 95 });
  });
  y += 78;
  const q = s.quality ?? {}, flagsN = Object.values(q.flags ?? {}).reduce((t: number, v) => t + Number(v), 0), med = Number(q.median_duration ?? 0);
  y = tx(doc, `All ${nResp} responses were complete. ${flagsN ? `${flagsN} responses were flagged by the answer quality checks.` : "No response was flagged for speeding, straight lining, uniform allocation or duplicated perspectives."}${med ? ` The median time to complete was ${Math.round(med / 60)} minutes.` : ""}`, X0, y, { w: 400 }) + 16;
  y = h2(doc, "Confidentiality", y) + 6;
  tx(doc, `This report is confidential to ${org} and PAC Africa. Results are shown for groups only, never for a named person. Groups below the reporting threshold are held back.`, X0, y, { w: 400 });

  // ================================================================ 3 to 4 contents (rows drawn at the end)
  addPage(); const tocPage = pageNo(); addPage();

  // ================================================================ executive summary
  const fullHit = hits === 1 ? "only one of four strategy checks is a full hit" : `${count(hits)} of four strategy checks are full hits`;
  y = chapter("ES", "Executive summary", [{ t: `${ONAME[lead]} leads the culture at ${d2(now[lead])} points, yet people want ${ONAME[upMost]} to rise by ` }, { t: sgn(gap[upMost]).replace("+", "") , hi: true }, { t: ` points, and ${fullHit}.` }]);
  const tiles: { k: string; v: string; c: string; hot?: boolean }[] = [
    { k: "Leading orientation", v: d2(now[lead]), c: `${ONAME[lead]}, ${d2(now[lead] - now[second])} points ahead of ${ONAME[second]}` },
    { k: "Largest shift wanted", v: sgn(gap[upMost]), c: `${ONAME[upMost]}, from ${d2(now[upMost])} to ${d2(pref[upMost])}` },
    { k: "Strategy checks met", v: `${hits} of ${ck.length || 4}`, c: `${hits} hit, ${partials} partial ${partials === 1 ? "hit" : "hits"}, ${misses} ${misses === 1 ? "miss" : "misses"}`, hot: hits < (ck.length || 4) / 2 },
    { k: "Culture Risk Index", v: a.risk ? String(Math.round(n(a.risk.index))) : "n/a", c: a.risk ? `${human(a.risk.band)} band; lower is better` : "Not available" },
  ];
  tiles.forEach((t, i) => { const cx = X0 + i * (112.82 + 16.67); doc.roundedRect(cx, y, 112.82, 72, 4).fill(t.hot ? C.brand : C.white); const col = t.hot ? C.white : C.ink;
    tx(doc, t.k, cx + 10, y + 10, { f: "I6", size: 7, lead: 9, color: col, caps: true, cs: 0.5, w: 95 }); tx(doc, t.v, cx + 10, y + 26, { f: "I7", size: 20, lead: 22, color: col }); tx(doc, t.c, cx + 10, y + 50, { f: "SI", size: 7, lead: 9, color: col, w: 95 }); });
  y += 72 + GAP;
  panel(doc, X0, y, HALF, 200, "Culture at a glance"); panel(doc, X0 + HALF + GAP, y, HALF, 200, "Shift from Now to Preferred");
  radar(doc, X0 + HALF / 2, y + 108, 62, now, pref);
  for (const [o, dx, dy, al] of [["ENGAGE", -96, -78, "left"], ["INNOVATE", 40, -78, "right"], ["PERFORM", 40, 66, "right"], ["GOVERN", -96, 66, "left"]] as const) {
    label7(doc, ONAME[o], X0 + HALF / 2 + dx, y + 108 + dy, { w: 56, align: al, b: true }); label7(doc, `${d1(now[o])} to ${d1(pref[o])}`, X0 + HALF / 2 + dx, y + 117 + dy, { w: 56, align: al, color: C.muted });
  }
  legend(doc, [["Now", "dash", C.ink], ["Preferred", "line", C.brand], ["Even share, 25", "dash", C.muted]], X0, y + 204);
  hbars(doc, X0 + HALF + GAP + 12, y + 34, HALF - 24, O4.map((o) => ({ label: ONAME[o], v: gap[o], col: HUE[o], show: sgn(gap[o]) })), { min: -15, max: 15, step: 5, lw: 52, rowH: 30, axis: ["Want less", "Want more"] });
  label7(doc, "Points between Now and Preferred, by orientation", X0 + HALF + GAP + 12, y + 186, { color: C.muted });
  y += 214 + GAP;
  y = h2(doc, "Key indicators", y) + 8;
  const strengthBand = human(s.strength_band ?? ""), cong = s.congruence ?? {};
  const ki: Row[] = [
    ["Culture strength", d2(s.culture_strength), strengthBand, `${ONAME[lead]} leads ${ONAME[second]} by only ${d2(now[lead] - now[second])} points.`],
    ["Largest culture gap", sgn(gap[byGap[0]]), human(a.gap_bands?.[byGap[0]] ?? s.classification?.[byGap[0]] ?? ""), `${gap[byGap[0]] > 0 ? "More" : "Less"} ${ONAME[byGap[0]]} wanted; ${list(O4.filter((o) => gap[o] < 0).map((o) => ONAME[o]))} ${O4.filter((o) => gap[o] < 0).length === 1 ? "is" : "are"} wanted less.`],
    ...(cong.band ? [["Strategy congruence", `${d1(cong.dimension_pct)}%`, human(cong.band), `Practice leans ${ONAME[cong.lens?.PRACTICE as O] ?? ""}, strategy ${ONAME[cong.lens?.STRATEGY as O] ?? ""}, leadership ${ONAME[cong.lens?.LEADERSHIP as O] ?? ""}.`] as Row] : []),
    ...(pg && pgTop ? [["Perception gap", d2(pg[pgTop]), shadow.length ? { t: "Shadow culture", icon: "watch" as const } : "Aligned", `Executives put ${ONAME[pgTop]} at ${d2(exec.now[pgTop])}, staff at ${d2(staff.now[pgTop])}.`] as Row] : []),
    ...(rd.tps ? [["Change readiness", d2(rd.tps), human(rd.tps_band ?? ""), `Readiness scores run from ${d2(Math.min(n(rd.d7), n(rd.d8), n(rd.d9)))} to ${d2(Math.max(n(rd.d7), n(rd.d8), n(rd.d9)))}; support is needed before scale.`] as Row] : []),
    ...(a.risk ? [["Culture Risk Index", String(Math.round(n(a.risk.index))), human(a.risk.band), `Spread of answers, at ${Math.round(n(a.risk.dispersion))}, drives it most.`] as Row] : []),
    ...(s.eos?.index ? [["Employee voice index", d1(s.eos.index), negVoice.length ? { t: `${negVoice.length} of 8 negative`, icon: "watch" as const } : "Positive", `Critics lead on ${count(negVoice.length)} of the eight voice scores.`] as Row] : []),
  ];
  table(doc, { head: ["Indicator", "Score", "Rating", `What it means for ${org}`], cols: [0.2, 0.13, 0.17, 0.5], right: [1], rows: ki }, y);

  // ES page 2: the Big Three
  addPage();
  y = TOP;
  const c1 = Object.entries(checks).find(([, v]) => v === "MISS")?.[0] ?? Object.entries(checks).find(([, v]) => v !== "HIT")?.[0];
  const big: { kind: "MISS" | "FLAG"; word: string; v: string; vl: string; title: string; lines: [string, string][] }[] = [];
  const weakest = lastO;
  if (c1) { const ad = advFor(weakest);
    big.push({ kind: checks[c1] === "MISS" ? "MISS" : "FLAG", word: human(checks[c1]), v: d2(now[weakest]), vl: `${ONAME[weakest]} now, last of four`, title: `Strategy check: the culture does not yet carry the ${lower(CHECK[c1]?.name ?? "strategy")}`,
      lines: [["Finding", `${ONAME[weakest]} is the weakest orientation today, at ${d2(now[weakest])} points, while the strategy depends on it.`], ["Evidence", `It ranks fourth of four. People would raise it to ${d2(pref[weakest])} if they could, a shift of ${sgn(gap[weakest])}.`],
        ["Consequence", ad?.risks[0] ?? CHECK[c1]?.risk ?? ""], ["Action", `${ad?.actions[0]?.text ?? CHECK[c1]?.intervention ?? ""} Owner: ${ad?.actions[0]?.owner_role ?? "executive team"}. Timing: ${ad?.actions[0]?.horizon ?? "first 90 days"}.`]] }); }
  if (pg && pgTop && shadow.length) big.push({ kind: "FLAG", word: "Shadow\nculture", v: d2(pg[pgTop]), vl: `Points apart on ${ONAME[pgTop]}`, title: "Executives and staff describe two different organisations",
    lines: [["Finding", `Executives score ${ONAME[pgTop]} at ${d2(exec.now[pgTop])}; staff score it at ${d2(staff.now[pgTop])}, a gap of ${d2(pg[pgTop])} points.`], ["Evidence", `${count(exec.n)} executives and ${staff.n} staff answered. ${ONAME[pgTop]} is the only orientation flagged; the next widest gap is ${ONAME[[...O4].sort((p, q) => n(pg[q]) - n(pg[p]))[1]]} at ${d2(pg[[...O4].sort((p, q) => n(pg[q]) - n(pg[p]))[1]])}.`],
      ["Consequence", "Change messages from the top risk reading as out of touch and raising cynicism before the programme starts."], ["Action", "Open a direct route for staff views to reach the executive team before the first change message. Owner: chief executive. Timing: before launch."]] });
  if (negVoice.length) { const w0 = negVoice[0], dd = det[`Q${w0.i + 1}`];
    big.push({ kind: "FLAG", word: "Watch", v: `${negVoice.length} of 8`, vl: "Voice scores below zero", title: `Critics outnumber supporters on ${negVoice.length >= 4 ? "half" : count(negVoice.length)} of the employee voice scores`,
      lines: [["Finding", `${cap(count(negVoice.length))} of the eight employee voice scores are below zero; the lowest, ${lower(w0.nm)}, stands at ${num(w0.v, 0)}.`], ["Evidence", `On the lowest score${dd ? `, ${dd.detractors} of ${dd.n} people are detractors and ${count(dd.promoters)} promoters` : ""}. The others sit at ${list(negVoice.slice(1).map((z) => num(z.v, 0)))}.`],
        ["Consequence", "A change programme would start with more doubt than backing in these areas."], ["Action", "Run listening sessions on the lowest scores and report back the changes made. Owner: People and Culture lead. Timing: first 60 days."]] }); }
  for (const b of big.slice(0, 3)) {
    const lw = 128, rx = X0 + lw + 12, rw = CW - lw - 24;
    const hh = 12 + 18 + b.lines.reduce((t, [, v]) => t + th(doc, v, rw - 72) + 4, 0) + 8;
    doc.rect(X0, y, CW, hh).fill(C.white); doc.rect(X0, y, CW, 1.5).fill(C.brand);
    verdictTile(doc, b.kind, b.word, X0 + 12, y + 13.5, 70, b.word.includes("\n") ? 28 : 18);
    tx(doc, b.v, X0 + 12, y + 50, { f: "I7", size: 24, lead: 26 }); tx(doc, b.vl, X0 + 12, y + 80, { f: "I7", size: 7, lead: 9, caps: true, cs: 0.5, w: lw - 12 });
    let ly = tx(doc, b.title, rx, y + 12, { f: "I6", size: 9.5, lead: 13, w: rw }) + 5;
    for (const [k, v] of b.lines) { tx(doc, k, rx, ly, { f: "SB", size: 8.5, lead: 12 }); ly = tx(doc, v, rx + 72, ly, { size: 8.5, lead: 12, w: rw - 72 }) + 4; }
    y += Math.max(hh, ly - y + 8) + GAP;
  }
  so(`The strategy needs ${ONAME[weakest]}, yet the culture rewards ${lower(ONAME[lead])} at ${d2(now[lead])}${pg && pgTop ? `, and leaders and staff see ${ONAME[pgTop]} ${d2(pg[pgTop])} points apart` : ""}. Close that gap first.`, y);

  // ================================================================ brief page 1 (SPEC group 4, 1)
  if (brief) {
    doc = real;
    doc.rect(0, 0, PW, PH).fill(C.paper); doc.rect(0, 0, PW, 152).fill(C.brand);
    doc.image(logoW, 48, 28, { height: 36 });
    tx(doc, "Culture Dynamics Profile", 347.28, 40, { f: "I7", size: 8, lead: 10, w: 200, align: "right", caps: true, cs: 0.5 });
    tx(doc, "Executive brief", 48, 76, { f: "I7", size: 8, lead: 10, caps: true, cs: 0.5 });
    tx(doc, org, 48, 92, { f: "I7", size: 36, lead: 40, color: C.white, w: 440 });
    let by = headline(doc, [{ t: `${ONAME[lead]} leads the culture at ${d2(now[lead])} points, yet people want ${ONAME[upMost]} to rise by ` }, { t: d2(gap[upMost]), hi: true }, { t: ` points, and ${fullHit}.` }], 176) + GAP;
    tiles.forEach((t, i) => { const cx = X0 + i * (112.82 + 16.67); doc.roundedRect(cx, by, 112.82, 72, 4).fill(C.white);
      tx(doc, t.k, cx + 10, by + 10, { f: "I6", size: 7, lead: 9, caps: true, cs: 0.5, w: 95 }); tx(doc, t.v, cx + 10, by + 26, { f: "I7", size: 20, lead: 22 }); tx(doc, t.c, cx + 10, by + 50, { f: "SI", size: 7, lead: 9, w: 95 }); });
    by += 72 + GAP;
    by = h2(doc, "Three things to act on", by) + 8;
    for (const b of big.slice(0, 3)) {
      const lw = 112.82, rx = X0 + lw + 16, rw = CW - lw - 28, line = b.lines[0][1];
      const hh = Math.max(96, 12 + 14 + 4 + th(doc, line, rw, "S", 9, 13) + 6 + th(doc, b.lines[3][1], rw, "S", 9, 13) + 12);
      doc.rect(X0, by, CW, hh).fill(C.white); doc.rect(X0, by, CW, 1.5).fill(C.brand);
      verdictTile(doc, b.kind, b.word, X0 + 12, by + 13.5, 70, b.word.includes("\n") ? 28 : 18);
      tx(doc, b.v, X0 + 12, by + 48, { f: "I7", size: 18, lead: 22 }); tx(doc, b.vl, X0 + 12, by + 72, { f: "I7", size: 6.5, lead: 8, caps: true, cs: 0.4, w: lw - 8 });
      let ly = tx(doc, b.title, rx, by + 12, { f: "I6", size: 10, lead: 14, w: rw }) + 4;
      ly = tx(doc, line, rx, ly, { size: 9, lead: 13, w: rw }) + 6;
      tx(doc, b.lines[3][1], rx, ly, { f: "SI", size: 9, lead: 13, w: rw });
      by += hh + 8;
    }
    soWhat(doc, ai("summary").s ?? `The strategy needs ${ONAME[weakest]}, yet the culture rewards ${lower(ONAME[lead])} at ${d2(now[lead])}. Close that gap first.`, by + 8);
    show(false);
  }

  // ================================================================ 01 how to read this report
  y = chapter("01", "How to read this report", [{ t: "Four orientations describe the culture. Every score is a share of 100 points, so the four always add up to 100 and 25 is an even share." }]);
  y = table(doc, { head: ["Orientation", "What it puts first", "Now", "Preferred"], cols: [0.18, 0.58, 0.12, 0.12], right: [2, 3], rows: O4.map((o) => [ONAME[o], ({ ENGAGE: "People, relationships and belonging", INNOVATE: "New ideas, experiment and change", PERFORM: "Results, targets and competition", GOVERN: "Structure, control and reliable process" })[o], d2(now[o]), d2(pref[o])]) }, y) + GAP;
  y = h2(doc, "Reading the pages", y) + 8;
  const steps = [["Headline", "Each page opens with the finding in one or two lines, with the client's numbers."], ["Charts", "Two charts side by side show the evidence: Now as a pale bar, Preferred as a solid bar."], ["Table", "The numbers behind the charts, with a star on the leading value and a word for each signal."], ["So what", "One short box says what the finding means for the organisation."]];
  panel(doc, X0, y, CW, 150);
  steps.forEach(([k, v], i) => { const cx = X0 + 12 + i * 122.82; doc.circle(cx + 8, y + 20, 8).fill(C.brand); tx(doc, String(i + 1), cx, y + 15.5, { f: "I7", size: 8, lead: 9, w: 16, align: "center" });
    if (i < 3) doc.moveTo(cx + 20, y + 20).lineTo(cx + 118, y + 20).lineWidth(0.75).strokeColor(C.brand).stroke();
    tx(doc, k, cx, y + 38, { f: "I7", size: 8, lead: 10, caps: true, cs: 0.5 }); tx(doc, v, cx, y + 54, { w: 108 }); });
  y += 150 + GAP;
  y = h2(doc, "Signals used in tables", y) + 10;
  ([["star", "Leading value", "The highest value in the row or column"], ["check", "Hit", "The culture supports this part of the strategy"], ["half", "Partial hit", "The culture supports it in part"], ["cross", "Miss", "The culture works against it"], ["watch", "Watch", "A flag the platform raised for attention"]] as const).forEach(([ic, k, v], i) => {
    const cx = X0 + i * 101.85; doc.moveTo(cx, y).lineTo(cx + 90, y).lineWidth(0.5).strokeColor(C.ink).stroke();
    icon(doc, ic, cx, y + 10, C.ink, 12); tx(doc, k, cx + 18, y + 10, { f: "I7", size: 8.5, lead: 12 }); tx(doc, v, cx, y + 28, { size: 8.5, lead: 12, w: 90 }); });
  y += 80 + GAP;
  so("Definitions of every term in this report are in the glossary (appendix C), so the chapters can stay on the findings.", y);

  // ================================================================ 02 method and participation
  const pr = invited ? Math.round((nResp / invited) * 1000) / 10 : null;
  y = chapter("02", "Method and participation", [{ t: `${nResp} of ${invited ?? nResp} invited people answered${pr ? `, a response rate of ${pr} percent` : ""}; every comparison is made inside ${org}, never against other organisations.` }]);
  cont("Participation", "", true);
  y = h2(doc, "How the results were produced", y) + 6;
  y = tx(doc, "Each person shared 100 points across four descriptions of how the organisation works, once for how it is Now and once for how they would prefer it to be, in six areas of working life. Every score is an average of those shares. Readiness for change was measured on a 1 to 5 scale, and employee voice on a scale from minus 100 to plus 100.", X0, y, { w: CW }) + GAP;
  y = table(doc, { head: ["Item", "What the report states"], cols: [0.3, 0.7], right: [], rows: l.appendixParts.filter((p) => ["response_rate", "exclusions", "suppression", "substitutions", "extensions", "consistency"].includes(p.key)).flatMap((p) => p.rows.map(([k, v]) => [k, v] as Row)).slice(0, 10) }, y) + GAP;
  cont("Groups and reporting", "", true);
  y = h2(doc, "Groups and reporting", y) + 8;
  { const grp = [["Executives", exec?.n], ["Staff", staff?.n], ...(x.depts ?? []).map((d) => [d.label + (d.suppressed ? " (not shown, under 5)" : ""), d.n])] as [string, number][];
    y = hbars(doc, X0, y, CW, grp.map(([lab0, v]) => ({ label: lab0, v: Number(v ?? 0), col: C.ink, show: `${v} people` })), { min: 0, max: Math.max(...grp.map((g0) => Number(g0[1] ?? 0))) * 1.15, step: 10, lw: 180, rowH: 20 }) + GAP; }
  so("Groups below five people are never shown on their own; they are merged into the larger group they belong to, so no answer can be traced to a person.", y);

  // ================================================================ 03 the culture now
  show(true);
  y = chapter("03", "The culture now", [{ t: `${ONAME[lead]} leads the culture now at ` }, { t: d2(now[lead]), hi: true }, { t: ` points, only ${d2(now[lead] - now[second])} ahead of ${ONAME[second]}, and people would cut it to ${d2(pref[lead])} if they could.` }]);
  cont("Orientation profile", "", true);
  panel(doc, X0, y, HALF, 228, "Orientation profile"); panel(doc, X0 + HALF + GAP, y, HALF, 228, "Share of the culture now");
  vbars(doc, X0 + 8, y + 30, HALF - 16, 170, O4.map((o) => ({ label: ONAME[o], bars: [{ v: now[o], col: HUE[o], tint: TINT[o], now: true }, { v: pref[o], col: HUE[o] }] })), { min: 0, max: 40, step: 10, ref: 25 });
  legend(doc, [["Now", "now", ""], ["Preferred", "fill", "#666666"], ["Even share, 25", "dash", C.ink]], X0 + 12, y + 210);
  { const bx = X0 + HALF + GAP, bw = HALF; let sx0 = bx;
    tx(doc, `${ONAME[lead]} holds the largest share, ${d2(now[lead])} of 100 points`, bx, y + 30, { f: "I6", size: 9, lead: 13, w: bw });
    O4.forEach((o, i) => { const w0 = (bw * now[o]) / 100; doc.roundedRect(sx0, y + 56, w0 - 1.5, 26, i === 0 || i === 3 ? 4 : 0).fill(HUE[o]); tx(doc, d1(now[o]), sx0 + 4, y + 64, { f: "I7", size: 8.5, lead: 10, color: C.white }); sx0 += w0; });
    O4.forEach((o, i) => { const ry = y + 100 + i * 24; oname(doc, o, bx, ry, 100); tx(doc, `${d2(now[o])} now`, bx + 100, ry - 0.5, { f: "I4", size: 8, lead: 10, color: C.muted }); tx(doc, `${d2(pref[o])} preferred`, bx + 160, ry - 0.5, { f: "I7", size: 8, lead: 10, w: bw - 160, align: "right" });
      doc.moveTo(bx, ry + 15).lineTo(bx + bw, ry + 15).lineWidth(0.4).strokeColor(C.grid).stroke(); });
  }
  y += 228 + GAP;
  const lens = s.lenses_now ?? {};
  y = h2(doc, "Orientation scores by lens", y) + 8;
  const lensRows = starCol(starCol(starCol(O4.map((o) => [ONAME[o], d2(now[o]), d2(lens.PRACTICE?.[o]), d2(lens.STRATEGY?.[o]), d2(lens.LEADERSHIP?.[o]), String(byNow.indexOf(o) + 1)] as Row), 1), 2), 4);
  y = table(doc, { head: ["Orientation", "Now", "Practice", "Strategy", "Leadership", "Rank now"], cols: [0.24, 0.15, 0.15, 0.15, 0.16, 0.15], rows: starCol(lensRows, 3) }, y) + GAP;
  so(`Delivery sets the tone today, yet the top two orientations sit ${d2(now[lead] - now[second])} points apart.${lens.LEADERSHIP ? ` Leadership already leans ${ONAME[[...O4].sort((p, q) => n(lens.LEADERSHIP[q]) - n(lens.LEADERSHIP[p]))[0]]} at ${d2(Math.max(...O4.map((o) => n(lens.LEADERSHIP[o]))))}.` : ""}`, y);

  // 3.2 the six dimensions
  show(false);
  const dn = s.dimension_now as S, dp0 = (s.dimension_preferred ?? {}) as S;
  const leadsIn = (o: O) => DIMS.filter((d) => [...O4].sort((p, q) => n(dn[d][q]) - n(dn[d][p]))[0] === o);
  const peak = DIMS.map((d) => ({ d, v: n(dn[d][lead]) })).sort((p, q) => q.v - p.v)[0];
  y = cont("The six dimensions", `Each orientation leads at least one of the six dimensions. ${ONAME[lead]} peaks at ${d2(peak.v)} in ${DIMENSION[peak.d].name}; ${list(O4.filter((o) => leadsIn(o).length >= 2).map((o) => ONAME[o]))} lead two each.`);
  panel(doc, X0, y, CW, 236, "Six dimensions, now");
  vbars(doc, X0 + 8, y + 28, CW - 16, 180, DIMS.map((d) => ({ label: DIMENSION[d].name, bars: O4.map((o) => ({ v: n(dn[d][o]), col: HUE[o], show: n(dn[d][o]).toFixed(0) })) })), { min: 0, max: 40, step: 10, ref: 25, dec: 0 });
  legend(doc, [...O4.map((o) => [ONAME[o], "fill", HUE[o]] as [string, "fill", string]), ["Even share, 25", "dash", C.ink]], X0 + 12, y + 220);
  y += 236 + GAP;
  y = h2(doc, "Which orientation leads each dimension", y) + 10;
  DIMS.forEach((d, i) => { const cx = X0 + (i % 3) * 172, cy = y + Math.floor(i / 3) * 52, srt = [...O4].sort((p, q) => n(dn[d][q]) - n(dn[d][p]));
    doc.moveTo(cx, cy).lineTo(cx + 155, cy).lineWidth(0.5).strokeColor(C.ink).stroke();
    tx(doc, DIMENSION[d].name, cx, cy + 6, { f: "I6", size: 8.5, lead: 11 }); oname(doc, srt[0], cx, cy + 22, 90); tx(doc, d2(dn[d][srt[0]]), cx + 90, cy + 20, { f: "I7", size: 12, lead: 14, w: 65, align: "right" }); });
  y += 2 * 52 + GAP;
  so(`With ${count(new Set(DIMS.map((d) => [...O4].sort((p, q) => n(dn[d][q]) - n(dn[d][p]))[0])).size)} different leaders across six dimensions, people meet a different culture depending on where they look. ${DIMENSION[peak.d].name} is the most ${ONAME[lead]} driven at ${d2(peak.v)}.`, y);

  // 3.3 strength and consistency
  const lensLead = (L0: string) => { const v = lens[L0] ?? {}; const srt = [...O4].sort((p, q) => n(v[q]) - n(v[p])); return { o: srt[0], m: n(v[srt[0]]) - n(v[srt[1]]), s: srt[1] }; };
  y = cont("Strength and consistency", `Practice leans ${ONAME[lensLead("PRACTICE").o]} at ${d2(lens.PRACTICE?.[lensLead("PRACTICE").o])}, strategy ${ONAME[lensLead("STRATEGY").o]} at ${d2(lens.STRATEGY?.[lensLead("STRATEGY").o])} and leadership ${ONAME[lensLead("LEADERSHIP").o]} at ${d2(lens.LEADERSHIP?.[lensLead("LEADERSHIP").o])}: three lenses, ${new Set(["PRACTICE", "STRATEGY", "LEADERSHIP"].map((k) => lensLead(k).o)).size === 3 ? "three different leaders" : "two different leaders"}.`);
  panel(doc, X0, y, HALF, 228, "Lead margin by lens"); panel(doc, X0 + HALF + GAP, y, HALF, 228, "Lead margin by dimension");
  hbars(doc, X0 + 12, y + 32, HALF - 24, [{ label: "Organisation", sub: `${ONAME[lead]} over ${ONAME[second]}`, v: now[lead] - now[second], col: C.ink }, ...(["PRACTICE", "STRATEGY", "LEADERSHIP"] as const).map((k) => { const z = lensLead(k); return { label: human(k), sub: `${ONAME[z.o]} over ${ONAME[z.s]}`, v: z.m, col: C.ink }; })], { min: 0, max: 20, step: 5, lw: 86, rowH: 36, dec: 2 });
  label7(doc, "Points between the first and second orientation", X0 + 12, y + 210, { color: C.muted });
  hbars(doc, X0 + HALF + GAP + 12, y + 28, HALF - 24, DIMS.map((d) => { const srt = [...O4].sort((p, q) => n(dn[d][q]) - n(dn[d][p])); return { label: DIMENSION[d].name, sub: `${ONAME[srt[0]]} over ${ONAME[srt[1]]}`, v: n(dn[d][srt[0]]) - n(dn[d][srt[1]]), col: C.ink }; }), { min: 0, max: 20, step: 5, lw: 86, rowH: 26, dec: 2 });
  label7(doc, "Points between the first and second orientation", X0 + HALF + GAP + 12, y + 210, { color: C.muted });
  y += 228 + GAP;
  const disp = a.dispersion ?? {};
  { const figs = [["Culture strength", d2(s.culture_strength), strengthBand, `Lead of ${d2(now[lead] - now[second])} points`], ...(cong.band ? [["Strategy congruence", `${d1(cong.dimension_pct)}%`, human(cong.band), "Each lens favours its own orientation"]] : []), ...(disp.overall ? [["Spread of answers", d2(disp.overall), "Not banded", "How far answers differ"]] : []), ...(a.entropy ? [["Culture entropy", d2(a.entropy.score), human(a.entropy.band), "Answers spread across orientations"]] : [])];
    figs.forEach(([k, v, b, c0], i) => { const cx = X0 + i * ((CW + 16) / figs.length), fw = (CW + 16) / figs.length - 16; doc.moveTo(cx, y).lineTo(cx + fw, y).lineWidth(0.5).strokeColor(C.ink).stroke();
      tx(doc, k, cx, y + 8, { f: "I7", size: 7.5, lead: 10, caps: true, cs: 0.5, color: C.brand, w: fw }); tx(doc, v, cx, y + 24, { f: "I7", size: 20, lead: 24 }); tx(doc, b, cx, y + 50, { f: "I6", size: 8.5, lead: 11, w: fw }); tx(doc, c0, cx, y + 63, { size: 8.5, lead: 12, w: fw, color: C.muted }); });
    y += 92 + GAP; }
  so(`A diffuse culture is easier to move than a settled one. The risk is mixed signals: strategy asks for ${ONAME[lensLead("STRATEGY").o]} while daily practice rewards ${ONAME[lensLead("PRACTICE").o]}.`, y);

  // ================================================================ 04 the culture gap
  y = chapter("04", "The culture gap", [{ t: `People want ${ONAME[upMost]} up by ${d2(gap[upMost])} points and ${ONAME[downMost]} down by ${d2(-gap[downMost])}; ${O4.every((o) => a.gap_bands?.[o] === "SIGNIFICANT") ? "all four gaps are in the significant band." : "the largest gaps are in the significant band."}` }]);
  cont("Gap by orientation", "", true);
  panel(doc, X0, y, HALF, 200, "Gap by orientation"); panel(doc, X0 + HALF + GAP, y, HALF, 200, "Now and Preferred");
  hbars(doc, X0 + 12, y + 30, HALF - 24, O4.map((o) => ({ label: ONAME[o], v: gap[o], col: HUE[o], show: sgn(gap[o]), right: human(a.gap_bands?.[o] ?? "") })), { min: -12, max: 12, step: 4, lw: 46, rw: 62, rowH: 28, bands: [{ from: -8, to: -4, fill: C.band }, { from: 4, to: 8, fill: C.band }, { from: -12, to: -8, fill: C.band2 }, { from: 8, to: 12, fill: C.band2 }] });
  legend(doc, [["Watch band, 4 to 8", "fill", C.band], ["Significant, above 8", "fill", C.band2]], X0 + 12, y + 186);
  dots(doc, X0 + HALF + GAP + 12, y + 30, HALF - 24, O4.map((o) => ({ label: ONAME[o], a: now[o], b: pref[o], col: HUE[o] })), { min: 0, max: 40, step: 10, lw: 46, rowH: 32, arrow: true, ref: 25 });
  legend(doc, [["Now", "dot", C.ink], ["Preferred", "line", C.ink], ["Even share, 25", "dash", C.ink]], X0 + HALF + GAP + 12, y + 186);
  y += 200 + GAP;
  y = h2(doc, "Gap by orientation", y) + 8;
  y = table(doc, { head: ["Orientation", "Now", "Preferred", "Gap", "Class", "Direction"], cols: [0.2, 0.14, 0.14, 0.14, 0.18, 0.2], right: [1, 2, 3], rows: O4.map((o) => [ONAME[o], d2(now[o]), d2(pref[o]), o === upMost ? { t: sgn(gap[o]), star: true } : sgn(gap[o]), human(a.gap_bands?.[o] ?? ""), human(s.classification?.[o] ?? "")] as Row) }, y) + GAP;
  so(`The wish is clear and shared: build ${list(O4.filter((o) => gap[o] > 0).map((o) => ONAME[o]))}, ease off ${list(O4.filter((o) => gap[o] < 0).map((o) => ONAME[o]))}. A gap of ${d2(gap[upMost])} on ${ONAME[upMost]} is the largest single move.`, y);

  // 4.2 gap by dimension
  const gd = (d: string, o: O) => n(dp0[d]?.[o]) - n(dn[d][o]);
  const bigD = DIMS.flatMap((d) => O4.map((o) => ({ d, o, g: gd(d, o) }))).sort((p, q) => Math.abs(q.g) - Math.abs(p.g))[0];
  y = cont("Gap by dimension", `Every dimension wants more ${list(O4.filter((o) => gap[o] > 0).map((o) => ONAME[o]))} and less ${list(O4.filter((o) => gap[o] < 0).map((o) => ONAME[o]))}; the largest shift is ${ONAME[bigD.o]} in ${DIMENSION[bigD.d].name}, ${bigD.g < 0 ? "down" : "up"} ${d2(Math.abs(bigD.g))}.`);
  panel(doc, X0, y, CW, 246, "Gap by dimension, Preferred minus Now");
  vbars(doc, X0 + 8, y + 28, CW - 16, 190, DIMS.map((d) => ({ label: DIMENSION[d].name, bars: O4.map((o) => ({ v: gd(d, o), col: HUE[o] })) })), { min: -25, max: 25, step: 5, dec: 0 });
  legend(doc, O4.map((o) => [ONAME[o], "fill", HUE[o]] as [string, "fill", string]), X0 + 12, y + 230);
  y += 246 + GAP;
  y = h2(doc, "The largest shift in each dimension", y) + 10;
  DIMS.forEach((d, i) => { const cx = X0 + (i % 3) * 172, cy = y + Math.floor(i / 3) * 52, top = [...O4].sort((p, q) => Math.abs(gd(d, q)) - Math.abs(gd(d, p)))[0];
    doc.moveTo(cx, cy).lineTo(cx + 155, cy).lineWidth(0.5).strokeColor(C.ink).stroke();
    tx(doc, DIMENSION[d].name, cx, cy + 6, { f: "I6", size: 8.5, lead: 11 }); oname(doc, top, cx, cy + 22, 90); tx(doc, sgn(gd(d, top)), cx + 90, cy + 20, { f: "I7", size: 12, lead: 14, w: 65, align: "right" }); });
  y += 2 * 52 + GAP;
  so(`Because every dimension pulls the same way, one coherent programme can serve them all. ${DIMENSION[bigD.d].name} needs the most care: ${ONAME[bigD.o]} there ${bigD.g < 0 ? "falls" : "rises"} ${d2(Math.abs(bigD.g))} points.`, y);

  // 4.3 tensions and spread
  const tens = (a.tensions ?? []) as S[], spreadO = (o: O) => DIMS.reduce((t, d) => t + n(disp[d]?.[o] ?? 0), 0) / 6;
  const spTop = [...O4].sort((p, q) => spreadO(q) - spreadO(p))[0];
  y = cont("Tensions and spread", `${cap(count(tens.length))} tension${tens.length === 1 ? "" : "s"} run high${tens.length ? ` at ${d1(tens[0].score)}, ${list(tens.map((t) => `${ONAME[t.a as O]} against ${ONAME[t.b as O]}`))}` : ""}, and ${ONAME[spTop]} answers vary most.`);
  panel(doc, X0, y, HALF, 200, "Tension pairs"); panel(doc, X0 + HALF + GAP, y, HALF, 200, "Spread of answers");
  let ty0 = y + 30;
  for (const t of tens.slice(0, 2)) { label7(doc, `${ONAME[t.a as O]} and ${ONAME[t.b as O]}`, X0 + 12, ty0, { b: true }); label7(doc, `${d1(t.score)}, ${human(t.band)}`, X0 + HALF - 70, ty0, { w: 58, align: "right" });
    ty0 = hbars(doc, X0 + 12, ty0 + 12, HALF - 24, [t.a, t.b].map((o: O) => ({ label: ONAME[o], v: gap[o], col: HUE[o], show: sgn(gap[o], 1) })), { min: -15, max: 15, step: 15, lw: 46, rowH: 18 }) + 6; }
  label7(doc, "Tension score and band; bars show the gap in points", X0 + 12, y + 186, { color: C.muted });
  hbars(doc, X0 + HALF + GAP + 12, y + 44, HALF - 24, O4.map((o) => ({ label: ONAME[o], v: spreadO(o), col: HUE[o], show: spreadO(o).toFixed(2) })), { min: 0, max: 12, step: 3, lw: 46, rowH: 30, ref: { v: n(disp.overall ?? 0), label: `All answers ${d2(disp.overall)}` } });
  label7(doc, "Average spread of answers across the six dimensions", X0 + HALF + GAP + 12, y + 186, { color: C.muted });
  y += 200 + GAP;
  y += 8;
  so(`${tens.length ? `Moving ${ONAME[tens[0].a as O]} up means asking ${ONAME[tens[0].b as O]} to give ground, and the two pull against each other at ${d1(tens[0].score)}. ` : ""}${ONAME[spTop]} carries the least agreement, so changes there need the clearest explanation.`, y);

  // ================================================================ 05 strategy checks
  show(true);
  const CK = ["C1", "C2", "C3", "C4"].filter((k) => checks[k]);
  const ckNum = (k: string): { v: string; lab: string; ev: string } => {
    if (k === "C1") return { v: d2(now[lastO]), lab: `${ONAME[lastO]} now, lowest of four`, ev: `The strategy relies on ${ONAME[lastO]}, yet it is the weakest orientation in the culture today.` };
    if (k === "C2") { const lo = s.lenses_now?.LEADERSHIP ?? {}, lt = [...O4].sort((p, q) => n(lo[q]) - n(lo[p]))[0]; return { v: d2(lo[lt]), lab: `${ONAME[lt]} in leadership, ranked first`, ev: `Leaders already show the ${ONAME[lt]} behaviour the strategy asks for; it ranks first in how leadership works.` }; }
    if (k === "C3") return { v: sgn(gap[downMost]), lab: `${ONAME[downMost]}, the shift people want`, ev: `People want less ${ONAME[downMost]}, the orientation the business runs on; cutting it too far puts the identity at risk.` };
    return { v: d2(now[upMost]), lab: `${ONAME[upMost]} now, the weaker of the pair`, ev: `A model that needs ${ONAME[upMost]} and ${ONAME[lead]} together; ${ONAME[lead]} holds at ${d2(now[lead])}, ${ONAME[upMost]} trails.` };
  };
  y = chapter("05", "Strategy checks", [{ t: `${hits} of ${CK.length} strategy checks ${hits === 1 ? "is a full hit" : "are full hits"}${checks.C2 === "HIT" ? ": leadership behaviour" : ""}. ${checks.C1 === "MISS" ? `The strategy goal is a miss, with ${ONAME[lastO]} at ` : ""}` }, ...(checks.C1 === "MISS" ? [{ t: d2(now[lastO]), hi: true }, { t: "." }] : [])]);
  cont("The four verdicts", "", true);
  CK.forEach((k, i) => { const cx = X0 + (i % 2) * (HALF + GAP), cy = y + Math.floor(i / 2) * (132 + GAP), z = ckNum(k); panel(doc, cx, cy, HALF, 132);
    tx(doc, `${k} · ${CHECK[k]?.name ?? k}`, cx + 12, cy + 12, { f: "I6", size: 7, lead: 9, caps: true, cs: 0.5 });
    const vw = verdictTile(doc, checks[k] as "HIT", human(checks[k]), cx + 12, cy + 28, 100.82, 22);
    tx(doc, z.v, cx + 12 + vw + 12, cy + 26, { f: "I7", size: 20, lead: 26 });
    tx(doc, z.lab, cx + 12, cy + 56, { f: "I7", size: 7, lead: 9, caps: true, cs: 0.5, w: HALF - 24 });
    tx(doc, z.ev, cx + 12, cy + 72, { size: 9, lead: 13, w: HALF - 24 }); });
  y += Math.ceil(CK.length / 2) * (132 + GAP);
  y = h2(doc, "The scores behind each check", y) + 8;
  const sev: Record<string, string> = { MISS: "Critical", PARTIAL_HIT: "Medium", HIT: "Low" };
  y = table(doc, { head: ["Check", "Verdict", "Rests on", "Now", "Preferred", "Severity"], cols: [0.22, 0.17, 0.17, 0.14, 0.14, 0.16], right: [3, 4], rows: CK.map((k) => { const o = k === "C1" ? lastO : k === "C2" ? ([...O4].sort((p, q) => n(s.lenses_now?.LEADERSHIP?.[q]) - n(s.lenses_now?.LEADERSHIP?.[p]))[0]) : k === "C3" ? downMost : upMost;
    return [`${k} ${CHECK[k]?.name ?? ""}`, { t: human(checks[k]), icon: checks[k] === "HIT" ? "check" as const : checks[k] === "MISS" ? "cross" as const : "half" as const }, ONAME[o], d2(now[o]), d2(pref[o]), sev[checks[k]] ?? ""] as Row; }) }, y) + GAP;
  so(`${checks.C2 === "HIT" ? "Leadership is the one full hit. " : ""}The other checks fall short on what the culture rewards today, with ${ONAME[lead]} at ${d2(now[lead])} ahead of ${list(O4.filter((o) => gap[o] > 0).map((o) => ONAME[o]))}.`, y);

  // 5.2 evidence by check
  show(false);
  y = cont("Evidence by check", `${cap(count(partials))} checks are partial hits${partials ? `, and both turn on the same trade: building ${ONAME[upMost]} without losing the ${ONAME[lead]} strength at ${d2(now[lead])}` : ""}.`);
  CK.forEach((k, i) => { const cx = X0 + (i % 2) * (HALF + GAP), cy = y + Math.floor(i / 2) * (220 + GAP), z = ckNum(k), ad = advFor(k === "C3" ? downMost : k === "C1" ? lastO : upMost);
    doc.rect(cx, cy, HALF, 220).fill(C.white); doc.rect(cx, cy, HALF, 1.5).fill(C.brand);
    const vw = verdictTile(doc, checks[k] as "HIT", human(checks[k]), cx + 12, cy + 13.5, 100.82, 22); tx(doc, z.v, cx + 24 + vw, cy + 12, { f: "I7", size: 20, lead: 26 });
    let ly = tx(doc, z.lab, cx + 12, cy + 44, { f: "I7", size: 7, lead: 9, caps: true, cs: 0.5, w: HALF - 24 }) + 8;
    for (const [lab0, t] of [["Finding.", z.ev], ["Evidence.", `${ONAME[k === "C3" ? downMost : k === "C1" ? lastO : upMost]} stands at ${d2(now[k === "C3" ? downMost : k === "C1" ? lastO : upMost])} now against ${d2(pref[k === "C3" ? downMost : k === "C1" ? lastO : upMost])} preferred.`], ["Consequence.", checks[k] === "HIT" ? "Leaders can model the change, provided staff see the same behaviour." : (ad?.risks[0] ?? CHECK[k]?.risk ?? "")], ["Action.", checks[k] === "HIT" ? `Use leaders as visible sponsors. Owner: ${CHECK[k]?.owner ?? "chief executive"}. Timing: from launch.` : `${ad?.actions[0]?.text ?? CHECK[k]?.intervention ?? ""} Owner: ${ad?.actions[0]?.owner_role ?? CHECK[k]?.owner ?? "to be confirmed"}. Timing: ${ad?.actions[0]?.horizon ?? CHECK[k]?.urgency ?? "to be confirmed"}.`]] as const) {
      doc.font("SB").fontSize(8.5); const lw0 = tw(doc, lab0 + " ", "SB", 8.5);
      tx(doc, lab0, cx + 12, ly, { f: "SB", size: 8.5, lead: 12 }); ly = tx(doc, t, cx + 12 + lw0, ly, { size: 8.5, lead: 12, w: HALF - 24 - lw0 }) + 4; } });
  y += Math.ceil(CK.length / 2) * (220 + GAP);
  so(`The strategy is not blocked by leaders, who already lead with ${ONAME[[...O4].sort((p, q) => n(s.lenses_now?.LEADERSHIP?.[q]) - n(s.lenses_now?.LEADERSHIP?.[p]))[0]]}. It is held back by a culture that rewards delivery over new ideas, with ${ONAME[lastO]} at ${d2(now[lastO])}.`, y);

  // ================================================================ 06 executives and staff
  if (exec && staff && pg) {
    y = chapter("06", "Executives and staff", [{ t: `Executives rate ${ONAME[pgTop!]} ` }, { t: d2(pg[pgTop!]), hi: true }, { t: ` points ${n(exec.now[pgTop!]) > n(staff.now[pgTop!]) ? "higher" : "lower"} than staff do, the one gap wide enough to flag as a shadow culture.` }]);
    cont("Where the groups differ", "", true);
    panel(doc, X0, y, HALF, 200, "Executives and staff, now"); panel(doc, X0 + HALF + GAP, y, HALF, 200, "Who scores higher");
    dots(doc, X0 + 12, y + 34, HALF - 24, O4.map((o) => ({ label: ONAME[o], a: n(exec.now[o]), b: n(staff.now[o]), col: HUE[o], right: d2(pg[o]) })), { min: 15, max: 35, step: 5, lw: 46, rw: 34, rowH: 34, ref: 25 });
    label7(doc, "Gap", X0 + HALF - 34, y + 22, { w: 22, align: "right" });
    legend(doc, [["Executives", "dot", C.ink], ["Staff", "diamond", C.ink], ["Even share, 25", "dash", C.ink]], X0 + 12, y + 186);
    hbars(doc, X0 + HALF + GAP + 12, y + 30, HALF - 24, O4.map((o) => ({ label: ONAME[o], v: n(exec.now[o]) - n(staff.now[o]), col: HUE[o], show: sgn(n(exec.now[o]) - n(staff.now[o])) })), { min: -10, max: 10, step: 5, lw: 46, rowH: 32, axis: ["Staff higher", "Executives higher"] });
    label7(doc, "Executives minus staff, in points", X0 + HALF + GAP + 12, y + 186, { color: C.muted });
    y += 200 + GAP;
    y = h2(doc, "Executives and staff by orientation", y) + 8;
    y = table(doc, { head: ["Orientation", `Executives, ${exec.n}`, `Staff, ${staff.n}`, "Gap", "Higher group", "Flag"], cols: [0.18, 0.16, 0.14, 0.12, 0.18, 0.22], right: [1, 2, 3], rows: O4.map((o) => [ONAME[o], d2(exec.now[o]), d2(staff.now[o]), d2(pg[o]), n(exec.now[o]) > n(staff.now[o]) ? "Executives" : "Staff", s.perception_flags?.[o] === "SHADOW_CULTURE" ? { t: "Shadow culture", icon: "watch" as const } : s.perception_flags?.[o] === "WATCH" ? { t: "Watch", icon: "watch" as const } : "No flag"] as Row) }, y) + GAP;
    y = h2(doc, "Questions to test with the executive team", y) + 8;
    for (const [i, t0] of ["Which channels do executives rely on?", "Is there an unfiltered upward route?", "Do middle managers translate or buffer?"].entries()) { doc.circle(X0 + 8, y + 7, 8).fill(C.brand); tx(doc, String(i + 1), X0, y + 2.5, { f: "I7", size: 8, lead: 9, w: 16, align: "center" }); tx(doc, t0, X0 + 24, y, {}); y += 22; }
    y += GAP - 6;
    so(`Executives see a ${n(exec.now[pgTop!]) > n(staff.now[pgTop!]) ? `more ${ONAME[pgTop!]}` : `less ${ONAME[pgTop!]}`} organisation than staff describe: ${d2(exec.now[pgTop!])} against ${d2(staff.now[pgTop!])}. Messages from the top will land as out of touch until that gap is heard.`, y);
  }

  // ================================================================ 07 readiness and risk
  y = chapter("07", "Readiness and risk", [{ t: "Readiness for change stands at " }, { t: d2(rd.tps), hi: true }, { t: `, in the ${lower(human(rd.tps_band ?? ""))} band: people are open to change but need support before it is scaled.` }]);
  cont("Readiness for change", "", true);
  panel(doc, X0, y, HALF, 200, "Readiness gauges"); panel(doc, X0 + HALF + GAP, y, HALF, 200, "Readiness items");
  ([["Readiness overall", rd.tps, human(rd.tps_band ?? "")], ...R3.map((k) => [READINESS[k].name, rd[k.toLowerCase()], rd[`${k.toLowerCase()}_band`] ?? ""])] as [string, unknown, string][]).forEach(([lab0, v, b], i) => {
    const gx = X0 + 12 + (i % 2) * 112, gy = y + 34 + Math.floor(i / 2) * 82; gauge(doc, gx + 50, gy + 32, 26, n(v), 1, 5, i === 0 ? C.brand : C.ink);
    tx(doc, d2(v), gx + 30, gy + 20, { f: "I7", size: 12, lead: 14, w: 40, align: "center" }); label7(doc, "1", gx + 18, gy + 36); label7(doc, "5", gx + 78, gy + 36);
    label7(doc, lab0, gx, gy + 46, { w: 100, align: "center", b: true }); label7(doc, b, gx, gy + 55, { w: 100, align: "center", color: C.muted }); });
  const items = s.readiness_items ?? {};
  R3.forEach((k, i) => { const ry = y + 42 + i * 46, vals = (items[k] ?? []).map(n).filter(Number.isFinite) as number[]; const L0 = X0 + HALF + GAP + 12, R0 = X0 + 2 * HALF + GAP - 12, sx = (v: number) => L0 + ((v - 2.8) / (3.6 - 2.8)) * (R0 - L0);
    label7(doc, READINESS[k].name, L0, ry - 12, { b: true }); doc.moveTo(L0, ry).lineTo(R0, ry).lineWidth(0.5).strokeColor(C.grid).stroke();
    for (const v of vals) doc.circle(sx(v), ry, 2.5).lineWidth(0.75).strokeColor(C.ink).stroke();
    const mean = vals.reduce((t, v) => t + v, 0) / (vals.length || 1); doc.moveTo(sx(mean), ry - 6).lineTo(sx(mean), ry + 6).lineWidth(1.5).strokeColor(C.ink).stroke(); label7(doc, `Mean ${d2(mean)}`, sx(mean) + 3, ry - 12); });
  for (const v of [2.8, 3.0, 3.2, 3.4, 3.6]) label7(doc, v.toFixed(1), X0 + HALF + GAP + 12 + ((v - 2.8) / 0.8) * (HALF - 24) - 8, y + 176, { w: 16, align: "center" });
  legend(doc, [["One item", "dot", C.white], ["Mean", "line", C.ink]], X0 + HALF + GAP + 12, y + 188);
  y += 200 + GAP;
  y = h2(doc, "Readiness by dimension", y) + 8;
  const it = (k: string) => (items[k] ?? []).map(n).filter(Number.isFinite) as number[];
  y = table(doc, { head: ["Measure", "Score", "Band", "Lowest item", "Highest item"], cols: [0.26, 0.1, 0.28, 0.18, 0.18], right: [1, 3, 4], rows: [["Readiness overall", d2(rd.tps), human(rd.tps_band ?? ""), "", ""], ...R3.map((k) => [READINESS[k].name, d2(rd[k.toLowerCase()]), rd[`${k.toLowerCase()}_band`] ?? "", it(k).length ? d2(Math.min(...it(k))) : "", it(k).length ? d2(Math.max(...it(k))) : ""] as Row), ...(rd.leadership_alignment ? [["Leadership alignment", d2(rd.leadership_alignment), "Not banded", "", ""] as Row] : [])] }, y) + GAP;
  const lowItem = Math.min(...R3.flatMap((k) => it(k)));
  so(`Willingness is there, but the floor is low: the weakest item sits at ${d2(lowItem)}. Build skills and safety first, then scale.`, y);

  // 7.2 culture risk index
  if (a.risk) {
    y = cont("Culture Risk Index", `The Culture Risk Index stands at ${Math.round(n(a.risk.index))}, in the ${lower(human(a.risk.band))} band; the spread of answers, at ${Math.round(n(a.risk.dispersion))}, is the largest driver.`);
    panel(doc, X0, y, HALF, 200, "Culture Risk Index"); panel(doc, X0 + HALF + GAP, y, HALF, 200, "Health meters");
    gauge(doc, X0 + HALF / 2, y + 120, 62, n(a.risk.index), 0, 100, C.brand);
    tx(doc, String(Math.round(n(a.risk.index))), X0 + HALF / 2 - 40, y + 96, { f: "I7", size: 24, lead: 26, w: 80, align: "center" }); label7(doc, human(a.risk.band).toUpperCase(), X0 + HALF / 2 - 40, y + 124, { w: 80, align: "center", b: true });
    label7(doc, "0", X0 + HALF / 2 - 70, y + 130); label7(doc, "100", X0 + HALF / 2 + 58, y + 130); tx(doc, "Lower is better", X0 + 12, y + 160, { f: "SI", size: 8, lead: 10, w: HALF - 24, align: "center" });
    const meters = [["Spread of answers", "How far answers differ", a.risk.dispersion], ["Culture gap", "Distance from Now to Preferred", a.risk.gap], ["Misalignment", "Source: Perception gap", a.risk.misalignment]] as const;
    const mTop = Math.max(...meters.map((z) => n(z[2])));
    meters.forEach(([k, sub, v], i) => { const my = y + 34 + i * 40, mx = X0 + HALF + GAP + 12, mw = HALF - 60;
      label7(doc, k, mx, my, { b: true }); label7(doc, sub, mx, my + 9, { color: C.muted });
      doc.rect(mx, my + 20, mw, 6).fill(C.band); doc.rect(mx, my + 20, (mw * n(v)) / 100, 6).fill(C.ink);
      if (n(v) === mTop) icon(doc, "star", mx + mw + 6, my + 17, C.ink, 9);
      label7(doc, String(Math.round(n(v))), mx + mw + 18, my + 18, { b: true }); });
    label7(doc, "Lower is better on every meter", X0 + HALF + GAP + 12, y + 186, { color: C.muted });
    y += 200 + GAP;
    if (e?.scenarios?.length) {
      y = h2(doc, "Risk scenarios the platform found", y) + 10;
      const sc = e.scenarios.slice(0, 3), sw = (CW - 16 * (sc.length - 1)) / sc.length;
      const hs = sc.map((z) => 40 + th(doc, clean(z.diagnosis), sw, "S", 8.5, 12) + 18 + th(doc, clean((z.hypotheses ?? []).slice(0, 2).join(" ")), sw, "S", 8.5, 12));
      sc.forEach((z, i) => { const cx = X0 + i * (sw + 16); doc.moveTo(cx, y).lineTo(cx + sw, y).lineWidth(0.5).strokeColor(C.ink).stroke();
        tx(doc, clean(z.name), cx, y + 8, { f: "I7", size: 9.5, lead: 13, w: sw - 70 });
        const hot = ["CRITICAL", "HIGH"].includes(String(z.severity)); if (hot) icon(doc, "watch", cx + sw - 62, y + 9, C.ink, 9); tx(doc, human(String(z.severity)), cx + sw - 50, y + 8, { f: "I6", size: 8, lead: 12, w: 50, align: "right" });
        let ly = tx(doc, clean(z.diagnosis), cx, y + 30, { size: 8.5, lead: 12, w: sw }) + 6;
        ly = tx(doc, "Questions to test", cx, ly, { f: "I7", size: 7, lead: 10, caps: true, cs: 0.5, color: C.brand }) + 2; tx(doc, clean((z.hypotheses ?? []).slice(0, 2).join(" ")), cx, ly, { size: 8.5, lead: 12, w: sw }); });
      y += Math.max(...hs) + GAP;
    }
    so(`Disagreement drives the risk more than the gap itself. Answers vary widely, so agree what good looks like before changing it.`, y);
  }

  // ================================================================ 08 employee voice
  const idx = n(s.eos?.index);
  y = chapter("08", "Employee voice", [{ t: `${cap(count(negVoice.length))} of the eight voice scores are below zero. ${negVoice[0] ? `${negVoice[0].nm} is lowest at ` : ""}` }, ...(negVoice[0] ? [{ t: num(negVoice[0].v, 0), hi: true }] : []), { t: `; ${lower(EOS_NAMES[[...EOS_NAMES.keys()].sort((p, q) => eos(q) - eos(p))[0]])} leads at ${sgn(Math.max(...EOS_NAMES.map((_, i) => eos(i))), 0)}.` }]);
  cont("Voice scores", "", true);
  panel(doc, X0, y, CW, 258, "Employee voice scores");
  hbars(doc, X0 + 12, y + 40, CW - 24, EOS_NAMES.map((nm, i) => ({ label: nm, v: eos(i), col: eos(i) < 0 ? C.neg : C.pos, show: sgn(eos(i), 0) })), { min: -50, max: 50, step: 25, lw: 190, rowH: 22, ref: Number.isFinite(idx) ? { v: idx, label: `Index ${sgn(idx, 1)}` } : undefined, axis: ["More detractors", "More promoters"] });
  legend(doc, [["Below zero", "fill", C.neg], ["Above zero", "fill", C.pos], ["Index", "dash", C.ink]], X0 + 12, y + 242);
  y += 258 + GAP;
  y = h2(doc, "Voice scores in detail", y) + 8;
  y = table(doc, { head: ["Voice score", "Score", "Promoters", "Passives", "Detractors", "Signal"], cols: [0.34, 0.11, 0.13, 0.13, 0.13, 0.16], right: [1, 2, 3, 4], rows: starCol(EOS_NAMES.map((nm, i) => { const dd = det[`Q${i + 1}`] ?? {}; return [nm, sgn(eos(i), 0), String(dd.promoters ?? ""), String(dd.passives ?? ""), String(dd.detractors ?? ""), { t: signalOf(eos(i)), icon: eos(i) > 0 ? "check" as const : "watch" as const }] as Row; }), 1) }, y) + GAP;
  so(`Critics outnumber supporters on ${negVoice.length >= 4 ? "half" : count(negVoice.length)} of the scores. ${EOS_NAMES[[...EOS_NAMES.keys()].sort((p, q) => eos(q) - eos(p))[0]]}, at ${sgn(Math.max(...EOS_NAMES.map((_, i) => eos(i))), 0)}, shows what people value; start the listening there and on ${negVoice[0] ? lower(negVoice[0].nm) : "the lowest score"}.`, y);

  // 8.2 who says what and themes
  const devQ = negVoice[0], ddq = devQ ? det[`Q${devQ.i + 1}`] : null;
  y = cont("Who says what, and themes", ddq ? `On ${lower(devQ!.nm)}, ${ddq.detractors} of ${ddq.n} people are detractors and only ${count(ddq.promoters)} are promoters.` : "How promoters, passives and detractors split on each voice score.");
  panel(doc, X0, y, HALF + 72, 228, "Who says what"); panel(doc, X0 + HALF + 72 + GAP, y, HALF - 72 - GAP + 0, 228, "Voice index");
  const bw0 = HALF + 72 - 24;
  EOS_NAMES.forEach((nm, i) => { const dd = det[`Q${i + 1}`]; if (!dd) return; const by = y + 30 + i * 22, tot = dd.n || 1; let bx = X0 + 12;
    label7(doc, nm, X0 + 12, by, { b: true });
    for (const [k, col, tc] of [["detractors", C.neg, C.white], ["passives", C.grid, C.ink], ["promoters", C.pos, C.ink]] as const) { const ww = (bw0 * dd[k]) / tot; doc.rect(bx, by + 9, ww, 9).fill(col); if (ww > 10) label7(doc, String(dd[k]), bx, by + 9, { w: ww, align: "center", color: tc }); bx += ww; } });
  legend(doc, [["Detractors", "fill", C.neg], ["Passives", "fill", C.grid], ["Promoters", "fill", C.pos]], X0 + 12, y + 212);
  const vx = X0 + HALF + 72 + GAP, vw = HALF - 72 - GAP; gauge(doc, vx + vw / 2, y + 120, 50, idx, -100, 100, C.brand);
  tx(doc, sgn(idx, 1), vx, y + 100, { f: "I7", size: 18, lead: 20, w: vw, align: "center" }); label7(doc, idx >= 0 ? "ABOVE ZERO" : "BELOW ZERO", vx, y + 128, { w: vw, align: "center", b: true });
  tx(doc, `Lowest ${num(Math.min(...EOS_NAMES.map((_, i) => eos(i))), 0)}, highest ${sgn(Math.max(...EOS_NAMES.map((_, i) => eos(i))), 0)}`, vx + 8, y + 160, { f: "SI", size: 8, lead: 10, w: vw - 16, align: "center" });
  y += 228 + GAP;
  y = h2(doc, "Themes from written comments", y) + 8;
  const thr = themes && themes.n >= 8 && themes.items?.length ? themes.items : null;
  if (thr) for (const t0 of thr) {
    doc.moveTo(X0, y).lineTo(X1, y).lineWidth(0.4).strokeColor(C.grid).stroke();
    tx(doc, t0.theme, X0, y + 6, { f: "I6", size: 9, lead: 12, w: 110 }); rbar(doc, X0 + 112, y + 8, (90 * t0.share) / 30, 8, C.ink); tx(doc, `${t0.share}%`, X0 + 116 + (90 * t0.share) / 30, y + 6, { f: "I7", size: 8.5, lead: 12 });
    tx(doc, t0.tone ? human(t0.tone) : "Tone to be tagged", X0 + 236, y + 6, { f: "I4", size: 8, lead: 12, color: C.muted, w: 80 });
    y = Math.max(y + 24, tx(doc, t0.says, X0 + 320, y + 5, { size: 8.5, lead: 12, w: CW - 320 }) + 6);
  }
  else y = tx(doc, "Fewer than eight people wrote a comment, so no themes are reported.", X0, y, { w: CW }) + 6;
  y += GAP - 6;
  so(`The index sits ${idx >= 0 ? "just above" : "below"} zero at ${sgn(idx, 1)}: strong scores mask ${count(negVoice.length)} weak ones.${thr ? ` ${thr[0].theme} leads the comments from ${themes!.n} people, at ${thr[0].share} percent.` : ""}`, y);

  // ================================================================ 09 departments
  if (x.depts?.length) {
    const orgLead = lead, diff = (d: (typeof depts)[number], o: O) => n(d.now![o]) - now[o];
    const other = depts.filter((d) => d.dominant && d.dominant !== orgLead), widest = depts.flatMap((d) => O4.map((o) => ({ d, o, v: diff(d, o) }))).sort((p, q) => Math.abs(q.v) - Math.abs(p.v))[0];
    y = chapter("09", "Departments", [{ t: `${cap(count(other.length))} of ${count(depts.length)} departments are led by a different orientation. The widest gap is ${widest.d.label} on ${ONAME[widest.o]}, ` }, { t: sgn(widest.v, 1), hi: true }, { t: "." }]);
    cont("Department map", "", true);
    // heatmap
    const hm = { lw: 130, cw: (CW - 24 - 130 - 70) / 4 };
    panel(doc, X0, y, CW, 34 + (x.depts.length) * 22 + 40, "Departments by orientation");
    O4.forEach((o, j) => label7(doc, ONAME[o], X0 + 12 + hm.lw + j * hm.cw, y + 28, { w: hm.cw, align: "center", b: true })); label7(doc, "Leads", X0 + 12 + hm.lw + 4 * hm.cw + 8, y + 28, { b: true });
    x.depts.forEach((d, i) => { const ry = y + 40 + i * 22; label7(doc, d.label, X0 + 12, ry + 6, { b: true });
      O4.forEach((o, j) => { const cx = X0 + 12 + hm.lw + j * hm.cw;
        if (d.suppressed || !d.now) { doc.rect(cx + 1, ry, hm.cw - 2, 20).fill(C.white); hatch(doc, cx + 1, ry, hm.cw - 2, 20); return; }
        const v = diff(d, o), fill = v < -8 ? C.neg : v < -4 ? "#E9BAB5" : v <= 4 ? C.white : v <= 8 ? "#B6D5E9" : C.pos;
        doc.rect(cx + 1, ry, hm.cw - 2, 20).fill(fill); doc.rect(cx + 1, ry, hm.cw - 2, 20).lineWidth(0.5).strokeColor(C.grid).stroke();
        label7(doc, sgn(v, 1), cx, ry + 6, { w: hm.cw, align: "center", b: Math.abs(v) > 8, color: Math.abs(v) > 8 ? C.white : C.ink }); });
      label7(doc, d.suppressed ? "Not shown" : ONAME[d.dominant as O] ?? "", X0 + 12 + hm.lw + 4 * hm.cw + 8, ry + 6); });
    const hb = y + 40 + x.depts.length * 22 + 8;
    legend(doc, [["Below −8", "fill", C.neg], ["−8 to −4", "fill", "#E9BAB5"], ["−4 to +4", "fill", C.white], ["+4 to +8", "fill", "#B6D5E9"], ["Above +8", "fill", C.pos], ["Below reporting threshold", "hatch", ""]], X0 + 12, hb);
    label7(doc, "Difference from the organisation, in points", X0 + 12, hb + 12, { color: C.muted });
    y = hb + 32 + GAP;
    y = h2(doc, "Department summary", y) + 8;
    y = table(doc, { head: ["Department", "People", "Leading orientation", "Platform finding", "Voice flags"], cols: [0.22, 0.1, 0.24, 0.24, 0.2], right: [1], rows: x.depts.map((d) => [d.label, String(d.n ?? ""), d.suppressed ? "Not shown" : `${ONAME[d.dominant as O] ?? ""}${d.dominant !== orgLead ? ", differs" : ""}`, d.suppressed ? "" : n(x.deptSdi?.[d.label]) >= 12 ? "Subculture (High)" : "None", "None"] as Row) }, y) + GAP;
    so(`Programmes for the whole organisation will land unevenly. Plan separate conversations with ${list(other.map((d) => d.label))} before launch.`, y);
    // 9.k one page per department (owner Q-D9-25): finding, the department against the organisation, what the platform found and what to do
    for (const d of depts) {
      const diffs = [...O4].sort((p, q) => Math.abs(diff(d, q)) - Math.abs(diff(d, p))), top = diffs[0], dom0 = d.dominant as O, sub = n(x.deptSdi?.[d.label]) >= 12;
      const mine = adv.filter((v) => v.level === "GROUP" && v.scope_key === d.label).slice(0, 2);
      y = cont(d.label, `${d.label} leads with ${ONAME[dom0]} at ${d2(d.now![dom0])}${dom0 === orgLead ? ", as the organisation does" : `, where the organisation leads with ${ONAME[orgLead]}`}; its widest difference is ${ONAME[top]}, ${sgn(diff(d, top))} points.`);
      // the department against the organisation, orientation by orientation (editorial: arrow from the organisation to the department)
      panel(doc, X0, y, CW, 0, `${d.label} and the organisation, now`);
      tx(doc, `${d.n} people`, X1 - 120, y + 2, { f: "I6", size: 8, lead: 10, w: 120, align: "right", color: C.muted });
      dots(doc, X0, y + 26, CW, O4.map((o) => ({ label: ONAME[o], o, a: now[o], b: n(d.now![o]), col: HUE[o], right: sgn(diff(d, o)), hi: o === top })), { min: 10, max: 40, step: 10, lw: 70, rw: 50, rowH: 30, arrow: true, ref: 25, ticks: true });
      y += 26 + 4 * 30 + 28;
      legend(doc, [["Organisation", "diamond", C.ink], ["Department (arrow head)", "fill", C.ink]], X0, y);
      tx(doc, "Difference", X1 - 60, y - 2, { f: "I4", size: 8, lead: 10, w: 60, align: "right", color: C.muted });
      y += 18 + GAP;
      // four figures: lead, widest difference, platform finding, people
      const figs: [string, string, string][] = [["Leads with", ONAME[dom0], dom0 === orgLead ? "Same as the organisation" : "Differs from the organisation"], ["Widest difference", sgn(diff(d, top)), `${ONAME[top]}, in points`], ["Platform finding", sub ? "Subculture" : "None", sub ? "Distinct enough to treat on its own" : "Close to the organisation"], ["Answered", String(d.n), "People in this department"]];
      figs.forEach(([k, v, c0], i) => { const fw = (CW - 48) / 4, cx = X0 + i * (fw + 16); doc.moveTo(cx, y).lineTo(cx + fw, y).lineWidth(0.5).strokeColor(C.ink).stroke();
        tx(doc, k, cx, y + 8, { f: "I7", size: 7.5, lead: 10, caps: true, cs: 0.5, color: C.brand, w: fw }); tx(doc, v, cx, y + 22, { f: "I7", size: 18, lead: 22 }); tx(doc, c0, cx, y + 46, { size: 8.5, lead: 12, w: fw, color: C.muted }); });
      y += 72 + GAP;
      // where this department sits among all departments on its widest difference (a strip, this department in colour)
      panel(doc, X0, y, CW, 0, `Where ${d.label} sits among the departments on ${ONAME[top]}`);
      { const L0 = X0 + 20, W0 = CW - 40, sx = (v: number) => L0 + ((v - 10) / 30) * W0, cy = y + 48;
        doc.moveTo(L0, cy).lineTo(L0 + W0, cy).lineWidth(0.5).strokeColor(C.grid).stroke();
        doc.moveTo(sx(now[top]), cy - 14).lineTo(sx(now[top]), cy + 14).dash(1.5, { space: 2 }).lineWidth(0.75).strokeColor(C.ink).stroke().undash(); label7(doc, `Organisation ${d1(now[top])}`, sx(now[top]) - 45, cy + 20, { w: 90, align: "center", f: "I6" });
        // other departments in grey, names alternating above and below the line so close values do not collide
        depts.filter((o2) => o2 !== d).sort((p, q) => n(p.now![top]) - n(q.now![top])).forEach((o2, k) => { const vx = sx(n(o2.now![top])); doc.circle(vx, cy, 4).fill("#C7C6C6"); label7(doc, `${o2.label} ${d1(o2.now![top])}`, vx - 45, k % 2 ? cy + 7 : cy - 17, { w: 90, align: "center", color: C.muted }); });
        doc.circle(sx(n(d.now![top])), cy, 6).fill(HUE[top]); label7(doc, `${d.label} ${d1(d.now![top])}`, sx(n(d.now![top])) - 50, cy - 30, { w: 100, align: "center", f: "I7", color: HUE[top] });
      }
      y += 74 + GAP;
      // what the platform's advice says for this department (finding, consequence, action), or the orientation reading when there is none
      y = h2(doc, `What this means for ${d.label}`, y) + 8;
      const items = mine.length ? mine.map((v) => ({ title: clean(v.title), what: clean(v.diagnosis).split(/(?<=\.)\s/)[0], risk: v.risks[0] ? clean(v.risks[0]) : "", act: v.actions[0] ? `${clean(v.actions[0].text)}${v.actions[0].owner_role ? ` Owner: ${role(v.actions[0].owner_role)}.` : ""}${v.actions[0].horizon ? ` Timing: ${horizon(v.actions[0].horizon)}.` : ""}` : "" }))
        : [{ title: `${diff(d, top) > 0 ? "More" : "Less"} ${ONAME[top]} than the organisation`, what: `${d.label} scores ${d2(d.now![top])} on ${ONAME[top]} against ${d2(now[top])} for the organisation.`, risk: "", act: "Check with the department head whether the difference fits the work, and record the answer." }];
      for (const it0 of items) {
        doc.moveTo(X0, y).lineTo(X1, y).lineWidth(0.4).strokeColor(C.grid).stroke();
        let ly = tx(doc, it0.title, X0, y + 6, { f: "I6", size: 9.5, lead: 13, w: CW }) + 4;
        for (const [k, v] of [["Finding", it0.what], ["Consequence", it0.risk], ["Action", it0.act]] as const) { if (!v) continue; tx(doc, k, X0, ly, { f: "SB", size: 9, lead: 13 }); ly = tx(doc, v, X0 + 84, ly, { size: 9, lead: 13, w: CW - 84 }) + 3; }
        y = ly + 2;
      }
      so(sub ? `${d.label} runs on its own logic, led by ${ONAME[dom0]} at ${d2(d.now![dom0])}. Agree with its head whether that fits the work before the programme reaches this team.` : dom0 !== orgLead ? `${d.label} leads with ${ONAME[dom0]} where the organisation leads with ${ONAME[orgLead]}, though the platform does not flag it as a subculture. Check with its head that the ${sgn(diff(d, top))} point difference on ${ONAME[top]} fits the work.` : `${d.label} sits close to the organisation, so the organisation wide plan applies here; watch ${ONAME[top]}, ${sgn(diff(d, top))} points from the organisation.`, y + 4);
    }
  }

  // ================================================================ 10 leadership 360
  if (L) {
    const g = Object.entries(L.growth).sort((p, q) => q[1] - p[1])[0]?.[0], dft = Object.entries(L.defaults).sort((p, q) => q[1] - p[1])[0]?.[0];
    y = chapter("10", "Leadership 360 summary", [{ t: `${cap(count(L.valid))} of ${count(L.scored)} leaders have a usable 360 result. Most default to ${ONAME[dft as O] ?? "n/a"}, and the most common growth area is ${ONAME[g as O] ?? "n/a"}.` }]);
    cont("The collective leadership pattern", "", true);
    ([["Leaders with a result", String(L.valid), `of ${L.scored} with a 360`], ["Most common growth area", ONAME[g as O] ?? "n/a", "Across leaders"], ["Most common default", ONAME[dft as O] ?? "n/a", "Across leaders"], ["Integrity flags", String(Object.values(L.flags).reduce((t, v) => t + Number(v), 0)), "Followed up privately"]] as const).forEach(([k, v, c0], i) => {
      const cx = X0 + i * (112.82 + 16.67); panel(doc, cx, y, 112.82, 72); tx(doc, k, cx + 10, y + 10, { f: "I6", size: 7, lead: 9, caps: true, cs: 0.5, w: 95 }); tx(doc, v, cx + 10, y + 26, { f: "I7", size: 20, lead: 22 }); tx(doc, c0, cx + 10, y + 50, { f: "SI", size: 7, lead: 9, w: 95 }); });
    y += 72 + GAP;
    panel(doc, X0, y, HALF, 170, "Growth areas across leaders"); panel(doc, X0 + HALF + GAP, y, HALF, 170, "Default styles across leaders");
    const mx0 = Math.max(4, L.valid), st0 = Math.max(1, Math.ceil(mx0 / 4));
    hbars(doc, X0 + 12, y + 34, HALF - 24, O4.map((o) => ({ label: ONAME[o], v: Number(L.growth[o] ?? 0), col: HUE[o], show: String(L.growth[o] ?? 0) })), { min: 0, max: st0 * 4, step: st0, lw: 52, rowH: 28 });
    hbars(doc, X0 + HALF + GAP + 12, y + 34, HALF - 24, O4.map((o) => ({ label: ONAME[o], v: Number(L.defaults[o] ?? 0), col: HUE[o], show: String(L.defaults[o] ?? 0) })), { min: 0, max: st0 * 4, step: st0, lw: 52, rowH: 28 });
    label7(doc, "Number of leaders", X0 + 12, y + 156, { color: C.muted }); label7(doc, "Number of leaders", X0 + HALF + GAP + 12, y + 156, { color: C.muted });
    y += 170 + GAP;
    panel(doc, X0, y, CW, 96, "Self and others by section");
    tx(doc, "Section scores for self and others are not in this data set yet. The platform will show the average self rating against the average rating from others, per section, across all valid leaders and with no leader named.", X0 + 12, y + 34, { w: CW - 24 });
    y += 96 + GAP;
    y = h2(doc, "Leaders by readiness band", y) + 10;
    { const bands = Object.entries(L.bands), tot = bands.reduce((t, [, c0]) => t + Number(c0), 0) || 1; let bx = X0;
      bands.forEach(([b, c0], i) => { const w0 = (CW * Number(c0)) / tot; doc.roundedRect(bx, y, w0 - 2, 22, 4).fill([C.ink, "#8C8A87", "#C7C6C6", C.grid][i % 4]); tx(doc, `${human(b)}: ${c0}`, bx + 8, y + 6, { f: "I7", size: 8.5, lead: 10, color: i < 2 ? C.white : C.ink }); bx += w0; });
      y += 22 + GAP; }
    so(`Leaders default to ${ONAME[dft as O] ?? "n/a"} while the culture leads with ${ONAME[lead]}. Moving toward ${ONAME[g as O] ?? "the growth area"} asks leaders to work outside their default: coaching and visible recognition, not a one off course.`, y);
  }

  // ================================================================ 11 what this means
  y = chapter("11", "What this means", [{ t: `${org} delivers well, at ${d2(now[lead])} on ${ONAME[lead]}, but the strategy needs ${ONAME[lastO]}, and staff and leaders do not yet see the same organisation.` }]);
  cont("The four step conclusion", "", true);
  panel(doc, X0, y, CW, 210);
  const four = [["Where the culture is", d2(now[lead]), `${ONAME[lead]} now`, `${ONAME[lead]} leads, ${ONAME[second]} second; the lead is only ${d2(now[lead] - now[second])} points.`], ["Where people want it to go", sgn(gap[upMost]), `${ONAME[upMost]} wanted`, `More ${list(O4.filter((o) => gap[o] > 0).map((o) => ONAME[o]))}, less ${list(O4.filter((o) => gap[o] < 0).map((o) => ONAME[o]))}.`], ["Where it does not support the strategy", `${hits} of ${CK.length}`, "Checks met", `${ONAME[lastO]}, at ${d2(now[lastO])}, is weakest where the strategy needs it.`], ["What limits the change", d2(rd.tps), "Readiness, 1 to 5", `${human(rd.tps_band ?? "")}; the weakest readiness item is ${d2(lowItem)}.`]];
  four.forEach(([k, v, c0, b], i) => { const cx = X0 + 12 + i * 122.82; doc.circle(cx + 8, y + 20, 8).fill(C.brand); tx(doc, String(i + 1), cx, y + 15.5, { f: "I7", size: 8, lead: 9, w: 16, align: "center" });
    if (i < 3) doc.moveTo(cx + 20, y + 20).lineTo(cx + 118, y + 20).lineWidth(0.75).strokeColor(C.brand).stroke();
    tx(doc, k, cx, y + 36, { f: "I7", size: 7.5, lead: 10, caps: true, cs: 0.5, w: 108 }); tx(doc, v, cx, y + 62, { f: "I7", size: 20, lead: 24 }); tx(doc, c0, cx, y + 88, { f: "SI", size: 8, lead: 10, w: 108 }); tx(doc, b, cx, y + 106, { size: 9, lead: 13, w: 108 }); });
  y += 210 + GAP;
  y = h2(doc, "The evidence behind each step", y) + 8;
  y = table(doc, { head: ["Step", "Measure", "Value", "Read with"], cols: [0.3, 0.28, 0.14, 0.28], right: [2], rows: [["Where the culture is", `${ONAME[lead]} now`, d2(now[lead]), "Chapter 03"], ["Where people want it to go", `Largest gap, ${ONAME[upMost]}`, sgn(gap[upMost]), "Chapter 04"], ["Where it does not support the strategy", "Strategy checks met", `${hits} of ${CK.length}`, "Chapter 05"], ["What limits the change", "Readiness overall", d2(rd.tps), "Chapter 07"]] }, y) + GAP;
  so(`Start with what people already value: ${ONAME[lead]} delivery stays. Add ${ONAME[upMost]} and ${ONAME[lastO]} in small, visible steps the readiness of ${d2(rd.tps)} can carry.`, y);

  // ================================================================ 12 what to do next
  show(true);
  type Pri = { o: O; title: string; kind: string; owner: string; timing: string; finding: string; ev: [string, string][]; cons: string; act: string; signal: string };
  const pris: Pri[] = (P?.priorities ?? []).slice(0, 5).map((p) => { const o = p.orientation as O, ad = advFor(o), act = P!.actions.filter((z) => z.priority_id === p.priority_id).sort((u, v) => Number(v.priority_score ?? 0) - Number(u.priority_score ?? 0))[0];
    return { o, kind: ONAME[o], title: `${gap[o] > 0 ? "Build" : "Rebalance"} ${ONAME[o]}: from ${d2(now[o])} toward ${d2(pref[o])}`, owner: p.owner_role ? role(p.owner_role) : "to be confirmed", timing: act?.horizon ? horizon(act.horizon) : "to be confirmed",
      finding: `People want ${gap[o] > 0 ? "more" : "less"} ${ONAME[o]}: ${sgn(gap[o])} points between Now and Preferred.`,
      ev: [[d2(now[o]), "Now"], [d2(pref[o]), "Preferred"], [sgn(gap[o]), "Gap"], ...(pg ? [[d2(pg[o]), "Executives and staff apart"] as [string, string]] : [])],
      cons: ad?.risks[0] ?? "", act: act ? clean(`${act.objective}. ${act.intervention}`) : ad?.actions[0]?.text ?? "", signal: ad?.signal ?? "" }; });
  if (!pris.length) for (const o of byGap.slice(0, 3)) { const ad = advFor(o); pris.push({ o, kind: ONAME[o], title: `${gap[o] > 0 ? "Build" : "Rebalance"} ${ONAME[o]}`, owner: ad?.actions[0]?.owner_role ?? "to be confirmed", timing: ad?.actions[0]?.horizon ?? "to be confirmed", finding: `People want ${gap[o] > 0 ? "more" : "less"} ${ONAME[o]}: ${sgn(gap[o])} points.`, ev: [[d2(now[o]), "Now"], [d2(pref[o]), "Preferred"], [sgn(gap[o]), "Gap"]], cons: ad?.risks[0] ?? "", act: ad?.actions[0]?.text ?? "", signal: ad?.signal ?? "" }); }
  const pill = (t0: string, px: number, py: number) => { const w0 = tw(doc, t0, "I6", 7.5) + 16; doc.roundedRect(px - w0, py, w0, 16, 8).fill(C.surface); tx(doc, t0, px - w0 + 8, py + 3, { f: "I6", size: 7.5, lead: 10 }); return w0; };
  const priCard = (p: Pri, i: number, cy: number) => {
    const iw = CW - 24, body = (t0: string) => th(doc, t0, iw - 96, "S", 9, 13);
    const hh = 12 + 22 + 18 + body(p.finding) + 6 + 40 + 6 + body(p.cons) + 6 + body(p.act) + 8 + (p.signal ? th(doc, p.signal, iw - 24, "S", 9, 13) + 20 : 0) + 8;
    doc.rect(X0, cy, CW, hh).fill(C.white); doc.rect(X0, cy, CW, 1.5).fill(C.brand);
    doc.circle(X0 + 20, cy + 20, 8).fill(C.brand); tx(doc, String(i + 1), X0 + 12, cy + 15.5, { f: "I7", size: 8, lead: 9, w: 16, align: "center" });
    tx(doc, `Priority ${i + 1} · ${p.kind}`, X0 + 34, cy + 15, { f: "I7", size: 7, lead: 9, caps: true, cs: 0.5 });
    const w1 = pill(`Timing: ${p.timing}`, X1 - 12, cy + 11); pill(`Owner: ${p.owner}`, X1 - 12 - w1 - 6, cy + 11);
    let ly = tx(doc, p.title, X0 + 12, cy + 36, { f: "I6", size: 10, lead: 14, w: iw }) + 6;
    const row = (k: string, draw: () => number) => { tx(doc, k, X0 + 12, ly, { f: "SB", size: 9, lead: 13 }); ly = draw() + 6; };
    row("Finding", () => tx(doc, p.finding, X0 + 108, ly, { size: 9, lead: 13, w: iw - 96 }));
    row("Evidence", () => {
      // owner Q-D9-17: the evidence as a small chart, Now (hollow) to Preferred (arrow head) on a 10 to 40 scale, with the gap beside it
      const L0 = X0 + 108, W0 = 230, sx = (v: number) => L0 + ((v - 10) / 30) * W0, cy = ly + 10, a0 = sx(now[p.o]), b0 = sx(pref[p.o]), dd = b0 >= a0 ? 1 : -1;
      doc.moveTo(L0, cy).lineTo(L0 + W0, cy).lineWidth(0.4).strokeColor(C.grid).stroke();
      doc.moveTo(sx(25), cy - 8).lineTo(sx(25), cy + 8).dash(1.5, { space: 2 }).lineWidth(0.6).strokeColor(C.muted).stroke().undash();
      doc.moveTo(a0 + dd * 4, cy).lineTo(b0 - dd * 6, cy).lineWidth(2.5).strokeColor(HUE[p.o]).stroke(); doc.polygon([b0, cy], [b0 - dd * 8, cy - 5], [b0 - dd * 8, cy + 5]).fill(HUE[p.o]); doc.circle(a0, cy, 4.5).lineWidth(2).fillAndStroke(C.white, HUE[p.o]);
      label7(doc, `Now ${d2(now[p.o])}`, dd > 0 ? a0 - 62 : a0 + 8, cy - 5, { w: 54, align: dd > 0 ? "right" : "left", color: C.muted }); label7(doc, `Preferred ${d2(pref[p.o])}`, dd > 0 ? b0 + 6 : b0 - 84, cy - 5, { w: 78, align: dd > 0 ? "left" : "right", f: "I7", color: HUE[p.o] });
      p.ev.slice(2).forEach(([v, k], j) => { const ex = L0 + W0 + 50 + j * 72; tx(doc, v, ex, ly - 2, { f: "I7", size: 13, lead: 16 }); tx(doc, k, ex, ly + 15, { f: "I4", size: 7.5, lead: 9, color: C.muted, w: 70 }); });
      return ly + 34; });
    if (p.cons) row("Consequence", () => tx(doc, p.cons, X0 + 108, ly, { size: 9, lead: 13, w: iw - 96 }));
    if (p.act) row("Action", () => tx(doc, p.act, X0 + 108, ly, { size: 9, lead: 13, w: iw - 96 }));
    if (p.signal) { const sh = th(doc, p.signal, iw - 120, "S", 9, 13) + 12; doc.roundedRect(X0 + 12, ly, iw, sh, 3).fill(C.surface); icon(doc, "watch", X0 + 20, ly + 6, C.ink, 9); tx(doc, "Signal to watch", X0 + 33, ly + 6, { f: "I7", size: 7, lead: 9, caps: true, cs: 0.5 }); tx(doc, p.signal, X0 + 120, ly + 5, { size: 9, lead: 13, w: iw - 120 }); ly += sh + 6; }
    return Math.max(cy + hh, ly + 6);
  };
  y = chapter("12", "What to do next", [{ t: `${cap(count(pris.length))} priorities, in order. Start with the ` }, { t: d2(gap[pris[0]?.o ?? upMost]).replace(/^\+/, ""), hi: true }, { t: ` point gap on ${ONAME[pris[0]?.o ?? upMost]}.` }]);
  cont("Priorities", "", true);
  let pi = 0;
  while (pi < pris.length) { if (pi > 0) { addPage(); y = section(doc, `12.1`, "Priorities, continued") + 16; } for (let k = 0; k < 2 && pi < pris.length; k++, pi++) y = priCard(pris[pi], pi, y) + GAP; }
  // 12.2 quick wins
  const wins = String((l.rep.sections_json as Record<string, string>)?.quick_wins ?? "").split("\n").map((t0) => t0.trim()).filter(Boolean);
  if (y > 560) { addPage(); y = TOP; }
  cont("Quick wins, first 30 days", "", true);
  y = section(doc, "12.2", "Quick wins, first 30 days", y) + 8;
  y = table(doc, { head: ["#", "Quick win", "Owner", "Done by"], cols: [0.06, 0.6, 0.18, 0.16], right: [], rows: (wins.length ? wins : ["To be agreed at the leadership debrief"]).slice(0, 6).map((w, i) => [String(i + 1), w, i === 0 ? "Chief executive" : "Executive team", `Day ${[10, 14, 30, 30, 30, 30][i]}`] as Row) }, y) + GAP;
  // 12.3 phase plan
  show(false);
  y = cont("Phase plan", "Three phases over 18 months, with the culture measured again at months 12 and 18.");
  // owner Q-D9-18: three phase bands, one bar per priority, quick wins as dots in month 1, pulses and reassessments as diamonds
  panel(doc, X0, y, CW, 0, "Plan over 18 months");
  const RL = X0 + 140, RW = CW - 150, mx = (mm: number) => RL + (RW * mm) / 18, rTop = y + 26, rows0 = pris.length + 1, rH = 34 + rows0 * 30 + 40;
  const PH3 = [["Months 1 to 3", "Listen and respond", 0, 3], ["Months 4 to 9", "Pilot and connect", 3, 9], ["Months 10 to 18", "Scale and embed", 9, 18]] as const;
  PH3.forEach(([k, , a0, b0], i) => { doc.rect(mx(a0), rTop, mx(b0) - mx(a0) - 2, rH).fill(i % 2 ? "#F1EEE9" : "#F6F3EE"); tx(doc, k, mx(a0) + 4, rTop + 5, { f: "I7", size: 7, lead: 9, caps: true, cs: 0.3, color: C.brand, w: mx(b0) - mx(a0) - 8 }); });
  const wy = rTop + 34; tx(doc, "Quick wins", X0, wy - 1, { f: "I6", size: 8.5, lead: 11, w: 136 });
  const nw = Math.max(1, Math.min(6, wins.length)); for (let k = 0; k < nw; k++) doc.circle(mx(0.15 + (k * 0.8) / nw), wy + 5, 3.5).fill(C.brand);
  label7(doc, `${count(nw)} in the first 30 days`, mx(1.1), wy, { color: C.muted });
  pris.forEach((p, i) => { const ry = wy + 30 + i * 30, a0 = i === 0 ? 0 : i < 3 ? 1 : 3, b0 = i === 0 ? 4 : i < 3 ? 12 : 15;
    oname(doc, p.o, X0, ry, 136); label7(doc, `Priority ${i + 1}`, X0 + 70, ry, { color: C.muted });
    rbar(doc, mx(a0), ry, mx(b0) - mx(a0), 10, HUE[p.o]); label7(doc, p.title.split(":")[0], mx(a0) + 4, ry + 0.5, { color: C.white, f: "I6", w: mx(b0) - mx(a0) - 8 }); });
  const mY = rTop + rH - 14;
  for (const [mm, k] of [[3, "Pulse"], [6, "Pulse"], [12, "Reassess"], [18, "Reassess"]] as const) { doc.moveTo(mx(mm), rTop + 30).lineTo(mx(mm), mY).dash(1.5, { space: 2 }).lineWidth(0.6).strokeColor(C.ink).stroke().undash(); diamond(doc, mx(mm), mY, 4.5, mm >= 12, C.ink); label7(doc, k, mx(mm) - 26, mY + 7, { w: 52, align: "center", b: true }); label7(doc, `Month ${mm}`, mx(mm) - 26, mY + 17, { w: 52, align: "center", color: C.muted }); }
  y = mY + 40 + GAP;
  // what each phase delivers, as three columns under their bands (no table)
  const PD = [[`Listening round and written executive response. ${pris[0] ? pris[0].title.split(":")[0] + "." : ""}`, "Staff see the executive response before day 30."],
    [`${pris.slice(1, 3).map((p) => p.title.split(":")[0]).join(". ")}. Boundary sessions between departments.`, `${negVoice[0] ? `${negVoice[0].nm} above ${num(negVoice[0].v, 0)}` : "Voice scores improve"} at the first pulse.`],
    ["Scale the pilots that worked; build the new behaviour into goals and recognition.", `${ONAME[upMost]} on its 12 and 18 month targets (chapter 13).`]];
  const pw0 = (CW - 32) / 3;
  const ph = PD.map(([k0, s0]) => 24 + th(doc, k0, pw0, "S", 9, 13) + 22 + th(doc, s0, pw0, "S", 9, 13));
  PD.forEach(([k0, s0], i) => { const cx = X0 + i * (pw0 + 16); doc.moveTo(cx, y).lineTo(cx + pw0, y).lineWidth(0.5).strokeColor(C.ink).stroke();
    tx(doc, PH3[i][1], cx, y + 6, { f: "I7", size: 9.5, lead: 13 }); let ly = tx(doc, k0, cx, y + 24, { size: 9, lead: 13, w: pw0 }) + 6;
    ly = tx(doc, "Success looks like", cx, ly, { f: "I7", size: 7, lead: 10, caps: true, cs: 0.5, color: C.brand }) + 2; tx(doc, s0, cx, ly, { size: 9, lead: 13, w: pw0 }); });
  y += Math.max(...ph) + GAP;
  y = h2(doc, "What each milestone checks", y) + 10;
  ([["Pulse, month 3", "Short staff pulse on the four voice scores below zero and the executive and staff gap."], ["Pulse, month 6", "Second pulse; the Culture Practitioner reviews any trigger and adjusts or retires actions."], ["Reassess, month 12", "Full reassessment against this baseline; 12 month KPI targets read."], ["Reassess, month 18", "18 month targets read; the plan for the next cycle is agreed."]] as const).forEach(([k0, v0], i) => {
    const cw0 = (CW - 48) / 4, cx = X0 + i * (cw0 + 16); doc.moveTo(cx, y).lineTo(cx + cw0, y).lineWidth(0.5).strokeColor(C.ink).stroke();
    diamond(doc, cx + 4, y + 12, 4, i >= 2, C.ink); tx(doc, k0, cx + 14, y + 6, { f: "I7", size: 8.5, lead: 12, w: cw0 - 14 }); tx(doc, v0, cx, y + 24, { size: 8.5, lead: 12, w: cw0 }); });
  y += 84 + GAP;
  so(`The first phase carries the most weight: the executive response to the ${pg && pgTop ? `${d2(pg[pgTop])} point ${ONAME[pgTop]} split` : "results"} comes first, because every later step depends on staff trusting it.`, y);
  // 12.4 principles
  y = cont("Change principles and non negotiables", "Six principles guide every action in this plan, and four rules hold however strong the pressure to move fast.");
  const princ: [string, string][] = [["Listen before launching", `Executives and staff sit ${pg && pgTop ? d2(pg[pgTop]) : "apart"} points apart on ${pgTop ? ONAME[pgTop] : "the lead orientation"}. Each initiative starts from what staff said.`], [`Keep what works in ${ONAME[lead]}`, `${ONAME[lead]} leads at ${d2(now[lead])} and carries delivery. People want less of it (${sgn(gap[lead])}), so ease how people are managed.`],
    [`Grow ${ONAME[lastO]} where it already lives`, `${depts.length ? (() => { const dd = [...depts].sort((p, q) => n(q.now![lastO]) - n(p.now![lastO]))[0]; return `${dd.label} scores ${d1(dd.now![lastO])} on ${ONAME[lastO]}, the highest of any department.`; })() : `${ONAME[lastO]} is lowest at ${d2(now[lastO])}.`} Spread its methods first.`],
    ["Give the reason for every decision", thr ? `Decisions draw ${thr.find((t0) => /decision/i.test(t0.theme))?.share ?? thr[0].share} percent of comments. Every change states why, who decided and what happens next.` : "Every change states why, who decided and what happens next."],
    ["One scorecard, local actions", `${cap(count(depts.length))} departments show different lead orientations. Heads adapt the actions; the scorecard stays the same for all.`],
    ["Recognise the behaviour you want", `${thr?.[0] ? `${thr[0].theme} is the top comment theme at ${thr[0].share} percent. ` : ""}Thank ${ONAME[upMost]} and ${ONAME[lastO]} behaviour in public, every month.`]];
  princ.forEach(([k, v], i) => { const cx = X0 + (i % 2) * (HALF + GAP), cy = y + Math.floor(i / 2) * (88 + 12); panel(doc, cx, cy, HALF, 88); doc.circle(cx + 20, cy + 20, 8).fill(C.brand); tx(doc, String(i + 1), cx + 12, cy + 15.5, { f: "I7", size: 8, lead: 9, w: 16, align: "center" });
    tx(doc, k, cx + 34, cy + 13, { f: "I6", size: 9.5, lead: 13, w: HALF - 46 }); tx(doc, v, cx + 12, cy + 36, { size: 9, lead: 13, w: HALF - 24 }); });
  y += 3 * 100 + 4;
  const nn = NON_NEGOTIABLES.slice(0, 4), nh = 30 + nn.reduce((t, z) => t + th(doc, z, CW - 48) + 6, 0) + 8;
  doc.roundedRect(X0, y, CW, nh, 4).fill(C.surface); doc.rect(X0, y, CW, 1.5).fill(C.brand); tx(doc, "Non negotiables", X0 + 12, y + 12, { f: "I7", size: 8, lead: 10, caps: true, cs: 0.5 });
  let ny = y + 30; for (const z of nn) { icon(doc, "cross", X0 + 12, ny + 2); ny = tx(doc, z, X0 + 30, ny, { w: CW - 48 }) + 6; }

  // ================================================================ 13 KPI scorecard
  show(true);
  const kp: { k: string; base: number; dir: "up" | "down"; sc: [string, string]; d: number; src: string; whole?: boolean; ofN?: number }[] = [
    { k: `${ONAME[upMost]}, share of the culture`, base: now[upMost], dir: "up", sc: ["0", "100"], d: 2, src: "CDP reassessment" },
    { k: `${ONAME[lastO]}, share of the culture`, base: now[lastO], dir: "up", sc: ["0", "100"], d: 2, src: "CDP reassessment" },
    ...(pg && pgTop ? [{ k: `Executive and staff gap on ${ONAME[pgTop]}, lower is better`, base: n(pg[pgTop]), dir: "down" as const, sc: ["0", "100"] as [string, string], d: 2, src: "CDP cohorts" }] : []),
    ...negVoice.slice(0, 4).map((z) => ({ k: `Voice: ${z.nm}`, base: z.v, dir: "up" as const, sc: ["-100", "100"] as [string, string], d: 2, src: "CDP employee voice" })),
    ...(rd.tps ? [{ k: "Readiness, 1 to 5", base: n(rd.tps), dir: "up" as const, sc: ["1", "5"] as [string, string], d: 2, src: "CDP readiness" }] : []),
    ...(a.risk ? [{ k: "Culture Risk Index, lower is better", base: n(a.risk.index), dir: "down" as const, sc: ["0", "100"] as [string, string], d: 0, src: "CDP analytics" }] : []),
    ...(L ? [{ k: "Leaders ready with support", base: Number(Object.entries(L.bands).find(([b]) => /support/i.test(b))?.[1] ?? 0), dir: "up" as const, sc: ["0", String(L.valid)] as [string, string], d: 1, src: "Leadership 360", whole: true, ofN: L.valid }] : []),
  ];
  const tgt = (z: (typeof kp)[number]) => { const [a12, a18] = kpiTargets(String(z.base), z.dir, z.sc, z.d).map(Number); return z.whole ? [Math.ceil(a12 - 1e-9), Math.ceil(a18 - 1e-9)] : [a12, a18]; };
  const fmtK = (z: (typeof kp)[number], v: number, base = false) => (z.whole ? `${v} of ${z.ofN}` : z.d === 0 || (base && z.k.startsWith("Voice")) ? num(Math.round(v), 0) : num(v, z.d));
  y = chapter("13", "Culture KPI scorecard", [{ t: `${cap(count(kp.length))} measures track the plan. ${ONAME[upMost]} has the furthest to travel, from ` }, { t: d2(now[upMost]), hi: true }, { t: ` now to ${num(tgt(kp[0])[1], 2)} at 18 months.` }]);
  cont("Baseline and targets", "", true);
  // owner Q-D9-20: each measure as a row: baseline (hollow), 12 month (tick) and 18 month (arrow head) on its own scale; top six here
  const top6 = kp.slice(0, 6);
  tx(doc, "Baseline", X0 + 300, y, { f: "I4", size: 8, lead: 10, color: C.muted }); tx(doc, "12 month", X0 + 350, y, { f: "I4", size: 8, lead: 10, color: C.muted }); tx(doc, "18 month", X0 + 400, y, { f: "I4", size: 8, lead: 10, color: C.muted, w: 99, align: "right" });
  y += 16;
  top6.forEach((z, i) => { const [t12, t18] = tgt(z), ry = y + i * 46, vals = [z.base, t12, t18], lo = Math.min(...vals), hi = Math.max(...vals), pad0 = (hi - lo) * 0.25 || 1;
    const L0 = X0, W0 = 280, sx = (v: number) => L0 + 6 + ((v - (lo - pad0)) / (hi - lo + 2 * pad0)) * (W0 - 12), dd = sx(t18) >= sx(z.base) ? 1 : -1;
    doc.moveTo(X0, ry).lineTo(X1, ry).lineWidth(0.4).strokeColor(C.grid).stroke();
    tx(doc, z.k, L0, ry + 4, { f: "I6", size: 8.5, lead: 11, w: W0 }); tx(doc, z.src, L0, ry + 16, { f: "I4", size: 7.5, lead: 9, color: C.muted });
    const cy = ry + 34; doc.moveTo(L0, cy).lineTo(L0 + W0, cy).lineWidth(0.4).strokeColor(C.grid).stroke();
    doc.moveTo(sx(z.base) + dd * 4, cy).lineTo(sx(t18) - dd * 6, cy).lineWidth(2.5).strokeColor(C.ink).stroke(); doc.polygon([sx(t18), cy], [sx(t18) - dd * 8, cy - 5], [sx(t18) - dd * 8, cy + 5]).fill(C.brand);
    doc.moveTo(sx(t12), cy - 6).lineTo(sx(t12), cy + 6).lineWidth(1.5).strokeColor(C.ink).stroke(); doc.circle(sx(z.base), cy, 4.5).lineWidth(2).fillAndStroke(C.paper, C.ink);
    tx(doc, fmtK(z, z.base, true), X0 + 300, ry + 12, { f: "I4", size: 10, lead: 12 }); tx(doc, fmtK(z, t12), X0 + 350, ry + 12, { f: "I6", size: 10, lead: 12 }); tx(doc, fmtK(z, t18), X0 + 400, ry + 12, { f: "I7", size: 10, lead: 12, w: 99, align: "right" }); });
  y += top6.length * 46 + 4;
  legend(doc, [["Baseline", "diamond", C.ink], ["12 month target", "line", C.ink], ["18 month target", "fill", C.brand]], X0, y);
  y = tx(doc, `Targets are set by the platform and may be changed by the Culture Practitioner before release.${kp.length > 6 ? ` The other ${count(kp.length - 6)} measures are in appendix A.` : ""}`, X0, y + 14, { f: "SI", size: 8, lead: 12, color: C.muted, w: CW }) + GAP;
  so(`Targets for ${ONAME[upMost]} and ${ONAME[lastO]} follow what staff said they prefer. The voice scores and the executive and staff gap are the early signals; they move first or the targets will not.`, y);
  // 13.2 governance
  show(false);
  y = cont("Governance, leading and lagging measures", "The executive team reviews the scorecard every quarter. Voice scores give the early warning; culture shares confirm it.");
  y = h2(doc, "Governance rhythm", y) + 8;
  y = table(doc, { head: ["Forum", "Who", "How often", "What it reviews"], cols: [0.24, 0.3, 0.16, 0.3], right: [], rows: [["Executive culture review", "Chief executive and executive team, with the Culture Practitioner", "Every quarter", "Scorecard, progress on the priorities, risks"], ["Department check in", "Each department head with the team", "Every month", "Quick wins, pilot progress, local voice"], ["Staff pulse", "All staff, anonymous, groups of 5 or more", "Every 6 months", "Voice scores, executive and staff gap, comment themes"], ["Board update", "Board, presented by the chief executive", "Every 6 months", "Scorecard summary and decisions needed"]] }, y) + GAP;
  panel(doc, X0, y, HALF, 150, "Leading measures"); panel(doc, X0 + HALF + GAP, y, HALF, 150, "Lagging measures");
  tx(doc, "Move first. Read every quarter.", X0 + 12, y + 26, { f: "SI", size: 8, lead: 10 }); tx(doc, "Move last. Read at 12 and 18 months.", X0 + HALF + GAP + 12, y + 26, { f: "SI", size: 8, lead: 10 });
  const lead2: [string, string][] = [...negVoice.slice(0, 4).map((z) => [z.nm, num(z.v, 0)] as [string, string]), ...(thr?.[0] ? [[`${thr[0].theme} share of comments`, `${thr[0].share}%`] as [string, string]] : [])];
  const lag2: [string, string][] = [[`${ONAME[upMost]} share`, d2(now[upMost])], [`${ONAME[lastO]} share`, d2(now[lastO])], ...(pg && pgTop ? [[`Executive and staff gap on ${ONAME[pgTop]}`, d2(pg[pgTop])] as [string, string]] : []), ["Readiness, 1 to 5", d2(rd.tps)], ...(a.risk ? [["Culture Risk Index", String(Math.round(n(a.risk.index)))] as [string, string]] : [])];
  for (const [col, rows0] of [[X0 + 12, lead2], [X0 + HALF + GAP + 12, lag2]] as const) rows0.slice(0, 6).forEach(([k, v], i) => { const ry = y + 44 + i * 17; tx(doc, k, col, ry, { f: "I4", size: 8, lead: 11, w: HALF - 80 }); tx(doc, v, col, ry, { f: "I7", size: 8, lead: 11, w: HALF - 24, align: "right" }); doc.moveTo(col, ry + 14).lineTo(col + HALF - 24, ry + 14).lineWidth(0.5).strokeColor(C.grid).stroke(); });
  y += 150 + GAP;
  so(`If the ${count(negVoice.length)} voice scores below zero have not moved by the first staff pulse, revisit priorities 1 and ${Math.min(3, pris.length)} before the 12 month reassessment.`, y);

  // ================================================================ appendix A data tables
  y = chapter("A", "Data tables", []); toc[toc.length - 1].subs = [];
  y = TOP + 48;
  cont("Dimension scores, now and preferred", "", true);
  y = h2(doc, "A.1 Dimension scores, now and preferred", y) + 8;
  y = table(doc, { head: ["Dimension", ...O4.map((o) => ONAME[o]), ...O4.map((o) => ONAME[o])], group: [{ label: "Now", from: 1, to: 4 }, { label: "Preferred", from: 5, to: 8 }], cols: [0.2, ...Array(8).fill(0.1)], rows: [...DIMS.map((d) => [DIMENSION[d].name, ...O4.map((o) => d2(dn[d][o])), ...O4.map((o) => d2(dp0[d]?.[o]))] as Row), ["All dimensions", ...O4.map((o) => d2(now[o])), ...O4.map((o) => d2(pref[o]))] as Row].map((r) => starRows(starRows([r], [1, 2, 3, 4]), [5, 6, 7, 8])[0]) }, y) + GAP;
  if (x.depts?.length) { cont("Department scores", "", true); y = h2(doc, "A.2 Department scores", y) + 8;
    y = table(doc, { head: ["Department", "People", ...O4.map((o) => ONAME[o]), "Leads"], cols: [0.22, 0.1, 0.15, 0.15, 0.15, 0.13, 0.1], right: [1, 2, 3, 4, 5], rows: [...x.depts.map((d) => d.suppressed || !d.now ? [d.label, String(d.n ?? ""), "", "", "", "", "Not shown"] as Row : [d.label, String(d.n), ...O4.map((o) => ({ t: d1(d.now![o]), muted: `(${sgn(n(d.now![o]) - now[o], 1)})` })), ONAME[d.dominant as O] ?? ""] as Row), ["Organisation", String(nResp), ...O4.map((o) => d1(now[o])), ONAME[lead]] as Row] }, y) + 4;
    y = tx(doc, "Department values are now; the difference from the organisation is in brackets. Departments under 5 people are not shown.", X0, y, { f: "SI", size: 8, lead: 12, color: C.muted }) + GAP; }
  cont("Orientation scores by lens, now", "", true); y = h2(doc, "A.3 Orientation scores by lens, now", y) + 8;
  table(doc, { head: ["Lens", ...O4.map((o) => ONAME[o])], cols: [0.28, 0.18, 0.18, 0.18, 0.18], rows: starRows(["PRACTICE", "STRATEGY", "LEADERSHIP"].map((k) => [human(k), ...O4.map((o) => d2(lens[k]?.[o]))] as Row), [1, 2, 3, 4]) }, y);
  addPage(); y = section(doc, "A", "Data tables, continued") + 8; const tA = toc[toc.length - 1];
  tA.subs.push({ n: "A.4", title: "Readiness item scores, 1 to 5", page: pageNo() });
  y = h2(doc, "A.4 Readiness item scores, 1 to 5", y) + 8;
  const nItems = Math.max(...R3.map((k) => (items[k] ?? []).length), 0);
  y = table(doc, { head: ["Item", ...R3.map((k) => READINESS[k].name)], cols: [0.28, 0.24, 0.24, 0.24], rows: [...Array.from({ length: nItems }, (_, i) => [`Item ${i + 1}`, ...R3.map((k) => d2(items[k]?.[i]))] as Row), starRows([["Mean", ...R3.map((k) => d2(rd[k.toLowerCase()]))] as Row], [1, 2, 3])[0]] }, y) + 4;
  y = tx(doc, "Item wording is held in the platform question bank and is not printed in client reports.", X0, y, { f: "SI", size: 8, lead: 12, color: C.muted }) + GAP;
  tA.subs.push({ n: "A.5", title: "Employee voice detail", page: pageNo() });
  y = h2(doc, "A.5 Employee voice detail", y) + 8;
  table(doc, { head: ["Voice score", "Answers", "Promoters", "Passives", "Detractors", "Score"], cols: [0.32, 0.12, 0.14, 0.14, 0.14, 0.14], rows: EOS_NAMES.map((nm, i) => { const dd = det[`Q${i + 1}`] ?? {}; return [nm, String(dd.n ?? ""), String(dd.promoters ?? ""), String(dd.passives ?? ""), String(dd.detractors ?? ""), sgn(eos(i), 0)] as Row; }) }, y);
  // the tables taken out of the chapters (owner Q-D9-13)
  addPage(); y = section(doc, "A", "Data tables, continued") + 8;
  tA.subs.push({ n: "A.6", title: "Gap by dimension, in points", page: pageNo() });
  y = h2(doc, "A.6 Gap by dimension, in points", y) + 8;
  y = table(doc, { head: ["Dimension", ...O4.map((o) => ONAME[o]), "Largest shift"], cols: [0.26, 0.12, 0.12, 0.12, 0.12, 0.26], right: [1, 2, 3, 4], rows: DIMS.map((d) => { const top = [...O4].sort((p, q) => Math.abs(gd(d, q)) - Math.abs(gd(d, p)))[0]; return [DIMENSION[d].name, ...O4.map((o) => (o === top ? { t: sgn(gd(d, o)), star: true } : sgn(gd(d, o)))), `${ONAME[top]}, ${sgn(gd(d, top))}`] as Row; }) }, y) + GAP;
  tA.subs.push({ n: "A.7", title: "Spread of answers by dimension", page: pageNo() });
  y = h2(doc, "A.7 Spread of answers by dimension", y) + 8;
  y = table(doc, { head: ["Dimension", ...O4.map((o) => ONAME[o]), "Average"], cols: [0.26, 0.13, 0.13, 0.13, 0.13, 0.22], right: [1, 2, 3, 4, 5], rows: starRows([...DIMS.map((d) => [DIMENSION[d].name, ...O4.map((o) => d2(disp[d]?.[o])), d2(O4.reduce((t, o) => t + n(disp[d]?.[o] ?? 0), 0) / 4)] as Row), ["All dimensions", ...O4.map((o) => d2(spreadO(o))), d2(disp.overall)] as Row], [1, 2, 3, 4]) }, y) + GAP;
  if (y + 30 + kp.length * 27 > LIMIT) { addPage(); y = section(doc, "A", "Data tables, continued") + 8; }
  tA.subs.push({ n: "A.8", title: "All culture KPIs", page: pageNo() });
  y = h2(doc, "A.8 All culture KPIs", y) + 8;
  table(doc, { head: ["KPI", "Baseline", "12 month", "18 month", "Source"], cols: [0.4, 0.13, 0.13, 0.13, 0.21], right: [1, 2, 3], rows: kp.map((z) => { const [t12, t18] = tgt(z); return [z.k, fmtK(z, z.base, true), fmtK(z, t12), fmtK(z, t18), z.src] as Row; }) }, y);

  // ================================================================ appendix B cohorts and method
  y = chapter("B", "Cohorts and method", []); y = TOP + 48; toc[toc.length - 1].subs = [];
  cont("Cohort scores, now", "", true); y = h2(doc, "B.1 Cohort scores, now", y) + 8;
  if (exec && staff) y = table(doc, { head: ["Group", "People", ...O4.map((o) => ONAME[o]), "Leads"], cols: [0.22, 0.1, 0.14, 0.14, 0.14, 0.14, 0.12], right: [1, 2, 3, 4, 5], rows: [...starRows([["Executives", String(exec.n), ...O4.map((o) => d2(exec.now[o])), ONAME[[...O4].sort((p, q) => n(exec.now[q]) - n(exec.now[p]))[0]]], ["Staff", String(staff.n), ...O4.map((o) => d2(staff.now[o])), ONAME[[...O4].sort((p, q) => n(staff.now[q]) - n(staff.now[p]))[0]]], ["Organisation", String(nResp), ...O4.map((o) => d2(now[o])), ONAME[lead]]] as Row[], [2, 3, 4, 5]), ["Executives minus staff", "", ...O4.map((o) => sgn(n(exec.now[o]) - n(staff.now[o]))), shadow.length ? { t: ONAME[shadow[0]], icon: "watch" as const } : ""] as Row] }, y) + GAP;
  cont("Method and data quality", "", true); y = h2(doc, "B.2 Method and data quality", y) + 8;
  const agree = (v: unknown) => (n(v) >= 0.8 ? "Items agree strongly" : n(v) >= 0.6 ? "Items agree moderately" : "Items agree weakly; read with care");
  table(doc, { head: ["Measure", "Result", "What it tells you"], cols: [0.3, 0.2, 0.5], right: [], rows: [["Invited", String(invited ?? nResp), `Everyone in scope at ${org}`], ["Answered", `${nResp}${pr ? ` (${pr}%)` : ""}`, "Enough to report every group of 5 or more"], ["Complete answers", `${q.states?.COMPLETE ?? nResp} of ${nResp}`, "No partial answers were scored"], ["Median time to complete", med ? `${Math.floor(med / 60)} min ${med % 60} s` : "n/a", "Time taken by the middle respondent"], ["Answer quality checks", `${flagsN} of 4 raised`, "No speeding, straight lining, uniform or duplicated perspectives found"], ["Leadership 360 coverage", rd.coverage ? `${num(n(rd.coverage) * 100, 1)}%` : "n/a", `Share of headcount led by leaders with a valid 360 result; the readiness score is provisional below 60 percent${rd.provisional ? " (provisional here)" : ""}`],
    ...R3.map((k) => [`Item agreement, ${READINESS[k].name}`, d2(rd.alpha?.[k]), agree(rd.alpha?.[k])] as Row), ["Departments reported", `${depts.length} of ${x.depts?.length ?? 0}`, "Groups under 5 people are not shown"], ...(L ? [["Leadership 360", `${L.valid} of ${L.scored} leaders`, "A valid result needs at least 3 rater forms"] as Row] : []), ...(themes ? [["Comments", `${themes.n} people`, "A theme is shown when at least 8 comments share it"] as Row] : [])] }, y);

  // ================================================================ appendix C glossary, two columns
  y = chapter("C", "Glossary", []); y = TOP + 48; toc[toc.length - 1].subs = [];
  // about 25 terms the chapters use (owner Q-D9-19); the full list stays in lib/glossary.ts
  const USED = ["Orientation", "Engage", "Innovate", "Perform", "Govern", "Now and Preferred", "Gap", "Dimension", "Culture strength", "Shadow culture", "Tension", "Cultural entropy", "Culture Risk Index", "Perception gap", "Transformation Probability Score (TPS)", "Digital readiness", "Psychological safety", "Adaptive capacity", "Net score", "Verdict", "Hits and misses", "The Big Three", "Reporting floor", "Sub culture", "Leadership 360", "Priority", "KPI"];
  const gl = GLOSSARY.filter(([t0]) => USED.includes(t0)).sort((p, q) => p[0].localeCompare(q[0]));
  const colW = HALF, tW = 84, hOf = (d0: string) => Math.max(12, th(doc, d0, colW - tW - 6, "S", 8.5, 12)) + 9;
  // columns of equal height: an even number of columns, each closed once the running total passes its share
  const hs0 = gl.map(([, d0]) => hOf(d0)), totalH = hs0.reduce((t, v) => t + v, 0);
  let ncol = 2; while (totalH / ncol > LIMIT - TOP - 40) ncol += 2;
  let gcol = 0, gy = y, acc = 0;
  for (const [gi, [t0, d0]] of gl.entries()) { const hh = hs0[gi]; if (acc + hh / 2 > ((gcol + 1) * totalH) / ncol && gcol < ncol - 1) { gcol++; gy = y; if (gcol % 2 === 0) { addPage(); y = section(doc, "C", "Glossary, continued") + 12; gy = y; } } acc += hh;
    const gx = X0 + (gcol % 2) * (colW + GAP); doc.moveTo(gx, gy).lineTo(gx + colW, gy).lineWidth(0.4).strokeColor(C.grid).stroke();
    tx(doc, t0, gx, gy + 4, { f: "I7", size: 8, lead: 12, w: tW - 4 }); gy = tx(doc, d0, gx + tW, gy + 4, { size: 8.5, lead: 12, w: colW - tW - 6 }) + 5; }

  // ================================================================ appendix D working through the report
  y = chapter("D", "Working through the report", []); y = TOP + 48; toc[toc.length - 1].subs = [];
  // owner Q-D9-19: a timeline of the three sessions, then a card per session with length, who leads and what to bring
  const WEEK = ["Week 1", "Week 2", "Week 4"], LEADS = ["The Culture Practitioner", "The Culture Practitioner with the chief executive", "Each people manager, coached by the Culture Practitioner"],
    BRING = ["This report, read before the session; the Big Three on one page", "The agreed priority zero list, the readiness score and the KPI scorecard", "The published plan and a one page summary for the team"];
  { const tl = X0 + 20, tw0 = CW - 40; doc.moveTo(tl, y + 14).lineTo(tl + tw0, y + 14).lineWidth(1).strokeColor(C.ink).stroke();
    FACILITATION.slice(0, 3).forEach((f0, i) => { const px = tl + (tw0 * [0, 0.33, 1][i]); doc.circle(px, y + 14, 8).fill(C.brand); tx(doc, String(i + 1), px - 8, y + 9.5, { f: "I7", size: 8, lead: 9, w: 16, align: "center", color: C.white });
      tx(doc, WEEK[i], px - 40, y + 28, { f: "I7", size: 8, lead: 10, w: 80, align: "center" }); tx(doc, f0.name.replace(/^Session \d+\.\s*/, ""), px - 60, y + 39, { f: "I4", size: 8, lead: 10, w: 120, align: "center", color: C.muted }); });
    y += 56; }
  for (const [i, f0] of FACILITATION.slice(0, 3).entries()) {
    const lw = HALF - 12, rw = HALF - 12;
    const lh = 30 + 14 + 2 + th(doc, `${f0.length}. Led by ${LEADS[i]}.`, lw, "S", 9, 13) + 6 + 12 + th(doc, f0.who, lw, "S", 9, 13) + 6 + 12 + th(doc, f0.purpose, lw, "S", 9, 13);
    const rh = 14 + f0.agenda.slice(0, 3).reduce((t, g0) => t + th(doc, g0, rw - 14, "S", 9, 13) + 3, 0) + 18 + th(doc, BRING[i], rw, "S", 9, 13) + 18 + th(doc, f0.outputs, rw, "S", 9, 13);
    const ch = Math.max(lh, rh) + 8;
    doc.moveTo(X0, y).lineTo(X1, y).lineWidth(0.5).strokeColor(C.ink).stroke();
    tx(doc, `Session ${i + 1} · ${WEEK[i]}`, X0, y + 8, { f: "I7", size: 7.5, lead: 10, caps: true, cs: 0.5, color: C.brand });
    let ly = tx(doc, f0.name.replace(/^Session \d+\.\s*/, ""), X0, y + 22, { f: "I7", size: 11, lead: 14, w: lw }) + 2;
    ly = tx(doc, `${f0.length}. Led by ${LEADS[i]}.`, X0, ly, { size: 9, lead: 13, w: lw, color: C.muted }) + 6;
    ly = tx(doc, "Who", X0, ly, { f: "I7", size: 7, lead: 10, caps: true, cs: 0.5 }) + 2; ly = tx(doc, f0.who, X0, ly, { size: 9, lead: 13, w: lw }) + 6;
    ly = tx(doc, "Purpose", X0, ly, { f: "I7", size: 7, lead: 10, caps: true, cs: 0.5 }) + 2; tx(doc, f0.purpose, X0, ly, { size: 9, lead: 13, w: lw });
    const rx = X0 + HALF + GAP; let ry = tx(doc, "Agenda", rx, y + 8, { f: "I7", size: 7, lead: 10, caps: true, cs: 0.5 }) + 4;
    f0.agenda.slice(0, 3).forEach((g0, j) => { tx(doc, String(j + 1), rx, ry, { f: "I7", size: 8, lead: 13 }); ry = tx(doc, g0, rx + 14, ry, { size: 9, lead: 13, w: rw - 14 }) + 3; });
    ry = tx(doc, "What to bring", rx, ry + 4, { f: "I7", size: 7, lead: 10, caps: true, cs: 0.5 }) + 2; ry = tx(doc, BRING[i], rx, ry, { size: 9, lead: 13, w: rw });
    ry = tx(doc, "Outputs", rx, ry + 4, { f: "I7", size: 7, lead: 10, caps: true, cs: 0.5 }) + 2; tx(doc, f0.outputs, rx, ry, { size: 9, lead: 13, w: rw });
    y += ch;
  }
  const nn2 = NON_NEGOTIABLES.slice(0, 4), nw2 = (CW - 24 - 16) / 2 - 18;
  const rowsH = [0, 2].map((k) => Math.max(...nn2.slice(k, k + 2).map((z) => th(doc, z, nw2)))), nh2 = 30 + rowsH[0] + rowsH[1] + 12;
  if (y + nh2 > LIMIT) { addPage(); y = section(doc, "D", "Working through the report, continued") + 12; }
  doc.roundedRect(X0, y, CW, nh2, 4).fill(C.surface); doc.rect(X0, y, CW, 1.5).fill(C.brand); tx(doc, "Non negotiables for every session", X0 + 12, y + 12, { f: "I7", size: 8, lead: 10, caps: true, cs: 0.5 });
  nn2.forEach((z, i) => { const cx = X0 + 12 + (i % 2) * (nw2 + 34), cy = y + 30 + (i >= 2 ? rowsH[0] + 6 : 0); icon(doc, "cross", cx, cy + 2); tx(doc, z, cx + 18, cy, { w: nw2 }); });

  // ================================================================ back page
  show(true);
  doc.addPage(); doc.rect(0, 0, PW, PH).fill(C.brand); doc.save().polygon([PW, 700], [PW, 740], [PW - 90, 841.89], [PW - 130, 841.89]).fill(C.accent).restore();
  doc.image(logoW, 48, 64, { height: 46 });
  tx(doc, "Consulting Built for", 48, 470, { f: "I7", size: 28, lead: 32, color: C.white }); tx(doc, "Real World Impact", 48, 502, { f: "I7", size: 28, lead: 32, color: C.white });
  let by = tx(doc, "Priority Activator Consulting", 48, 556, { f: "I7", size: 10, lead: 14, color: C.white }) + 4;
  for (const t0 of ["Suite E2, 1st Floor, Jasmine Centre", "Westlands, Nairobi", "info@pac.africa", "www.pac.africa"]) by = tx(doc, t0, 48, by, { size: 9, lead: 13, color: C.white });

  // ================================================================ contents rows, then frames on every inner page
  const total = realNo();
  if (!brief) {
  doc.switchToPage(tocPage - 1);
  let cy = tx(doc, "Table of Contents", X0, TOP, { f: "I7", size: 32, lead: 36 }) + 16;
  const dotsTo = (yy: number, a0: number, b0: number) => doc.save().dash(0.6, { space: 2.4 }).moveTo(a0, yy).lineTo(b0, yy).lineWidth(0.6).strokeColor("#b9bec6").stroke().undash().restore();
  let tp = tocPage - 1;
  for (const t0 of toc) {
    const need = 30 + t0.subs.length * 15;
    if (cy + need > LIMIT) { tp++; doc.switchToPage(tp); cy = TOP; }
    doc.rect(X0, cy, 28, 24).fill(C.brand); tx(doc, t0.num, X0, cy + 6, { f: "I7", size: 10, lead: 12, color: C.white, w: 28, align: "center" });
    const tw0 = tw(doc, t0.title, "I7", 11); tx(doc, t0.title, X0 + 40, cy + 5, { f: "I7", size: 11, lead: 14 }); dotsTo(cy + 15, X0 + 44 + tw0, X1 - 24); tx(doc, String(t0.page), X1 - 22, cy + 5, { f: "I7", size: 11, lead: 14, w: 22, align: "right" });
    cy += 30;
    for (const sb of t0.subs) { tx(doc, sb.n, X0 + 40, cy, { f: "I4", size: 7.5, lead: 11, color: C.muted }); const sw = tw(doc, sb.title, "I4", 7.5); tx(doc, sb.title, X0 + 66, cy, { f: "I4", size: 7.5, lead: 11, color: C.muted }); dotsTo(cy + 8, X0 + 70 + sw, X1 - 24); tx(doc, String(sb.page), X1 - 22, cy, { f: "I4", size: 7.5, lead: 11, color: C.muted, w: 22, align: "right" }); cy += 15; }
    cy += 10;
  }
  }
  doc = real;
  for (let i = brief ? 0 : 1; i < total - 1; i++) { doc.switchToPage(i); frame(doc, logoC, `${org} · Culture Dynamics Profile`, `Confidential. ${brief ? "Executive brief for" : "Prepared for"} ${org} · Released ${released}`, i + 1, total, brief && i === 0); }
  doc.end();
  return done;
}
