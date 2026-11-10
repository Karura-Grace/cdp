import { mapStone } from "../culture-route";
import { ORIENT_COLOR, ORIENT_NAME, ORIENTATIONS, dp, human, signed, type Orientation } from "../format";
import { appendixRows } from "./appendix";
import { MAP_LIMIT, mapPoint } from "../culture-map";
import type { LoadedReport } from "../report-data";
import type { Extras } from "../report-extras";
import { valuesReality } from "@pac/cdp-engine";
import { CHANGE_PRINCIPLES, EOS_NAMES, ETHICS, GLOSSARY, GOVERNANCE, bigThree, narrative, scorecard } from "../report-story";

// One content model for every export format, so PPTX and PDF can never disagree with each other or the web view.
// Everything here is read from the frozen score and evaluation; nothing is recomputed.
export function buildModel(l: LoadedReport, x: Extras = { kpis: [], depts: null, invited: null }) {
  const { rep, score: s, evaluation: e } = l;
  const name = (o: string) => ORIENT_NAME[o as Orientation] ?? o;
  const rd = s.readiness;
  const sections = rep.sections_json as Record<string, string>;
  return {
    org: l.tenantName ?? "Client organisation",
    title: `${human(rep.type)} report`,
    audience: rep.audience ?? "",
    purpose: l.purpose ?? "",
    released: rep.released_at?.slice(0, 10) ?? "",
    clientLogo: x.logo ?? null,
    coverColour: x.coverColour ?? null,
    footer: `Prepared for ${l.tenantName ?? "the client"} · Released ${rep.released_at?.slice(0, 10)}`,
    // nothing technical on the client pages (Erick #240): the version and hashes go into the file properties, where PAC can read them (owner Q-ER9)
    trace: `score v${rep.score_version}; score ${l.scoreHash}; report ${rep.payload_hash ?? ""}`,
    summary: [["What this means", sections.what_this_means], ["What to do next", sections.what_to_do_next]].filter((x) => x[1]) as [string, string][],
    kpis: [
      ["Dominant culture", s.dominance.dominant.map(name).join(" and "), `then ${name(s.dominance.secondary)}`],
      ["Culture strength", dp(s.culture_strength, 1), human(s.strength_band)],
      ["Transformation Probability Score (TPS)", rd.tps ? dp(rd.tps, 2) : "n/a", `${rd.tps_band ? human(rd.tps_band) : ""}${rd.provisional ? " (provisional)" : ""}`],
      ["Responses used", String(s.counts.now), `now · ${s.counts.preferred} preferred`],
    ] as [string, string, string][],
    profile: ORIENTATIONS.map((o) => ({
      name: ORIENT_NAME[o], color: ORIENT_COLOR[o],
      now: dp(s.orientation_scores.now[o], 0), preferred: dp(s.orientation_scores.preferred[o], 0),
      gap: signed(s.orientation_scores.gap[o]), reading: human(s.classification[o]),
      nowN: parseFloat(s.orientation_scores.now[o]), prefN: parseFloat(s.orientation_scores.preferred[o]),   // geometry only
    })),
    // the Culture Map: where Now and Preferred sit on the four squares (geometry only; the printed scores are the strings above)
    map: (() => {
      const now = mapPoint(s.orientation_scores.now as never), pref = mapPoint(s.orientation_scores.preferred as never);
      const pos = (p: ReturnType<typeof mapPoint>) => ({ x: p.x, y: p.y, xPts: dp(p.xPts, 0), yPts: dp(p.yPts, 0), offScale: p.offScale });
      return { limit: MAP_LIMIT, now: pos(now), pref: pos(pref), stone: mapStone(s.orientation_scores.now as never, s.orientation_scores.preferred as never),
        note: `Scale ±${MAP_LIMIT} points from the centre, a ring every 10. The nearer a corner, the more of that orientation; the centre is an even culture.` };
    })(),
    perception: s.perception_gap
      ? { rows: ORIENTATIONS.map((o) => [ORIENT_NAME[o], dp(s.perception_gap![o], 1), human(s.perception_flags?.[o] ?? "NONE")] as [string, string, string]) }
      : { note: `Not shown: ${human(s.perception_not_computed_reason ?? "cohort too small")}. Groups are compared only when each has at least five responses.` },
    readiness: ([["Digital readiness", rd.d7, rd.d7_band], ["Psychological safety", rd.d8, rd.d8_band], ["Adaptive capacity", rd.d9, rd.d9_band]] as const)
      .map(([n, v, b]) => [n, v ? dp(v, 1) : "n/a", b ?? ""] as [string, string, string]),
    readinessNote: `Employee experience index: ${s.eos.index ? dp(s.eos.index, 1) : "n/a"}.${rd.provisional ? ` The readiness score is provisional until leadership 360 results are in (leader coverage ${dp(rd.coverage, 2)}).` : ""}`,
    checks: Object.entries(e?.checks ?? {}).map(([k, v]) => `${k} ${human(v)}`),
    scenarios: (e?.scenarios ?? []).map((c) => ({ name: c.name, severity: human(c.severity), diagnosis: c.diagnosis, hypotheses: c.hypotheses })),
    appendix: appendixRows(l),
    // the organisational report in the shape of the PAC reference report (null for other report types)
    story: rep.type !== "ORGANISATIONAL" ? null : (() => {
      const a = s.analytics, lines = (t?: string) => (t ?? "").split("\n").map((v) => v.trim()).filter(Boolean);
      const vr = valuesReality(s.dimension_now as never);
      return {
        tiles: scorecard(s, e), big: bigThree(s), board: narrative(s, e, "BOARD"), people: narrative(s, e, "PEOPLE"),
        values: ORIENTATIONS.map((o) => [ORIENT_NAME[o], vr[o].espoused.toFixed(1), vr[o].lived.toFixed(1), signed(vr[o].delta.toString(), 1)] as [string, string, string, string]),
        entropy: a ? [a.entropy.score, human(a.entropy.band)] as [string, string] : null,
        tensions: (a?.tensions ?? []).map((t) => [`${name(t.a)} and ${name(t.b)}`, `${t.score} / 10`, human(t.band)] as [string, string, string]),
        risk: a?.risk ? { index: a.risk.index, band: human(a.risk.band), rows: [["Gap between Now and Preferred", "40%", a.risk.gap], ["Disagreement between respondents", "30%", a.risk.dispersion], ["Distance between executives and staff", "30%", a.risk.misalignment]] as [string, string, string][] } : null,
        spread: a?.dispersion?.overall ?? null,
        eos: EOS_NAMES.map((n, i) => [n, s.eos[`Q${i + 1}` as "Q1"] ?? null] as const).filter(([, v]) => v !== null).map(([n, v]) => [n, v! > 0 ? `+${v}` : String(v), v! < 0 ? "Critical" : v! <= 20 ? "Marginal" : v! <= 50 ? "Good" : "Excellent"] as [string, string, string]),
        depts: (x.depts ?? []).map((c) => c.suppressed ? [c.label, "", "Fewer than five responses: combined", "", "", "", ""] : [c.label, String(c.n), c.dominant ? name(c.dominant) : "", ...ORIENTATIONS.map((o) => (c.now?.[o] ? dp(c.now[o], 1) : ""))]),
        kpis: x.kpis.map((k) => [k.name, String(k.baseline ?? ""), String(k.target_12m ?? ""), String(k.target_3y ?? "")] as [string, string, string, string]),
        governance: GOVERNANCE as [string, string][], principles: CHANGE_PRINCIPLES,
        quickWins: lines(sections.quick_wins), facilitation: lines(sections.facilitation),
        method: `${s.counts.now} responses used for Now and ${s.counts.preferred} for preferred${x.invited ? `, from ${x.invited} people invited${x.submitted != null ? `; ${x.submitted} submitted (${Math.round((x.submitted / x.invited) * 100)}% response rate)` : ""}` : ""}.`,
        glossary: GLOSSARY, ethics: ETHICS,
      };
    })(),
  };
}
export type Model = ReturnType<typeof buildModel>;
