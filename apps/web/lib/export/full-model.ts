// The full organisational report (about 30 pages, the PAC reference report's scale): chapters of blocks built from the frozen
// score object, the stored evaluation and plan, floor checked segments and the PAC interpretation library. Nothing is computed
// here beyond choosing, ordering and wording values that are already frozen. Rendered by pdf-full.ts and, in part, the web page.
import { valuesReality, config, kpiTargets, D, eosBand, ORIENTATION_PLAYBOOK, overridePlain, C2_RESPONSE, C3_RESPONSE } from "@pac/cdp-engine";
import { ORIENT_NAME, ORIENTATIONS, dp as dp0, human, signed as signed0, type Orientation } from "../format";
import { prose } from "../precision";
// one decimal in prose becomes two while the AI text is built (owner Q-D9-24), so its headlines quote the numbers the tables show
const dp = (x: string | number, p: number) => dp0(x, p === 1 ? prose.places : p);
const signed = (x: string | number, p = 0) => signed0(x, p === 1 ? prose.places : p);
import type { LoadedReport } from "../report-data";
import type { Extras } from "../report-extras";
import { CHANGE_PRINCIPLES, GLOSSARY, GOVERNANCE, ETHICS, bigThree, narrative, scorecard } from "../report-story";
import { CHAPTER_INTRO, CHECK, DIMENSION, EOS, FACILITATION, GAP_CLASS, NON_NEGOTIABLES, ORIENT, ORIENT_MORE, PHASES, perceptionText, READINESS, VERDICT, entropyText, riskText, tensionText } from "../report-library";
import { appendixRows } from "./appendix";
import { actionDepth } from "../playbook-view";
import type { BarGroup } from "../graphics/culture";
import type { AdviceView } from "../advice";

export type Block =
  | { p: string } | { callout: string } | { h3: string } | { bullets: string[] }
  | { table: { head: string[]; rows: string[][]; cols: number[] } }
  | { bars: { labels: string[]; series: { name: string; color: string; values: number[] }[]; max: number; note?: string } }
  | { cards: [string, string, string][] }
  | { ph: { title: string; o: string } }                    // a priority heading with its orientation symbol as the page marker
  | { fig: "chart" | "now" | "pref" | "move"; text?: string[]; prof?: { now: Record<"ENGAGE" | "INNOVATE" | "PERFORM" | "GOVERN", number>; pref: Record<"ENGAGE" | "INNOVATE" | "PERFORM" | "GOVERN", number> } }                // a shared graphic (lib/graphics/culture.ts)
  | { gauges: { label: string; value: number | null; max: number; band: string; note?: string }[] }
  | { heat: { rows: { label: string; n: number | null; suppressed: boolean; vals: (number | null)[] }[] } }
  | { range: { rows: { label: string; color: string; a: number; b: number | null }[]; aName: string; bName: string } }
  | { pills: { name: string; verdict: string; word: string }[] }
  | { pb: true }                                          // start a new page (one playbook page per priority)
  | { box: { label: string; text: string } }
  // the chosen looks (owner picks Q-ER18 to Q-ER20, 30 Oct 2026): bold tiles, the Big Three in three columns, the glance box, bar charts
  | { tiles: { label: string; value: string; note: string; tone: string }[] }
  | { big3: { kind: string; title: string; text: string; figure: string; good: boolean }[] }
  | { glance: string[] }
  | { chart: { groups: BarGroup[]; max: number; step?: number; legend: [string, string, boolean][]; title?: string } }
  | { grid: { title: string; groups: BarGroup[] }[]; max: number; legend: [string, string, boolean][] }
  | { dept: { title: string; groups: BarGroup[]; max: number; head: string; text: string; color: string } }
  | { check: { code: string; name: string; verdict: string; word: string; asks: string; result: string[]; risk: string; action: string; owner: string; urgency: string; pattern?: { name: string; diagnosis: string; prompts: string[] } } }
  | { hbars: { title: string; rows: { label: string; value: number | null; shown: string }[]; max: number } }
  | { meters: { label: string; value: number; shown: string; target: number; targetText: string; ok: boolean; max: number }[] }
  | { chips: { label: string; tone: "ok" | "warn" | "bad" }[] }
  | { split: { label: string; count: number; color: string }[] }
  | { actions: { text: string; when: string; owner: string; recommended: boolean }[] };             // a labelled callout, used for the staff message
/** Spec 4.6 order for the organisational report: how to read, method, now and preferred, strength, the four checks, groups, readiness, voice, sub cultures, leadership, what this means, what to do next. Numbers follow the order. */
const SPEC_ORDER = ["summary", "orientations", "method", "current", "dimensions", "gaps", "checks", "perception", "readiness", "risk", "voice", "themes", "departments", "leaders", "meaning", "roadmap", "kpis"];
function specOrder(ch: Chapter[]): Chapter[] {
  const rank = (k: string) => { const i = SPEC_ORDER.indexOf(k); return i < 0 ? SPEC_ORDER.length : i; };
  let i = 0;
  return [...ch].sort((p, q) => rank(p.key) - rank(q.key)).map((c) => (c.num === "ES" ? c : { ...c, num: String(++i).padStart(2, "0") }));
}
export interface Chapter { key: string; num: string; title: string; lead: string; blocks: Block[]; consultant?: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the frozen payload as stored (strings for every Decimal); shapes vary by payload version
type S = Record<string, any>;
const HUE_OF: Record<string, string> = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
const name = (o: string) => ORIENT_NAME[o as Orientation] ?? o;
/** An owner role as written in the plan ("CEO+EXCO" reads "CEO and EXCO"); acronyms keep their capitals. */
const role = (r: string) => r.split("+").map((x) => (/^[A-Z]{2,5}$/.test(x.trim()) ? x.trim() : human(x.trim()))).join(" and ");
const patternCheck = (nm: string) => (/system/i.test(nm) ? "C3" : /leader/i.test(nm) ? "C2" : "C1");
/** Stored text, one paragraph per line. */
const paras = (t: string): Block[] => t.split(/\n+/).map((x) => x.trim()).filter(Boolean).map((p) => ({ p: clean(p) }));
/** Plan and playbook wording as the client reads it (owner Q-ER26): orientation names in normal case, "CEO and EXCO", no hyphens,
 *  and pulse codes as plain names ("D2 S2" is Leadership Blueprint, "eOS Q4" an employee voice question). Display only; stored text is unchanged. */
export function clean(t: string): string {
  return t
    .replace(/\beOS ((?:Q\d+(?:,\s*)?)+)/g, (_, qs: string) => `employee voice on ${qs.split(/,\s*/).filter(Boolean).map((q) => (EOS[Number(q.slice(1)) - 1]?.name ?? q).toLowerCase()).join(", ")}`)
    .replace(/\bD([1-6])(?: S\d+)?\b/g, (_, d: string) => DIMENSION[`D${d}`]?.name ?? `D${d}`)
    .replace(/\bD([7-9])\s+(?=[A-Z])/g, "")
    .replace(/\bD([7-9])\b/g, (_, d: string) => READINESS[`D${d}`]?.name ?? `D${d}`)
    .replace(/\s+·\s+/g, ", ")
    .replace(/\b(ENGAGE|INNOVATE|PERFORM|GOVERN)\b/g, (w) => w.charAt(0) + w.slice(1).toLowerCase())
    .replace(/\b([A-Z]{2,5})\+([A-Z]{2,5})\b/g, "$1 and $2")
    .replace(/(?<=[A-Za-z])-(?=[A-Za-z])/g, " ");
}
/** The employee voice signal word, from the engine band (server only: the engine is not bundled for the browser) (config scoring.eos.band_edges, owner Q-AL31): one cut point set everywhere. */
export const eosSignal = (v: number) => ({ NEGATIVE: "Critical", ACCEPTABLE: "Marginal", GOOD: "Good", EXCELLENT: "Excellent" } as const)[eosBand(v)];
/** Whether a voice score is a concern (Critical or Marginal): the same band the advice library fires on. */
export const eosConcern = (v: number) => ["NEGATIVE", "ACCEPTABLE"].includes(eosBand(v));
const n = (x: string | number | null | undefined) => (x === null || x === undefined ? NaN : Number(x));

/** One line on what to do about a finding, from the playbook (orientation findings) or the check's own intervention (C1 to C4). Wording only. */
export function findingHint(f: { type: string; orientation?: string[] }): string {
  const pb = ORIENTATION_PLAYBOOK as Record<string, { actions: { rows: { label: string; values: string[][] }[] } }>;
  const o = f.orientation?.[0];
  const lead = o ? pb[o]?.actions.rows.find((r) => r.label.startsWith("Priorities team"))?.values.flat()[0] : undefined;
  if (lead) return lead;
  const c = /^C[1-4]/.exec(f.type)?.[0];
  return c && CHECK[c] ? CHECK[c].intervention : "";
}

/** One accepted advice item in the client report (Q-AL24): diagnosis and why, risks, actions with owner and timing, the signal, what good looks like and traps. Workshop questions go to the staff guide. */
function itemBlocks(v: AdviceView): Block[] {
  return [
    { h3: clean(v.title) },
    ...(v.diagnosis || v.why ? [{ p: clean([v.diagnosis, v.why].filter(Boolean).join(" ")) }] : []),
    ...(v.risks.length ? [{ p: "If nothing changes:" }, { bullets: v.risks.map(clean) }] : []),
    ...(v.actions.length ? [{ actions: v.actions.map((z, i) => ({ text: clean(z.text), when: z.horizon ?? "to agree", owner: z.owner_role ?? "to agree", recommended: i === 0 })) }] : []),
    ...(v.signal ? [{ box: { label: "Signal to watch", text: clean(v.signal) } }] : []),
    ...(v.good.length ? [{ p: "What good looks like:" }, { bullets: v.good.map(clean) }] : []),
    ...(v.traps.length ? [{ p: "Traps to avoid:" }, { bullets: v.traps.map(clean) }] : []),
  ] as Block[];
}

export function buildFullModel(l: LoadedReport, x: Extras) {
  const fx = ((l.evaluation?.findings ?? []) as { type: string; verdict?: string; orientation?: string[]; metrics?: Record<string, unknown>; evidence?: { overrides?: string[] } }[]);
  const ofCheck = (k: string) => fx.filter((f) => f.type.startsWith(`${k}_`) && f.verdict !== "HIT");
  /** This organisation's result for a check, from its stored findings (Erick #93). */
  const checkResult = (k: string, v: string): Block[] => {
    if (v === "HIT") return [];
    const out: string[] = [];
    for (const f of ofCheck(k)) {
      const o = f.orientation ?? [], pct = f.metrics?.alignment_pct;
      if ((k === "C1" || k === "C4") && o.length) out.push(`At ${l.tenantName ?? "the organisation"} ${k === "C1" ? "the strategy" : "the business model"} needs ${o.map(name).join(" and ")}${pct !== undefined ? `, and the culture gives ${dp(String(pct), 0)}% of what it needs` : ""}. ${(f.evidence?.overrides ?? []).map((c) => overridePlain(c, o)).filter(Boolean).join(" ")}`.trim());
      if (k === "C2" && f.metrics?.behaviour_gap_points !== undefined) out.push(`The distance between how leaders behave, as staff see it, and what the strategy needs is ${dp(String(f.metrics.behaviour_gap_points), 1)} points: a ${String(f.metrics.intensity ?? "").toLowerCase()} gap.`);
      if (k === "C3" && f.metrics?.moderate_count !== undefined) out.push(`${f.metrics.moderate_count} orientation${Number(f.metrics.moderate_count) === 1 ? "" : "s"} that people want less of ${Number(f.metrics.moderate_count) === 1 ? "is" : "are"} still rewarded by how the organisation runs.${f.metrics.identity_risk ? " Changing them touches how people see the organisation, so frame the change as keeping what they value." : ""}`);
    }
    return out.map((p) => ({ p }));
  };
  /** A proposed intervention drawn from the result: the engine's response for its size, then the first move for the orientation concerned. */
  const checkAction = (k: string, v: string): string => {
    const f = ofCheck(k)[0], o = f?.orientation?.[0];
    const base = k === "C2" && f?.metrics?.intensity ? C2_RESPONSE[f.metrics.intensity as keyof typeof C2_RESPONSE] : k === "C3" && v in C3_RESPONSE ? C3_RESPONSE[v as keyof typeof C3_RESPONSE] : CHECK[k]?.intervention ?? "";
    const first = o ? findingHint({ type: f!.type, orientation: [o] }) : "";
    return clean(`${base}${first && first !== base ? ` Start with ${name(o!)}: ${first.charAt(0).toLowerCase()}${first.slice(1)}` : ""}`);
  };
  const s = l.score as unknown as S, e = l.evaluation, os = s.orientation_scores, rd = s.readiness, a = s.analytics;
  const sections = l.rep.sections_json as Record<string, string>;
  const org = l.tenantName ?? "the organisation";
  const ch: Chapter[] = [];
  // Advice library (Erick #197, owner Q-AL16, Q-AL23, Q-AL24): each chapter opens with its definitions (what the measure is, how to read
  // its bands) and closes with the accepted advice for its results. Sections are named `<chapter>.<result>`; definitions `definition.<chapter>`.
  const adv = (x.advice ?? []).filter((v) => v.level !== "LEADER");          // leader advice is staff only (Q-AL20)
  const defs = (key: string): Block[] => adv.filter((v) => v.section === `definition.${key}`).flatMap((v) => [
    { box: { label: clean(v.title), text: clean([v.diagnosis, v.why].filter(Boolean).join(" ")) } } as Block,
    ...(v.good.length ? [{ bullets: v.good.map(clean) } as Block] : []),        // for a definition, `good` holds the band lines
  ]);
  // sections the report lays out itself rather than as advice items (owner Q-AL27, Q-AL36)
  const OWN = ["roadmap.posture", "roadmap.quickwin", "roadmap.phase", "sources"];
  const own = (sec: string) => adv.filter((v) => v.section === sec);
  const F = x.facts ?? {};
  const fv = (k: string) => (F[k] === undefined || F[k] === null ? "n/a" : String(F[k]));
  const adviceFor = (key: string): Block[] => {
    const mine = adv.filter((v) => v.section.split(".")[0] === key && v.level === "ORG" && !OWN.includes(v.section));
    return mine.length ? [{ h3: "What this means and what to do" } as Block, ...mine.flatMap(itemBlocks)] : [];
  };
  // an AI reading of the chapter shows only once the consultant accepted it (owner Q-AL26)
  const acc = (l.rep.accepted_json ?? {}) as Record<string, unknown>;
  // prompt v2 drafts carry HEADLINE and SO WHAT labels; this older layout reads them as plain paragraphs
  const aiRead = (key: string): Block[] => (sections[`ai_${key}`] && `ai_${key}` in acc ? [{ h3: "In short" }, ...paras(sections[`ai_${key}`].replace(/^(HEADLINE|SO WHAT):\s*/gm, ""))] : []);
  const push = (key: string, num: string, title: string, lead: string, blocks: Block[]) => ch.push({ key, num, title, lead, blocks: [...(CHAPTER_INTRO[key] ? [{ p: CHAPTER_INTRO[key] }] : []), ...aiRead(key), ...defs(key), ...blocks, ...adviceFor(key)], consultant: sections[`chapter_${key}`] });
  const ranked = [...ORIENTATIONS].sort((p, q) => Math.abs(n(os.gap[q])) - Math.abs(n(os.gap[p])));
  const dom = s.dominance.dominant as Orientation[];

  // ---------------------------------------------------------------- executive summary
  const tiles = scorecard(l.score, e), big = bigThree(l.score);
  push("summary", "ES", "Executive summary", `This report sets out how people at ${org} experience the culture now, the culture they believe the organisation needs, and what that means for the strategy.`, [
    { tiles: tiles.slice(0, 4).map((t) => ({ label: t.label, value: t.value.replace(" / ", "/"), note: t.note, tone: t.label === "Culture Risk Index" ? "#151c26" : t.label === "Change readiness" ? "#eb5733" : t.label.startsWith("Transformation") ? "#b7791f" : t.label === "Strategy fit" ? (e?.checks.C1 === "HIT" ? "#2f8f4e" : e?.checks.C1 === "PARTIAL_HIT" ? "#b7791f" : "#c0392b") : "#2E86C1" })) },
    { glance: (() => {
      const more = [...ORIENTATIONS].filter((o) => n(os.gap[o]) > 0).sort((p, q) => n(os.gap[q]) - n(os.gap[p])), less = [...ORIENTATIONS].filter((o) => n(os.gap[o]) < 0).sort((p, q) => n(os.gap[p]) - n(os.gap[q]));
      const big = Math.max(...ORIENTATIONS.map((o) => Math.abs(n(os.gap[o]))));
      return [`Led by ${dom.map(name).join(" and ")} now (${dom.map((o) => dp(os.now[o], 1)).join(" and ")} points), with ${name(s.dominance.secondary)} second.`,
        `People want ${more.length ? `more ${more.map((o) => `${name(o)} (${signed(os.gap[o], 1)})`).join(" and ")}` : "little more of any orientation"}${less.length ? `, and less ${less.map((o) => `${name(o)} (${signed(os.gap[o], 1)})`).join(" and ")}` : ""}.`,
        big >= 8 ? "The move is large: it needs a staged plan, with the first visible changes inside 30 days." : big >= 4 ? "The move is moderate: a focused plan on one or two priorities can carry it." : "The move is small: protect what works and adjust where people ask for it."]; })() },
    ...narrative(l.score, e, "BOARD").map((p) => ({ p })),
    { h3: "The Big Three" },
    { big3: big.map((b) => ({ kind: b.kind.toUpperCase(), title: b.title, text: b.text, figure: b.figure, good: b.kind === "Accelerator" })) },

  ]);

  // ---------------------------------------------------------------- the four orientations: the playbook profile of each, once, before any result (Q-AL23)
  const prof = adv.filter((v) => v.section.startsWith("profile."));
  if (prof.length) push("orientations", "01", "The four orientations", "What each orientation is, what it looks like at its best, and what happens when there is too much or too little of it.", [
    ...prof.flatMap((v) => [{ h3: clean(v.title) } as Block, { p: clean(v.diagnosis) } as Block, ...(v.why ? [{ p: clean(v.why) } as Block] : []),
      ...(v.watch.length ? [{ table: { head: ["", ""], rows: v.watch.map((w) => { const i = w.indexOf(":"); return [clean(w.slice(0, i)), clean(w.slice(i + 1).trim())]; }), cols: [0.28, 0.72] } } as Block] : []),
      ...(v.good.length ? [{ p: "At its best:" } as Block, { bullets: v.good.map(clean) } as Block] : []),
      ...(v.traps.length ? [{ p: "When overdone:" } as Block, { bullets: v.traps.map(clean) } as Block] : [])]),
  ]);

  // ---------------------------------------------------------------- 01 method
  const nNow = s.counts.now;
  // ---------------------------------------------------------------- 02 current culture
  const lens = s.lenses_now ?? {}, cong = s.congruence ?? {};
  push("current", "02", "The culture now", `The four orientations as people experience them now, and how consistently they show up across the organisation.`, [
    { fig: "chart", text: [`${org} runs on ${dom.map(name).join(" and ")} now (${dom.map((o) => dp(os.now[o], 1)).join(" and ")} points), followed by ${name(s.dominance.secondary)}. ${ORIENT[dom[0]].strong}`, `Culture strength is ${dp(s.culture_strength, 1)}, a ${human(s.strength_band).toLowerCase()} reading: ${n(s.culture_strength) >= 10 ? "one orientation clearly leads, which gives the culture a recognisable character and also makes it harder to shift." : "no single orientation dominates, so the culture is flexible but can feel less distinctive."}`] },
    ...(cong.band ? [{ p: `The leading orientation appears as the lead in ${cong.dimension_count} of the six dimensions (${human(cong.band).toLowerCase()}). ${cong.band === "FRAGMENTED" ? "Different parts of working life pull in different directions, which people experience as mixed messages." : "The culture is consistent across most of working life."}` }] : []),
    ...(Object.keys(lens).length ? [{ h3: "Three lenses" }, { chart: { groups: [["Strategy", "D5, D6"], ["Practice", "D1, D3, D4"], ["Leadership", "D2"]].map(([L, d]) => ({ label: `${L} (${d})`, bars: ORIENTATIONS.map((o) => ({ value: n(lens[L.toUpperCase()]?.[o] ?? 0), color: HUE_OF[o] })) })), max: 40, legend: ORIENTATIONS.map((o) => [ORIENT_NAME[o], HUE_OF[o], false] as [string, string, boolean]) } },
      { p: "The lenses show whether what the organisation says it values (strategy), how work is actually done (practice) and how leaders behave (leadership) point the same way. Where they differ, people follow practice and leadership before strategy." }] : []),
  ]);

  // ---------------------------------------------------------------- 02 the six dimensions, one chapter (owner Q-RF3: fewer charts)
  // A compact grid of every dimension by orientation (Now, with the step to Preferred), then two lines of words per dimension. No chart per dimension.
  const pref = s.dimension_preferred as S | undefined;
  const dimIds = ["D1", "D2", "D3", "D4", "D5", "D6"];
  push("dimensions", "03", "The six dimensions", "The culture seen through six lenses. Each lens is one part of working life, and together they show where the culture is consistent and where it pulls apart.", [
    // what the dimensions mean comes before any result (Erick #69, #70)
    { p: "People answered the same question about six parts of working life. Each one asks something different:" },
    { bullets: dimIds.map((d) => `${d} ${DIMENSION[d].name}: ${DIMENSION[d].asks.charAt(0).toUpperCase()}${DIMENSION[d].asks.slice(1)}.`) },
    { p: "Each chart shows one dimension: the solid bar is Now and the pale dashed bar beside it is Preferred, for each orientation." },
    { grid: dimIds.map((d) => ({ title: `${d} ${DIMENSION[d].name}`, groups: ORIENTATIONS.map((o) => ({ label: ORIENT_NAME[o], bars: [{ value: n(s.dimension_now[d][o]), color: HUE_OF[o] }, ...(pref?.[d] ? [{ value: n(pref[d][o]), color: HUE_OF[o], ghost: true }] : [])] })) })),
      max: 40, legend: [...ORIENTATIONS.map((o) => [ORIENT_NAME[o], HUE_OF[o], false] as [string, string, boolean]), ["Pale, dashed: Preferred", "#151c26", true]] },
    { h3: "What each dimension says" },
    ...dimIds.flatMap((d) => {
      const now = s.dimension_now[d], pr = pref?.[d];
      const [lead, second] = [...ORIENTATIONS].sort((p, q) => n(now[q]) - n(now[p]));
      const shift = pr ? [...ORIENTATIONS].sort((p, q) => Math.abs(n(pr[q]) - n(now[q])) - Math.abs(n(pr[p]) - n(now[p])))[0] : null;
      const sp = a?.dispersion?.[d]?.[lead];
      return [{ h3: `${d} · ${DIMENSION[d].name}` } as Block, { p: `${name(lead)} leads at ${dp(now[lead], 1)}, ${lead === dom[0] ? "the same lead as the culture overall" : `where the culture overall leads with ${name(dom[0])}`}, followed by ${name(second)} at ${dp(now[second], 1)}.${shift && pr ? ` The largest shift people want is in ${name(shift)}, from ${dp(now[shift], 1)} to ${dp(pr[shift], 1)} (${signed(String(n(pr[shift]) - n(now[shift])), 1)} points).` : ""}${sp ? ` Answers on ${name(lead)} here spread by ${dp(sp, 1)} points between respondents.` : ""}` } as Block];
    }),
  ]);

  // ---------------------------------------------------------------- 04 gaps
  const vr = valuesReality(s.dimension_now);
  push("gaps", "04", "The culture gap", "Where the culture people want differs from the culture they live, and where the change pulls in two directions at once.", [
    { table: { head: ["Orientation", "Now", "Preferred", "Gap", "Reading"], rows: ranked.map((o) => [ORIENT_NAME[o], dp(os.now[o], 1), dp(os.preferred[o], 1), signed(os.gap[o], 1), `${human(s.classification[o])}${a ? ` · ${human(a.gap_bands[o])}` : ""}`]), cols: [0.18, 0.13, 0.15, 0.12, 0.42] } },
    ...ranked.flatMap((o) => [{ p: `${ORIENT_NAME[o]} (${signed(os.gap[o], 1)} points): ${GAP_CLASS[s.classification[o]] ?? ""}.` },
      ...(o === "INNOVATE" && x.setup?.riskAppetite ? [{ p: `Innovation risk appetite agreed at setup: ${human(x.setup.riskAppetite).toLowerCase()}. It is shown here beside the Innovate result for context and changes no threshold.` }] : []),
      ...(o === "GOVERN" && s.classification[o] === "KEEP_AND_PROTECT" && x.setup?.nonNegotiables ? [{ p: `Standards the executive team named as non negotiable at setup, to protect: ${x.setup.nonNegotiables}` }] : [])]),
    ...(a ? [{ h3: "Cultural entropy" }, { p: entropyText(a.entropy.score, a.entropy.band) }, { h3: "Tensions" },
      ...a.tensions.map((t: S) => ({ p: tensionText(name(t.a), name(t.b), t.score, t.band) }))] : []),
    ...(F["spread.ENGAGE"] ? [{ h3: "How far people agree" },
      { p: "The spread is how far apart respondents' answers sit for each orientation, in points, averaged over the six dimensions. The gap tells you where people want to go; the spread tells you whether they describe the same starting point." },
      { table: { head: ["Orientation", "Now", "Gap", "Spread"], rows: ORIENTATIONS.map((o) => [ORIENT_NAME[o], dp(os.now[o], 1), signed(os.gap[o], 1), `${dp(fv(`spread.${o}`), 1)}${F["spread.top"] === o ? " (widest)" : ""}`]), cols: [0.34, 0.22, 0.22, 0.22] } } as Block] : []),
    ...(F["axis.inward"] ? [{ h3: "The two axes" },
      { table: { head: ["Axis", "One side", "Other side", "Reading"], rows: [["Focus", `Inward (Engage and Govern) ${fv("axis.inward")}`, `Outward (Innovate and Perform) ${fv("axis.outward")}`, human(fv("axis.focus"))], ["Style", `Flexible (Engage and Innovate) ${fv("axis.flexible")}`, `Structured (Perform and Govern) ${fv("axis.structured")}`, human(fv("axis.style"))]], cols: [0.14, 0.33, 0.35, 0.18] } } as Block] : []),
    { h3: "Values against reality" },
    { p: "What people say the organisation is (D1, its character) against what actually holds it together and gets rewarded (D4 and D6)." },
    { table: { head: ["Orientation", "Said (D1)", "Lived (D4 and D6)", "Difference"], rows: ORIENTATIONS.map((o) => [ORIENT_NAME[o], dp(vr[o].espoused.toString(), 1), dp(vr[o].lived.toString(), 1), signed(vr[o].delta.toString(), 1)]), cols: [0.28, 0.22, 0.28, 0.22] } },
    { chart: { groups: ORIENTATIONS.map((o) => ({ label: `${ORIENT_NAME[o]} (${signed(vr[o].delta.toString(), 1)})`, bars: [{ value: n(vr[o].espoused.toString()), color: HUE_OF[o] }, { value: n(vr[o].lived.toString()), color: HUE_OF[o], ghost: true }] })), max: 40, legend: [["Solid: what people say (D1)", "#151c26", false], ["Pale, dashed: what is lived (D4 and D6)", "#151c26", true]] } },
    { p: (() => { const big = [...ORIENTATIONS].sort((p, q) => Math.abs(n(vr[q].delta.toString())) - Math.abs(n(vr[p].delta.toString())))[0]; const dv = n(vr[big].delta.toString());
      return Math.abs(dv) < 3 ? "The culture people describe and the one they live are close: what the organisation says about itself matches how it holds together and rewards success." : `The widest difference is in ${ORIENT_NAME[big]}: people ${dv > 0 ? "live more of it than they describe" : "describe more of it than they live"} (${signed(String(dv), 1)} points). Where stated values and lived rewards differ, people follow the rewards.`; })() },
  ]);

  // ---------------------------------------------------------------- 05 executives and staff
  const pg = s.perception_gap as S | null;
  push("perception", "05", "Executives and staff", "Whether leaders and staff experience the same organisation.", pg ? [
    { range: { rows: ORIENTATIONS.map((o) => ({ label: ORIENT_NAME[o], color: HUE_OF[o], a: n(s.cohorts.executive.now[o]), b: n(s.cohorts.staff.now[o]) })), aName: "Executives", bName: "Staff" } },
    { chips: ORIENTATIONS.map((o) => { const fl = s.perception_flags?.[o]; return { label: `${ORIENT_NAME[o]}: ${dp(pg[o], 1)} points, ${fl === "SHADOW_CULTURE" ? "shadow culture" : fl === "WATCH" ? "blind spot to watch" : "aligned"}`, tone: (fl === "SHADOW_CULTURE" ? "bad" : fl === "WATCH" ? "warn" : "ok") as "ok" | "warn" | "bad" }; }) },
    { p: (() => { const big = [...ORIENTATIONS].sort((p, q) => Math.abs(n(s.cohorts.executive.now[q]) - n(s.cohorts.staff.now[q])) - Math.abs(n(s.cohorts.executive.now[p]) - n(s.cohorts.staff.now[p])))[0];
      return perceptionText(big, n(s.cohorts.executive.now[big]), n(s.cohorts.staff.now[big])); })() },
    { p: (() => { const sh = ORIENTATIONS.filter((o) => s.perception_flags?.[o] === "SHADOW_CULTURE");
      return sh.length ? `Executives and staff describe different cultures on ${sh.map(name).join(" and ")}. This is a shadow culture: leaders may believe the organisation is further along than staff experience it, and decisions made on the leaders' picture will miss. Listening sessions where executives hear staff directly are the fastest way to close it.` : ORIENTATIONS.some((o) => s.perception_flags?.[o] === "WATCH") ? "None of the differences reaches the level of a shadow culture, but those marked to watch should be checked with staff before the plan is announced." : "Executives and staff describe broadly the same culture. That shared picture is an asset: the change can be explained once and recognised by everyone."; })() },
  ] : [{ p: `The executive and staff views are not compared because ${s.perception_not_computed_reason === "EXECUTIVE_COHORT_BELOW_FLOOR" ? "the executive group" : "the staff group"} is too small to show on its own.` }]);

  // ---------------------------------------------------------------- 06 departments
  const shown = (x.depts ?? []).filter((c) => !c.suppressed);
  push("departments", "06", "Departments", "Sub cultures: how the culture now differs between departments.", x.depts ? [
    // how to read the department results comes before them (Erick #73, #75)
    { p: "Every organisation has sub cultures. Departments develop their own way of working from the work they do, the people who lead them and their history. Some difference is healthy: a finance team should value control more than a product team. Difference becomes a risk when departments that depend on each other pull in opposite directions, or when one drifts far from the culture the strategy needs." },
    { heat: { rows: x.depts.map((c) => ({ label: c.label, n: c.n, suppressed: c.suppressed, vals: ORIENTATIONS.map((o) => (c.suppressed || !c.now?.[o] ? null : n(c.now[o]) - n(os.now[o]))) })) } },
    { p: "Below, each department against the whole organisation: the solid bar is the department Now and the pale dashed bar is the organisation Now." },
    ...shown.map((c) => {
      const diffs = ORIENTATIONS.filter((o) => c.now?.[o]).map((o) => ({ o, d: n(c.now![o]) - n(os.now[o]) })).sort((p, q) => Math.abs(q.d) - Math.abs(p.d)), t = diffs[0];
      const lead = `${c.label} leads with ${name(c.dominant ?? "")}${c.dominant && dom.includes(c.dominant as Orientation) ? ", in line with the organisation" : `, where the organisation leads with ${dom.map(name).join(" and ")}`}.${x.deptSdi?.[c.label] && n(x.deptSdi[c.label]) >= 12 ? " Its profile is different enough to treat it as a distinct sub culture." : ""}`;
      const mean = !t || Math.abs(t.d) < 2 ? "Its profile is close to the organisation's on every orientation, so the organisation wide plan applies here as it is."
        : `It has ${t.d > 0 ? "more" : "less"} ${name(t.o)} than the organisation (${signed(String(t.d), 1)} points): ${ORIENT_MORE[t.o][t.d > 0 ? "more" : "less"]}`;
      // the department's own readings, one line each with its numbers (owner Q-AL33); the full advice is printed once below
      const mine = adv.filter((v) => v.level === "GROUP" && v.scope_key === c.label);
      return [{ dept: { title: `${c.label} (${c.n} responses)`, groups: ORIENTATIONS.map((o) => ({ label: ORIENT_NAME[o], bars: [{ value: n(c.now?.[o]), color: HUE_OF[o] }, { value: n(os.now[o]), color: HUE_OF[o], ghost: true }] })), max: 40, head: `What this means for ${c.label}`, text: `${lead} ${mean}`, color: HUE_OF[t?.o ?? c.dominant ?? "ENGAGE"] } } as Block,
        ...(mine.length ? [{ bullets: mine.map((v) => `${clean(v.title)}. ${clean(v.diagnosis).split(/(?<=\.)\s/)[0]}`) } as Block] : [])];
    }).flat(),
    // each piece of department advice once, naming the departments it applies to (owner Q-AL33)
    ...(() => {
      const g = new Map<string, AdviceView[]>();
      for (const v of adv.filter((z) => z.level === "GROUP")) g.set(v.item_id, [...(g.get(v.item_id) ?? []), v]);
      return g.size ? [{ h3: "What to do across departments" } as Block, ...[...g.values()].flatMap((vs) => [...itemBlocks({ ...vs[0], diagnosis: "", why: vs[0].why }), { p: `Applies to: ${vs.map((v) => v.scope_key).join(", ")}.` } as Block])] : [];
    })(),
  ] : [{ p: "Department results are not available for this report." }]);

  // ---------------------------------------------------------------- 07 employee voice
  const det = s.eos_detail as S | undefined;
  push("voice", "07", "Employee voice", `How people rate eight parts of working life here. The overall index is ${s.eos.index ? dp(s.eos.index, 1) : "not available"}.`, [
    { h3: "Speaking up safely and readiness for change" },
    { gauges: [{ label: "Speaking up safely", value: rd.d8 ? n(rd.d8) : null, max: 5, band: rd.d8_band ?? "" }, { label: "Ready for change", value: rd.d9 ? n(rd.d9) : null, max: 5, band: rd.d9_band ?? "" }] },
    { p: "Speaking up safely is whether people can raise problems, challenge and admit mistakes without fear. Ready for change is how well people and teams adjust when plans or priorities shift. Together with the voice scores below they show how much trust there is to build change on." },
   { table: { head: ["Question", "Net score", "Signal", ...(det ? ["Advocates", "Neutrals", "Critics"] : [])], rows: EOS.map((q, i) => { const v = s.eos[`Q${i + 1}`]; const dd = det?.[`Q${i + 1}`];
      return [q.name, v === null || v === undefined ? "n/a" : (v > 0 ? `+${v}` : String(v)), v === null || v === undefined ? "" : eosSignal(v), ...(dd ? [String(dd.promoters), String(dd.passives), String(dd.detractors)] : [])]; }), cols: det ? [0.34, 0.12, 0.12, 0.14, 0.14, 0.14] : [0.6, 0.2, 0.2] } },
    ...EOS.map((q, i) => { const v = s.eos[`Q${i + 1}`]; return v === null || v === undefined ? null : { p: `${q.name} (${v > 0 ? `+${v}` : v}, ${eosSignal(v).toLowerCase()}): ${eosConcern(v) ? q.low : q.high}` }; }).filter(Boolean) as Block[],
  ]);

  // ---------------------------------------------------------------- 08 readiness
  const items = s.readiness_items as S | undefined;
  push("readiness", "08", "Readiness for change", "Whether the organisation can absorb and sustain the change the culture gap calls for.", [
    { gauges: [...([["D7", rd.d7, rd.d7_band], ["D8", rd.d8, rd.d8_band], ["D9", rd.d9, rd.d9_band]] as const).map(([k, v, b]) => ({ label: READINESS[k].name, value: v ? n(v) : null, max: 5, band: b ?? "" })), { label: "Transformation Probability Score (TPS)", value: rd.tps ? n(rd.tps) : null, max: 5, band: `${rd.tps_band ? human(rd.tps_band) : ""}${rd.provisional ? " (provisional)" : ""}` }] },
    ...(["D7", "D8", "D9"] as const).flatMap((k) => {
      const v = rd[k.toLowerCase()], b = rd[`${k.toLowerCase()}_band`];
      const its = (items?.[k] ?? []).map((m: string | null, i: number) => ({ m, t: x.itemText?.[k]?.[i] ?? `Statement ${i + 1}` })).filter((z: S) => z.m !== null).sort((p: S, q: S) => n(p.m) - n(q.m));
      return [{ h3: `${READINESS[k].name}: ${v ? dp(v, 2) : "n/a"} out of 5` }, { p: `This measures ${READINESS[k].what}. ${b ? READINESS[k].bands[b] ?? "" : ""}` },
        ...(its.length >= 2 ? [{ hbars: { title: "Lowest rated statements", rows: its.slice(0, 2).map((z: S) => ({ label: z.t, value: n(z.m), shown: dp(z.m, 2) })), max: 5 } },
          { hbars: { title: "Highest rated statements", rows: its.slice(-2).reverse().map((z: S) => ({ label: z.t, value: n(z.m), shown: dp(z.m, 2) })), max: 5 } }] : [])] as Block[];
    }),
    { h3: "Transformation Probability Score (TPS)" },
    { hbars: { title: "What the score is made of", rows: ([["Adaptive capacity", rd.d9], ["Psychological safety", rd.d8], ["Leadership alignment", rd.leadership_alignment], ["Digital readiness", rd.d7]] as [string, string | null][]).map(([l2, v]) => ({ label: l2, value: v ? n(v) : null, shown: v ? dp(v, 2) : "n/a" })), max: 5 } },
    { p: `The TPS is ${rd.tps ? `${dp(rd.tps, 2)} out of 5, ${human(rd.tps_band ?? "").toLowerCase()}` : "not available"}. It sets how many priorities the organisation can carry at once.${rd.provisional ? " It is provisional: Leadership 360 results cover too few of the people led to replace the survey estimate of leadership alignment." : ""}` },
  ]);

  // ---------------------------------------------------------------- 09 risk dashboard
  const tv: Record<string, [string, string] | null> = {
    entropy: a ? ["Cultural entropy", a.entropy.score] : null, risk_index: a?.risk ? ["Culture Risk Index", a.risk.index] : null,
    d8: rd.d8 ? ["Psychological safety", dp(rd.d8, 2)] : null, d9: rd.d9 ? ["Adaptive capacity", dp(rd.d9, 2)] : null,
    eos_index: s.eos.index ? ["Employee voice index", dp(s.eos.index, 1)] : null,
    perception_gap: pg ? ["Largest executive and staff gap", dp(String(Math.max(...ORIENTATIONS.map((o) => n(pg[o])))), 1)] : null,
  };
  const ops: Record<string, string> = { lt: "under", gte: "at least", gt: "above" };
  const dash = (config.get("analytics.targets") as readonly (readonly [string, string, { toString(): string }])[]).filter(([k]) => tv[k]).map(([k, op, t]) => {
    const [label, v] = tv[k]!; const ok = op === "lt" ? n(v) < n(t.toString()) : op === "gte" ? n(v) >= n(t.toString()) : n(v) > n(t.toString());
    return [label, v, `${ops[op]} ${t.toString()}`, ok ? "On target" : "Needs attention"];
  });
  const drv = a?.risk ? [["the gap between Now and Preferred", a.risk.gap], ["disagreement between respondents", a.risk.dispersion], ["distance between executives and staff", a.risk.misalignment]].sort((p, q) => n(q[1]) - n(p[1]))[0][0] : "";
  push("risk", "09", "Risk and cultural debt", "The headline measures against their default targets, and what drives the risk.", [
    { meters: (config.get("analytics.targets") as readonly (readonly [string, string, { toString(): string }])[]).filter(([k]) => tv[k]).map(([k, op, t]) => {
      const [label, v] = tv[k]!, val = n(v), tg = n(t.toString()), ok = op === "lt" ? val < tg : op === "gte" ? val >= tg : val > tg;
      const max = k === "d8" || k === "d9" ? 5 : Math.max(tg * 2, Math.ceil(val * 1.15), 1);
      return { label, value: val, shown: v, target: tg, targetText: `${ops[op]} ${t.toString()}`, ok, max };
    }) },
    ...(a?.risk ? [{ p: riskText(a.risk.index, a.risk.band, drv) }] : []),
    ...(a?.dispersion ? [{ h3: "Spread of answers by dimension" }, { chart: (() => { const top = Math.max(...["D1", "D2", "D3", "D4", "D5", "D6"].flatMap((d) => ORIENTATIONS.map((o) => n(a.dispersion[d][o])))); return { groups: ["D1", "D2", "D3", "D4", "D5", "D6"].map((d) => ({ label: d, bars: ORIENTATIONS.map((o) => ({ value: n(a.dispersion[d][o]), color: HUE_OF[o] })) })), max: Math.max(5, Math.ceil(top / 5) * 5), step: 5, legend: ORIENTATIONS.map((o) => [ORIENT_NAME[o], HUE_OF[o], false] as [string, string, boolean]) }; })() },
      { p: "High spread means people describe different cultures, often by department; low spread means the culture is consistent, for better or worse." }] : []),
    { p: `Measures marked as needing attention are where cultural debt is building: the cost of the gap grows the longer it stays open.` },
  ]);

  // ---------------------------------------------------------------- 10 hits and misses
  push("checks", "10", "Hits and misses", "Four checks of the culture against the strategy, leadership behaviour, the systems that shape behaviour, and the business model.", e ? [
    { pills: Object.entries(e.checks).map(([k, v]) => ({ name: CHECK[k]?.name ?? k, verdict: String(v), word: human(v) })) },
    ...Object.entries(e.checks).map(([k, v]) => {
      const sc = e.scenarios.find((z) => patternCheck(z.name) === k);
      const extra = ((k === "C3" && x.setup?.contradictions && Object.values(x.setup.contradictions).some(Boolean) ? [{ p: `Evidence from the debrief: the consultant recorded that ${(["h1", "h3", "h4"] as const).filter((f) => x.setup!.contradictions![f]).map((f) => ({ h1: "performance management", h3: "promotion criteria", h4: "reward" })[f]).join(", ")} contradict what happens in practice.` }] : [])) as Block[];
      return { check: { code: k, name: CHECK[k]?.name ?? k, verdict: String(v), word: human(v), asks: CHECK[k]?.asks ?? "", result: [VERDICT[v] ?? "", ...checkResult(k, v).map((r) => ("p" in r ? r.p : "")), ...extra.map((r) => ("p" in r ? r.p : ""))].filter(Boolean),
        risk: v === "HIT" ? "" : CHECK[k].risk, action: v === "HIT" ? "Keep doing what works here." : checkAction(k, v), owner: CHECK[k]?.owner ?? "", urgency: CHECK[k]?.urgency ?? "",
        ...(sc ? { pattern: { name: clean(sc.name), diagnosis: clean(sc.diagnosis), prompts: sc.hypotheses.map(clean) } } : {}) } } as Block;
    }),
  ] : [{ p: "The findings have not been run for this score." }]);

  // ---------------------------------------------------------------- 11 leadership 360
  const L = x.leaders;
  push("leaders", "11", "Leadership 360 summary", "How leaders' behaviour is seen by the people around them, across all leaders. No leader is named; each leader receives a private result for development only.", L ? [
    { cards: [["Leaders with a result", String(L.valid), `of ${L.scored} with a 360`], ["Most common growth area", Object.entries(L.growth).sort((p, q) => q[1] - p[1])[0]?.[0] ? name(Object.entries(L.growth).sort((p, q) => q[1] - p[1])[0][0]) : "n/a", "across leaders"], ["Most common default style", Object.entries(L.defaults).sort((p, q) => q[1] - p[1])[0]?.[0] ? name(Object.entries(L.defaults).sort((p, q) => q[1] - p[1])[0][0]) : "n/a", "across leaders"]] },
    { split: Object.entries(L.bands).map(([b, c], i) => ({ label: human(b), count: Number(c), color: ["#2f8f4e", "#b7791f", "#c0392b", "#51606f"][i % 4] })) },
    { p: `${L.valid} of ${L.scored} leaders had enough rater forms (three or more) for a result. ${Object.keys(L.flags).length ? `Flags raised across leaders: ${Object.entries(L.flags).map(([f, c]) => `${human(f).toLowerCase()} (${c})`).join(", ")}. These are followed up privately with each leader.` : "No integrity, safety or change capacity flags were raised."}` },
    ...((() => { const g = Object.entries(L.growth).sort((p, q) => q[1] - p[1])[0]?.[0], d = Object.entries(L.defaults).sort((p, q) => q[1] - p[1])[0]?.[0];
      return [...(g ? [{ p: `The most common growth area is ${name(g)}: the people around these leaders want them to show more of it. Where leaders show more ${name(g)}, ${ORIENT_MORE[g].more.charAt(0).toLowerCase()}${ORIENT_MORE[g].more.slice(1)}` }] : []),
        ...(d ? [{ p: `Most leaders default to ${name(d)}${dom.includes(d as Orientation) ? ", the same orientation the culture leads with now, so leaders and culture reinforce each other" : `, while the culture leads with ${dom.map(name).join(" and ")}`}. ${d === g ? "The default and the growth area are the same, so the ask is to use it more deliberately, not to change style." : `Moving toward ${g ? name(g) : "the growth area"} asks leaders to work outside their default, which needs coaching and visible recognition, not a one off course.`}` }] : [])] as Block[]; })()),
    { p: "When leaders' default style differs from the orientation the strategy needs, staff experience the strategy as words rather than practice. The leader development plans translate each result into one behaviour to start, stop or keep." },
  ] : [{ p: "No Leadership 360 was run in this assessment." }]);

  // ---------------------------------------------------------------- 12 priorities and the plan: one chapter (Erick #196), one page per priority (owner Q-ER12)
  // For each priority: what the results say, why it matters, the actions to choose from (the plan's own), how progress is measured, the 30 day signal and
  // a message a leader can share. The general playbook per orientation is not in the client report (owner Q-ER5); it stays on the staff playbook page.
  const P = x.plan, wins = (sections.quick_wins ?? "").split("\n").map((t) => t.trim()).filter(Boolean);
  push("roadmap", "", "What to do next: priorities and the plan", "What the organisation will do about the results: the priorities in order, one page each, then the first 14 days and the three phases of the change.", [
    ...own("roadmap.posture").slice(0, 1).map((v) => ({ box: { label: clean(v.title), text: clean([v.diagnosis, v.why].filter(Boolean).join(" ")) } }) as Block),
    ...(P ? [{ table: { head: ["Priority", "Orientation", "Reading", "Urgency", "Owner"], rows: P.priorities.map((p) => [`Priority ${p.sequence}`, name(p.orientation), human(p.classification), human(p.urgency_tier), p.owner_role ? role(p.owner_role) : "to agree"]), cols: [0.15, 0.18, 0.2, 0.27, 0.2] } } as Block,
      ...(P.zero.length ? [{ h3: "Pre conditions (priority zero)" } as Block, { p: "These are done before the priorities they hold back can start." } as Block, { bullets: P.zero.map((z) => `${clean(z.item)}${z.completed ? " (done)" : ""}`) } as Block] : []),
      ...P.priorities.flatMap((pri) => {
        const acts = P.actions.filter((z) => z.priority_id === pri.priority_id).sort((a, b) => Number(b.priority_score ?? 0) - Number(a.priority_score ?? 0)).slice(0, 3);
        const d = actionDepth({ orientation: pri.orientation, system_lever: acts[0]?.system_lever ?? null, is_visible_signal: acts.some((z) => z.is_visible_signal) }, pri.trade_off_orientation ?? null);
        const more = pri.classification === "MODERATE" ? "less" : "more", held = (pri.blocked_by ?? []).length > 0, o = pri.orientation;
        const kp = x.kpis.filter((k) => k.orientation === o);
        const staff = sections[`staff_${pri.priority_id}`]?.trim() || `Thank you for taking part in the Culture Dynamics Profile. One of the clearest things you told us is that you want ${more} ${name(o)} here. ${d.signal ? `Within the next 30 days you will see this from us: ${clean(d.signal).replace(/\.$/, "")}. ` : "We are starting on it now. "}We will check how it is going with you at the next pulse and tell you what has changed.`;
        return [
          { pb: true } as Block,
          { ph: { title: `Priority ${pri.sequence}: ${more === "more" ? "Build" : "Rebalance"} ${name(o)}`, o } } as Block,
          { cards: [["Now", dp(os.now[o], 1), "points"], ["Preferred", dp(os.preferred[o], 1), "points"], ["Gap", signed(os.gap[o], 1), `people want ${more}`]] } as Block,
          { h3: "What the results say" } as Block,
          { p: `${GAP_CLASS[pri.classification] ? `People want ${more} ${name(o)}: ${GAP_CLASS[pri.classification]}. ` : ""}Urgency: ${human(pri.urgency_tier).toLowerCase()}. Owner: ${pri.owner_role ? role(pri.owner_role) : "to agree"}.${held ? " This priority waits until its pre conditions are done." : ""}` } as Block,
          ...(d.why ? [{ h3: "Why it matters" } as Block, { p: clean(d.why) } as Block] : []),
          ...(acts.length ? [{ h3: "What to do" } as Block, { actions: acts.map((z, j) => ({ text: clean(`${z.objective}. ${z.intervention}`), when: human(z.horizon), owner: z.owner ? role(z.owner) : "to agree", recommended: j === 0 })) } as Block] : []),
          ...(kp.length || d.signal ? [{ h3: "How progress is measured" } as Block, { bullets: [...(d.signal ? [`Within 30 days: ${clean(d.signal).replace(/^within 30 days[,:]?\s*/i, "").replace(/\.$/, "")}.`] : []), ...kp.map((k) => `${k.name}: baseline ${k.baseline ?? "to set"}, 12 month target ${k.target_12m ?? "to set"}.`), ...(d.watch.length ? [`At the next pulse: ${clean(d.watch.join(", "))}.`] : [])] } as Block] : []),
          { box: { label: "What to say to your team", text: staff } } as Block,
        ];
      })] : [{ callout: "The action plan has not been built yet. The priorities appear here once the consultant builds the plan with the executive team." } as Block]),
    { pb: true },
    // quick wins: the consultant's own list when written, otherwise the library's for this result (owner Q-AL36)
    { h3: "The first 14 days" }, { bullets: wins.length ? wins.map(clean) : own("roadmap.quickwin").length ? own("roadmap.quickwin").map((v) => `${clean(v.title)}. ${clean(v.diagnosis)}`) : ["To be agreed at the leadership debrief."] },
    { h3: "Three phases" },
    ...(own("roadmap.phase").length ? [{ table: { head: ["Phase", "What happens", "Success indicators"], rows: own("roadmap.phase").sort((p, q) => (p.title < q.title ? -1 : 1)).map((v) => [clean(v.title), clean(v.diagnosis), v.good.map(clean).join("; ")]), cols: [0.26, 0.44, 0.3] } } as Block] : []),
    ...(own("roadmap.phase").length ? [] : [{ table: { head: ["Phase", "When", "Focus", "Success indicator"], rows: PHASES.map((ph, i) => [ph.name, ph.when, ph.focus, [
      "Findings agreed, pre conditions closed, first visible change made",
      x.kpis.length ? `${x.kpis[0].name} moving toward ${x.kpis[0].target_12m ?? "its target"}` : "Pulse shows movement on the priority watch list",
      a ? `Cultural entropy under ${config.get("analytics.targets")[0][2].toString()} at reassessment` : "Reassessment shows the target culture"][i] ?? ""]), cols: [0.18, 0.14, 0.4, 0.28] } } as Block]),
    { h3: "Change principles" }, { bullets: CHANGE_PRINCIPLES },
    ...(sections.what_to_do_next ? [{ h3: "In plain words" }, ...paras(sections.what_to_do_next)] : []),
  ]);

  // ---------------------------------------------------------------- 13 KPIs and governance
  push("kpis", "13", "Culture KPI scorecard", "What the organisation will track, how often, and who reviews it.", [
    ...(x.kpis.length ? [{ table: { head: ["KPI", "Baseline", "12 month target", "3 year target", "Source"], rows: x.kpis.map((k) => [k.name, String(k.baseline ?? ""), String(k.target_12m ?? ""), String(k.target_3y ?? ""), k.source ?? ""]), cols: [0.34, 0.14, 0.16, 0.16, 0.2] } }] : [{ p: "No KPIs were agreed at setup." }]),
    // baseline and targets at 12 and 18 months, a fixed step better than Now (engine kpiTargets, owner Q-AL35, Q-AL38); consultant can edit
    { h3: "Targets for the culture measures" },
    { table: { head: ["Measure", "Baseline", "12 month target", "18 month target"], rows: ([
      ["Culture Risk Index", a?.risk?.index, "down", ["0", "100"], 0], ["Cultural entropy", a?.entropy?.score, "down", ["0", "100"], 1],
      ["Psychological safety", rd.d8, "up", ["1", "5"], 2], ["Adaptive capacity", rd.d9, "up", ["1", "5"], 2], ["Transformation Probability Score", rd.tps, "up", ["1", "5"], 2],
      ["Employee voice index", s.eos.index, "up", ["-100", "100"], 1], ["Largest executive and staff gap", F["perception.widest_by"], "down", ["0", "100"], 1],
    ] as [string, unknown, "up" | "down", [string, string], number][]).filter((r) => r[1] !== null && r[1] !== undefined).map(([lab, v, dir, sc, d]) => {
      const [t12, t18] = kpiTargets(String(v), dir, sc, d);
      return [lab, D(String(v)).toFixed(d), `${dir === "up" ? "at least" : "at most"} ${t12}`, `${dir === "up" ? "at least" : "at most"} ${t18}`];
    }), cols: [0.37, 0.17, 0.23, 0.23] } },
    { h3: "Culture measures to track" },
    { table: { head: ["Measure", "Now", "Kind", "Tool"], rows: [...dash.map((d) => [d[0], d[1], d[0].includes("voice") || d[0].includes("safety") ? "Leading" : "Lagging", "Pulse and reassessment"]), ["Voluntary attrition", "from HR records", "Lagging", "HR system"]], cols: [0.36, 0.18, 0.16, 0.3] } },
    { p: "Leading measures move first and warn early; lagging measures confirm that the change has landed. Review both." },
    { h3: "Governance rhythm" }, { table: { head: ["When", "What"], rows: GOVERNANCE, cols: [0.22, 0.78] } },
  ]);

  // ---------------------------------------------------------------- method and participation (spec 4.6 section 2): the client safe parts of the technical appendix, no versions or hashes (owner Q-D7-9)
  push("method", "", "Method and participation", "How the results were produced, who took part, and what is held back to protect people.", [
    { p: "Each person shared 100 points across four descriptions of how the organisation works, once for how it is Now and once for how they would prefer it to be. Every score in this report is an average of those shares, and every comparison is made inside this organisation: Now against Preferred, group against group. The report does not compare the organisation with others, because the four orientations are a way to see one organisation's own balance, and outside figures would measure different people in different settings." },
    { table: { head: ["Item", "What the report states"], rows: l.appendixParts.filter((p) => ["response_rate", "exclusions", "suppression", "substitutions", "extensions", "consistency"].includes(p.key)).flatMap((p) => p.rows.map(([k, v]) => [k, v])), cols: [0.3, 0.7] } },
    { p: "Groups below the reporting floor are never shown on their own. They are merged into the larger group they belong to, so no answer can be traced to a person." },
  ]);

  // ---------------------------------------------------------------- written comments, themes only (spec section 8; floor of eight valid comments, never verbatim text)
  const themeData = (() => { try { return JSON.parse(String(sections.themes ?? "null")) as { n: number; sample?: boolean; items: { theme: string; share: number; says: string }[] } | null; } catch { return null; } })();
  if (themeData && themeData.items?.length) push("themes", "", "What people wrote", "The themes in the written comments. Only themes are shown, never what one person wrote.", themeData.n >= 8 ? [
    ...(themeData.sample ? [{ p: "Sample themes: the comments behind this table are made up for this demonstration client." }] : []),
    { p: `${themeData.n} people wrote a comment. Each theme below is the share of comments that raised it.` },
    { table: { head: ["Theme", "Share of comments", "What people say"], rows: themeData.items.map((t) => [t.theme, `${t.share}%`, t.says]), cols: [0.24, 0.16, 0.6] } },
  ] : [{ p: "Fewer than eight people wrote a comment, so no themes are reported. This protects the people who did." }]);

  // ---------------------------------------------------------------- what this means (spec 4.6 section 11): dominant culture, direction of travel, primary misalignment, readiness constraint, in that order
  const moreG = ORIENTATIONS.filter((o) => n(os.gap[o]) > 0).sort((p, q) => n(os.gap[q]) - n(os.gap[p])), lessG = ORIENTATIONS.filter((o) => n(os.gap[o]) < 0).sort((p, q) => n(os.gap[p]) - n(os.gap[q]));
  push("meaning", "", "What this means", "The conclusion of the report, in four steps: where the culture is, where it is heading, where it does not support the strategy, and what limits the change.", [
    { h3: "Where the culture is" }, { p: `${org} is led by ${dom.map(name).join(" and ")} now (${dom.map((o) => dp(os.now[o], 1)).join(" and ")} points), with ${name(s.dominance.secondary)} second. ${ORIENT[dom[0]].strong}` },
    { h3: "Where people want it to go" }, { p: `People want ${moreG.length ? `more ${moreG.map((o) => `${name(o)} (${signed(os.gap[o], 1)})`).join(" and ")}` : "little more of any orientation"}${lessG.length ? `, and less ${lessG.map((o) => `${name(o)} (${signed(os.gap[o], 1)})`).join(" and ")}` : ""}.` },
    { h3: "Where it does not support the strategy" }, ...(big.length ? [{ bullets: big.map((b) => `${b.title}: ${b.text}`) }] : [{ p: "No finding stands out against the strategy." }]),
    { h3: "What limits the change" }, { p: rd.d9 ? `Readiness for change is ${dp(rd.d9, 2)} out of 5 (${human(rd.d9_band ?? "").toLowerCase()}) and speaking up safely is ${rd.d8 ? dp(rd.d8, 2) : "n/a"} out of 5. The pace of the plan follows these two scores.` : "Readiness for change is not available for this assessment." },
    ...(sections.what_this_means ? [{ h3: "In plain words" }, ...paras(sections.what_this_means)] : []),
  ]);

  // ---------------------------------------------------------------- appendices
  const appendices: Chapter[] = [
    { key: "app_a", num: "A", title: "Appendix A. Dimension data", lead: "Now and Preferred for every dimension.", blocks: [
      { table: { head: ["Dimension", "Perspective", ...ORIENTATIONS.map((o) => ORIENT_NAME[o])], rows: ["D1", "D2", "D3", "D4", "D5", "D6"].flatMap((d) => [[`${d} ${DIMENSION[d].name}`, "Now", ...ORIENTATIONS.map((o) => dp(s.dimension_now[d][o], 1))], ...(pref ? [["", "Preferred", ...ORIENTATIONS.map((o) => dp(pref[d][o], 1))]] : [])]), cols: [0.28, 0.16, 0.14, 0.14, 0.14, 0.14] } },
      ...(s.cohorts?.executive ? [{ h3: "A2. Cohorts, Now" }, { table: { head: ["Cohort", "n", ...ORIENTATIONS.map((o) => ORIENT_NAME[o])], rows: [["Executives", String(s.cohorts.executive.n), ...ORIENTATIONS.map((o) => dp(s.cohorts.executive.now[o], 1))], ["Staff", String(s.cohorts.staff.n), ...ORIENTATIONS.map((o) => dp(s.cohorts.staff.now[o], 1))], ["Organisation", String(nNow), ...ORIENTATIONS.map((o) => dp(os.now[o], 1))]], cols: [0.24, 0.12, 0.16, 0.16, 0.16, 0.16] } }] : []),
    ] },
    { key: "app_b", num: "B", title: "Appendix B. Glossary", lead: "The terms used in this report.", blocks: [{ table: { head: ["Term", "Meaning"], rows: [...GLOSSARY, ...adv.filter((v) => v.section === "glossary").map((v) => [clean(v.title), clean(v.diagnosis)])], cols: [0.28, 0.72] } }, { p: ETHICS }] },
    // how PAC and the client work through the report (owner Q-AL27): the sessions and their ground rules; the consultant's notes stay in the staff guide
    { key: "app_c", num: "C", title: "Appendix C. Working through this report", lead: "The sessions that turn these results into a plan, who takes part and the ground rules.", blocks: [
      ...FACILITATION.flatMap((f) => [{ h3: `${f.name} (${f.length})` }, { table: { head: ["", ""], rows: [["Who", f.who], ["Purpose", f.purpose], ["Outputs", f.outputs]], cols: [0.2, 0.8] } }, { bullets: f.agenda }] as Block[]),
      { h3: "Ground rules for every session" }, { bullets: NON_NEGOTIABLES },
    ] },
    // published work the report draws on, named in full (owner Q-AL28); no outside figures are quoted
    ...(own("sources").length ? [{ key: "app_d", num: "D", title: "Appendix D. References", lead: "Published work this report draws on.", blocks: [
      { table: { head: ["Source", "Used for"], rows: own("sources").map((v) => [v.title, clean(v.diagnosis)]), cols: [0.62, 0.38] } },
    ] }] : []),
  ];
  // The facilitation guide is for the consultant, not the client (Erick #238, owner Q-ER1): its own staff PDF from the same renderer.
  const facilitation: Chapter = { key: "facilitation", num: "", title: "Facilitation guide", lead: "How the consultant runs the debrief and turns the results into a plan. For PAC staff only; not part of the client report.", blocks: [
    ...FACILITATION.flatMap((f) => [{ h3: `${f.name} (${f.length})` }, { table: { head: ["", ""], rows: [["Who", f.who], ["Purpose", f.purpose], ["Outputs", f.outputs]], cols: [0.2, 0.8] } }, { bullets: f.agenda }] as Block[]),
    ...(adv.some((v) => v.questions.length) ? [{ h3: "Questions to explore with the client" } as Block, { p: "From the advice accepted for this report, grouped by the result each comes from." } as Block,
      ...adv.filter((v) => v.questions.length).flatMap((v) => [{ p: `${clean(v.title)}${v.scope_key ? ` (${v.scope_key})` : ""}:` } as Block, { bullets: v.questions.map(clean) } as Block])] : []),
    { h3: "Non negotiables" }, { bullets: NON_NEGOTIABLES },
    ...((sections.facilitation ?? "").trim() ? [{ h3: "Notes for this client" }, { p: sections.facilitation }] : []),
  ] };
  // Nothing technical on the client pages (Erick #240): versions and hashes are written into the file properties only, for PAC to trace a copy (owner Q-ER9).
  const trace = appendixRows(l).filter(([k]) => /version|hash/i.test(k)).map(([k, v]) => `${k}: ${v}`).join("; ");
  // the four checks in the words of the full report, shared by the brief and the PowerPoint (owner, 30 Oct 2026: they match the full report)
  const checks = e ? Object.entries(e.checks).map(([k, v]) => ({ code: k, name: CHECK[k]?.name ?? k, verdict: String(v), word: human(v), result: [VERDICT[v] ?? "", ...checkResult(k, v).map((b) => ("p" in b ? b.p : ""))].filter(Boolean).join(" "), action: v === "HIT" ? "Keep doing what works here." : checkAction(k, v) })) : [];
  // the journey page (owner picks Q-J5-5, Q-J5-7): read from the stored findings, the frozen readiness and the plan, nothing computed
  const infographic = {
    // one action per priority, titled by what the priority asks for (Erick #3), then the plan's top action for it
    actions: (P?.priorities ?? []).slice(0, 3).map((pri) => ({ pri, z: P!.actions.filter((z) => z.priority_id === pri.priority_id).sort((a, b) => Number(b.priority_score ?? 0) - Number(a.priority_score ?? 0))[0] })).filter((r) => r.z)
      .map(({ pri, z }) => ({ objective: `${pri.classification === "MODERATE" ? "Rebalance" : "Build more"} ${name(pri.orientation)}`, intervention: clean(`${z!.objective}. ${z!.intervention}`) })),
  };
  // before the plan exists, the journey shows the recommended first action of the library advice for the largest gaps
  if (!infographic.actions.length) infographic.actions = ranked.filter((o) => s.classification[o] !== "KEEP_AND_PROTECT").slice(0, 3)
    .map((o) => ({ o, v: adv.find((v) => v.section === `gaps.${o}` && v.actions.length) })).filter((r) => r.v)
    .map(({ o, v }) => ({ objective: `${s.classification[o] === "MODERATE" ? "Rebalance" : "Build more"} ${name(o)}`, intervention: clean(v!.actions[0].text) }));
  const gp = (k: "nowN" | "prefN") => Object.fromEntries(ORIENTATIONS.map((o) => [o, n(k === "nowN" ? os.now[o] : os.preferred[o])])) as Record<"ENGAGE" | "INNOVATE" | "PERFORM" | "GOVERN", number>;
  const graphics = { now: gp("nowN"), pref: gp("prefN") };
  // chapter numbers follow what is present, so removing a chapter leaves no gap
  let k = 0;
  for (const c of ch) if (/^\d+[A-C]?$/.test(c.num)) { k++; c.num = String(k).padStart(2, "0"); }
  const dimensionTable = { head: ["Dimension", ...ORIENTATIONS.map((o) => ORIENT_NAME[o])], rows: ["D1", "D2", "D3", "D4", "D5", "D6"].map((d) => [`${d} ${DIMENSION[d].name}`, ...ORIENTATIONS.map((o) => (pref?.[d] ? `${dp(s.dimension_now[d][o], 0)} to ${dp(pref[d][o], 0)}` : dp(s.dimension_now[d][o], 0)))]) };
  return { org, title: "Organisational culture report", graphics, infographic, chapters: [...specOrder(ch), ...appendices], facilitation, trace, dimensionTable, checks };
}
export type FullModel = ReturnType<typeof buildFullModel>;
