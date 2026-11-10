import { notFound } from "next/navigation";
import "@/app/console.css";
import * as E from "@pac/cdp-engine";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { BigTile, ChartCard, Chip, Fig, Insight, Key, MeterTile, Sec } from "@/components/portal";
import PortalTabs from "@/components/portal-tabs";
import { checkTiles, type EvalPayload } from "@/lib/findings-view";
import { ORIENT_NAME, ORIENTATIONS, dp, human, signed, type Orientation } from "@/lib/format";
import { appendixRows } from "@/lib/export/appendix";
import { loadReport } from "@/lib/report-data";
import { staffGate } from "@/lib/session";
import { serverDb } from "@/lib/supabase/server";
import Editor from "./editor";
import { reportExtras } from "@/lib/report-extras";
import { buildFullModel, findingHint } from "@/lib/export/full-model";
import { Chapters } from "./chapters";
import { FACILITATION_TEMPLATE, quickWinsDraft, scorecard, bigThree, narrative, CHANGE_PRINCIPLES, EOS_NAMES } from "@/lib/report-story";
import { FINDING_SAY, FINDING_TITLE, MEASURE_SAY, headlineSay, kpiSay, orientationSay, thisMonth } from "@/lib/report-copy";
import { ORIENT } from "@/lib/report-library";
import { concentricDrawing, gaugeColor, gaugeDrawing, heatmapDrawing, mapDrawing, rangeDrawing, HUE, type O, type Prof } from "@/lib/graphics/culture";
import { mapStone } from "@/lib/culture-route";

export const dynamic = "force-dynamic";

const lines = (t?: string) => (t ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
const name = (o: string) => ORIENT_NAME[o as Orientation] ?? o;
const num = (x: string | number | null | undefined) => (x === null || x === undefined ? NaN : Number(x));
const tone = (v: string): "ok" | "warn" | "bad" => (v === "HIT" ? "ok" : v === "MISS" || v === "SYSTEMIC_MISS" ? "bad" : "warn");
const sevTone = (sev: string): "ok" | "warn" | "bad" | "" => (sev === "CRITICAL" ? "bad" : sev === "HIGH" ? "warn" : "");
const sig = (v: number): ["Critical" | "Marginal" | "Good" | "Excellent", "bad" | "warn" | "" | "ok"] => (v < 0 ? ["Critical", "bad"] : v <= 20 ? ["Marginal", "warn"] : v <= 50 ? ["Good", ""] : ["Excellent", "ok"]);

// The web report (owner picks Q-WD1 to Q-WD20, 26 Oct 2026). Reads go through the signed-in user's token. A client role gets nothing back until a RELEASED report pins this score
// version (RLS), so a 404 here is also the answer for an unreleased or foreign report. Every section says how to read it and what to do; no figure stands alone.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/reports/${id}`);

  const loaded = await loadReport(db, id);
  if (!loaded) notFound();
  const { rep, score: s, evaluation: e, role } = loaded;
  const sections = rep.sections_json as Record<string, string>;
  const released = rep.status === "RELEASED";
  const canEdit = !released && role === "PAC_CONSULTANT";
  const rd = s.readiness, os = s.orientation_scores;
  const org = rep.type === "ORGANISATIONAL";
  const consultant = role === "PAC_CONSULTANT";

  const extras = await reportExtras(loaded, user.id);
  const { kpis, depts, logo } = extras;
  const full = org ? buildFullModel(loaded, extras) : null;

  const nowP = Object.fromEntries(ORIENTATIONS.map((o) => [o, num(os.now[o])])) as Prof, prefP = Object.fromEntries(ORIENTATIONS.map((o) => [o, num(os.preferred[o])])) as Prof;
  const stone = mapStone(os.now as never, os.preferred as never) as O | null;
  const ranked = [...ORIENTATIONS].sort((a, b) => Math.abs(num(os.gap[b])) - Math.abs(num(os.gap[a])));
  const nowTop = (s.dominance.dominant[0] ?? ranked[0]) as Orientation;
  const prefTop = [...ORIENTATIONS].sort((a, b) => num(os.preferred[b]) - num(os.preferred[a]))[0];
  const ev = e as unknown as EvalPayload | undefined;
  const c1 = ((ev?.findings ?? []) as { type: string; verdict?: string; metrics?: Record<string, unknown> }[]).filter((f) => f.type === "C1_PERFORMANCE_ALIGNMENT" && f.metrics?.alignment_pct !== undefined)
    .sort((a, b) => Number(a.metrics!.alignment_pct) - Number(b.metrics!.alignment_pct))[0];
  const verdict = e?.checks.C1 as string | undefined;
  const tiles = org ? scorecard(s, e) : [];
  const gaps = ranked.map((o) => ({ o, cls: s.classification[o] as string }));

  const { nav, roleLabel } = await staffNav(db, null);
  const segHref = consultant ? `/assessments/${rep.assessment_id}/segments` : null;
  const exportLinks = released ? (org ? [["pdf", "Full report (PDF)"], ["pdf&brief=1", "Executive brief (PDF)"], ["pptx", "PowerPoint"], ...(consultant ? [["pdf&part=facilitation", "Facilitation guide (staff PDF)"]] : [])] : [["pdf", "PDF"], ["pptx", "PowerPoint"]]) : [];

  const pane = (names: string, node: React.ReactNode) => <div data-pane={names}>{node}</div>;
  const aSay = headlineSay("alignment", { verdict }), rSay = headlineSay("readiness", { band: rd.tps_band ? human(rd.tps_band) : undefined, provisional: rd.provisional });
  const heatRows = (depts ?? []).map((c) => ({ label: c.label, n: c.n, suppressed: c.suppressed, vals: ORIENTATIONS.map((o) => (c.suppressed || !c.now?.[o] ? null : num(c.now[o]) - num(os.now[o]))) }));
  const eosRows = EOS_NAMES.map((n, i) => [n, s.eos[`Q${i + 1}` as "Q1"] ?? null] as const).filter(([, v]) => v !== null);
  const wins = (sections.quick_wins ?? "").split("\n").map((t) => t.trim()).filter(Boolean);
  const fac = (sections.facilitation ?? "").split("\n").map((t) => t.trim()).filter(Boolean);
  const vr = org ? E.valuesReality(s.dimension_now as never) : null;
  const coh = s.cohorts as unknown as { executive?: { n: number; now: Record<string, string> }; staff?: { n: number; now: Record<string, string> } };
  const a = s.analytics;

  return (
    <StaffShell title={loaded.tenantName ?? "Your organisation"} subtitle={`${human(rep.type)} report`} nav={nav} email={user.email ?? ""} roleLabel={roleLabel}
      actions={<>{role !== "COACH" && <a className="sbtn ghost" href={`/assessments/${rep.assessment_id}/plan`}>Action plan</a>}{segHref && <a className="sbtn ghost" href={segHref}>Explore groups</a>}</>}>
      <div className="cds">
        {canEdit && <Editor checklist={loaded.appendixParts.map((x) => ({ label: x.label, present: x.present }))} reportId={rep.report_id} sections={sections} accepted={Object.keys(rep.accepted_json as object)} />}

        <section id="pt-overview" data-pane="overview all">
          <div className="pt-head">
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><Chip tone={released ? "ok" : "orange"}>{released ? `Released ${rep.released_at?.slice(0, 10)}` : "Draft"}</Chip></div>
              <p className="pt-sub" style={{ margin: "4px 0 0" }}>Culture Dynamics Profile · {rep.audience}{logo ? " · Presented by Priority Activator Consulting" : ""}</p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {logo && <img src={`data:${logo.type};base64,${logo.base64}`} alt={`${loaded.tenantName ?? "Client"} logo`} style={{ maxHeight: 52, maxWidth: 200, objectFit: "contain" }} />}
          </div>
          {exportLinks.length > 0 && <div className="pt-actions" style={{ marginBottom: 14 }}>{exportLinks.map(([f, label]) => <a key={f} className="sbtn" href={`/v1/reports/${rep.report_id}/export?format=${f}`}>{label}</a>)}</div>}
        </section>

        <PortalTabs>
        {pane("overview", <section id="pt-headline">
          <div className="pt-hero">
            <div className="pt-chart" style={{ display: "flex", flexDirection: "column" }}>
              <div className="pt-chiprow"><b>Now and Preferred culture</b><Chip>Now to Preferred</Chip></div>
              <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "6px 0" }}><Fig id="hm1" d={mapDrawing("move", nowP, prefP, stone, 340)} max={470} /></div>
              <Key />
              <details className="pt-exp"><summary>What it means and what to do</summary><p><b>What it means</b>The four orientations as people describe the organisation now (solid) and as they want it to be (dashed). Orange shading means people want more of that orientation than there is now; grey means less.</p><p><b>What to do</b>Start with the orientation with the largest orange step, and agree one visible change for it within 30 days.</p></details>
            </div>
            <div className="pt-bigtiles">
              <BigTile label="Now culture" value={name(nowTop)} word={`then ${name(s.dominance.secondary)}`} fill="#F4B7A6" say={headlineSay("now", { o: nowTop })} open sm />
              <BigTile label="Preferred culture" value={name(prefTop)} word={`wanted ${signed(os.gap[prefTop], 0)} points more`} fill="#F6DE9A" say={headlineSay("preferred", { o: prefTop })} sm />
              {verdict && <MeterTile label="Alignment" value={c1 ? `${dp(String(c1.metrics!.alignment_pct), 0)}%` : human(verdict)} word={human(verdict)} tone={tone(verdict)} pct={c1 ? num(c1.metrics!.alignment_pct as string) : 50} say={aSay} />}
              <MeterTile label="Readiness" value={rd.tps ? `${dp(rd.tps, 2)} / 5` : "n/a"} word={rd.tps_band ? human(rd.tps_band) : "n/a"} tone="warn" pct={rd.tps ? (num(rd.tps) / 5) * 100 : 0} say={rSay} />
            </div>
          </div>
          {org && <div className="pt-three">{bigThree(s).map((b, i) => <Insight key={b.kind} label={b.kind} title={b.title} text={`${b.text} ${b.figure}`} fill={["#CFE3CF", "#F4B7A6", "#F6DE9A"][i] ?? "#fff"} />)}</div>}
          {released && (sections.what_this_means || sections.what_to_do_next) && (
            <div className="pt-summary">
              <div><h3>What this means</h3>{lines(sections.what_this_means).map((l) => <p key={l}>{l}</p>)}</div>
              <div><h3>What to do next</h3>{lines(sections.what_to_do_next).map((l) => <p key={l}>{l}</p>)}</div>
            </div>
          )}
          <div className="pt-cards">
            <ChartCard title="The shape of the culture" chip="Four slices" say={{ meaning: "Each slice is one orientation, filled to how much of it there is now. The dashed edge is Preferred.", advice: "Look for the slice whose dashed edge reaches furthest beyond the solid: that is the shift people want most." }}><Fig id="cco" d={concentricDrawing(nowP, prefP, 300)} max={320} /></ChartCard>
            {coh.executive && coh.staff && <ChartCard title="Executives and staff" chip="Two groups" say={{ meaning: "A dot for each group on each orientation. The line between them is the difference.", advice: "Where leaders and staff differ, hold a joint session so each group hears the other describe the organisation, before changing anything." }}><Fig id="pxo" max={460} d={rangeDrawing(ORIENTATIONS.map((o) => ({ label: name(o), color: HUE[o as O], a: num(coh.executive?.now[o]), b: num(coh.staff?.now[o]) })), "Executives", "Staff")} /></ChartCard>}
            <ChartCard title="Readiness" chip="Three measures" say={{ meaning: "How well people and teams take on change: digital readiness, speaking up safely and being ready for change.", advice: "Protect speaking up safely first: it is the base every other change stands on." }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>{([["Digital readiness", rd.d7], ["Speaking up safely", rd.d8], ["Ready for change", rd.d9]] as const).map(([l, v]) => { const g = v ? num(v) : null; return <div key={l} style={{ textAlign: "center" }}><div className="pt-note" style={{ margin: "0 0 2px" }}><b>{l}</b></div><Fig id={`rg${l.length}`} d={gaugeDrawing(g, 5, gaugeColor(g, 5))} max={140} /></div>; })}</div>
            </ChartCard>
          </div>
        </section>)}

        <Sec id="cds-profile" pane="culture" title="Now and Preferred culture" pill={<Chip>Now vs Preferred</Chip>} k="now_pref" sub="The four orientations as people describe the organisation now, and as they want it to be.">
          <div className="pt-grid2">
            <div className="pt-card"><Fig id="mv" d={mapDrawing("move", nowP, prefP, stone, 300)} /></div>
            <div className="pt-card"><Fig id="cc" d={concentricDrawing(nowP, prefP, 300)} /></div>
          </div>
          <Key />
          <div className="pt-card" style={{ marginTop: 12 }}>
            <h3>The gaps, largest shift first</h3>
            {ranked.map((o) => (
              <div className="pt-gap" key={o}>
                <div><strong style={{ color: HUE[o as O] }}>{name(o)}</strong><br /><span className="pt-note" style={{ margin: 0 }}>{human(s.classification[o])}</span></div>
                <div><div className="pt-meter"><div style={{ width: `${Math.min(100, (num(os.now[o]) / 45) * 100)}%`, background: HUE[o as O] }} /></div><span className="pt-note" style={{ margin: 0 }}>Now {dp(os.now[o], 0)} · Preferred {dp(os.preferred[o], 0)}</span></div>
                <div style={{ textAlign: "right", fontWeight: 800 }}>{signed(os.gap[o])}</div>
              </div>
            ))}
          </div>
          <div className="pt-grid2" style={{ marginTop: 12 }}>
            {ranked.map((o) => { const say = orientationSay(o, s.classification[o]); return (
              <div className="pt-card pt-say" key={o}><h3 style={{ color: HUE[o as O] }}>{name(o)}</h3><p><b>What it means</b>{say.meaning}</p><p><b>What to do</b>{say.advice}</p></div>); })}
          </div>
        </Sec>

        {org && (
          <Sec id="cds-scorecard" pane="culture" title="Scorecard" pill={<Chip tone="orange">The culture scorecard</Chip>} k="scorecard">
            <div className="pt-grid3">
              {tiles.map((t) => {
                const say = MEASURE_SAY[t.label], g = t.label === "Change readiness" ? num(rd.d9) : t.label === "Transformation Probability Score (TPS)" ? num(rd.tps) : NaN;
                return (
                  <div className="pt-card pt-say" key={t.label} style={{ margin: 0 }}>
                    <div className="pt-tile" style={{ border: 0, display: "block" }}><div style={{ border: 0, padding: 0, textAlign: "left" }}><span className="l">{t.label}</span></div></div>
                    {Number.isFinite(g) ? <div style={{ maxWidth: 190 }}><Fig id={`g${t.label.length}`} d={gaugeDrawing(g, 5, gaugeColor(g, 5))} max={190} /></div> : <div className="v" style={{ fontSize: 28, fontWeight: 800 }}>{t.value}</div>}
                    <p style={{ fontWeight: 700, margin: "4px 0 8px" }}>{t.note}</p>
                    {say && <><p><b>What it means</b>{say.meaning}</p><p><b>What to do</b>{say.advice}</p></>}
                  </div>
                );
              })}
            </div>
            <h3 style={{ margin: "22px 0 8px", fontSize: 16 }}>The Big Three</h3>
            <div className="pt-grid3">{bigThree(s).map((b) => (
              <div className="pt-card" key={b.kind} style={{ margin: 0 }}><Chip tone={b.kind === "Accelerator" ? "ok" : "orange"}>{b.kind}</Chip><h3 style={{ margin: "8px 0 4px" }}>{b.title}</h3><p style={{ fontSize: 13.5, margin: 0 }}>{b.text}</p><p style={{ fontWeight: 800, marginTop: 6 }}>{b.figure}</p></div>))}</div>
            <div className="pt-grid2" style={{ marginTop: 12 }}>
              {(["BOARD", "PEOPLE"] as const).map((x) => (
                <div className="pt-card" key={x}><h3>{x === "BOARD" ? "For the Board and executive team" : "For the people team"}</h3>{narrative(s, e, x).map((l) => <p key={l} style={{ fontSize: 13.5, margin: "0 0 6px" }}>{l}</p>)}</div>))}
            </div>
          </Sec>
        )}

        {org && vr && (
          <Sec id="cds-values" pane="culture" title="Values and reality" k="values" sub="The culture people describe, against the culture they live.">
            <div className="pt-card"><Fig id="vr" max={560} d={rangeDrawing(ORIENTATIONS.map((o) => ({ label: name(o), color: HUE[o as O], a: Number(vr[o].espoused), b: Number(vr[o].lived) })), "Described", "Lived")} /></div>
          </Sec>
        )}

        {org && a && (
          <Sec id="cds-analytics" pane="culture" title="Gap and risk" k="analytics" sub="How much energy sits in the distance between Now and Preferred, and where it pulls in two directions.">
            <div className="pt-grid3">
              <div className="pt-card pt-say" style={{ margin: 0 }}><h3>Cultural entropy</h3><div style={{ fontSize: 28, fontWeight: 800 }}>{a.entropy.score}</div><p style={{ fontWeight: 700 }}>{human(a.entropy.band)}</p><p><b>What it means</b>{MEASURE_SAY["Cultural entropy"].meaning}</p></div>
              {a.risk && <div className="pt-card pt-say" style={{ margin: 0 }}><h3>Culture Risk Index</h3><div style={{ fontSize: 28, fontWeight: 800 }}>{a.risk.index}</div><p style={{ fontWeight: 700 }}>{human(a.risk.band)} risk</p><p><b>What it means</b>{MEASURE_SAY["Culture Risk Index"].meaning}</p><p><b>What to do</b>{MEASURE_SAY["Culture Risk Index"].advice}</p></div>}
              {a.tensions.slice(0, 1).map((t) => <div className="pt-card pt-say" key={t.pair} style={{ margin: 0 }}><h3>{name(t.a)} and {name(t.b)} tension</h3><div style={{ fontSize: 28, fontWeight: 800 }}>{t.score} / 10</div><p style={{ fontWeight: 700 }}>{human(t.band)}</p><p><b>What it means</b>Two orientations that compete for the same energy: people want one to grow while the other eases.</p></div>)}
            </div>
          </Sec>
        )}

        <Sec id="cds-perc" pane="groups" title="Executives and staff" k="perception" sub="Whether leaders and staff experience the same organisation.">
          {s.perception_gap && coh.executive && coh.staff ? (
            <div className="pt-card"><Fig id="px" max={560} d={rangeDrawing(ORIENTATIONS.map((o) => ({ label: name(o), color: HUE[o as O], a: num(coh.executive?.now[o]), b: num(coh.staff?.now[o]) })), "Executives", "Staff")} />
              <div className="pt-grid4" style={{ marginTop: 10 }}>{ORIENTATIONS.map((o) => <div key={o}><b style={{ color: HUE[o as O] }}>{name(o)}</b><br /><Chip tone={s.perception_flags?.[o] === "SHADOW_CULTURE" ? "bad" : s.perception_flags?.[o] === "WATCH" ? "warn" : "ok"}>{s.perception_flags?.[o] === "SHADOW_CULTURE" ? "Shadow culture" : s.perception_flags?.[o] === "WATCH" ? "Blind spot to watch" : "Aligned"}</Chip></div>)}</div></div>
          ) : <div className="pt-card"><p style={{ margin: 0 }}>Not shown: the executive or the staff group is too small to show on its own.</p></div>}
        </Sec>

        {org && depts && (
          <Sec id="cds-departments" pane="groups" title="Departments" k="departments" sub="Each department against the organisation.">
            <div className="pt-card"><Fig id="hm" max={640} d={heatmapDrawing(heatRows, 480)} /></div>
            <div className="pt-card pt-say"><p><b>Look further</b>{segHref ? <>Slice by team, location, grade or tenure in <a href={segHref}>Explore groups</a>.</> : "Your PAC consultant can slice these further by team, location, grade or tenure in a debrief."}</p></div>
          </Sec>
        )}

        {org && eosRows.length > 0 && (
          <Sec id="cds-eos" pane="groups" title="Employee voice" k="voice" sub={`How people rate eight parts of working life here. Overall index ${s.eos.index ? dp(s.eos.index, 1) : "n/a"}.`}>
            <div className="pt-grid4">{eosRows.map(([n, v]) => { const [word, t] = sig(v as number); return (
              <div className="pt-card pt-voice" key={n} style={{ margin: 0 }}><div className="pt-note" style={{ margin: 0 }}>{n}</div><div className="v">{(v as number) > 0 ? `+${v}` : v}</div><Chip tone={t}>{word}</Chip></div>); })}</div>
          </Sec>
        )}

        <Sec id="cds-ready" pane="readiness" title="Readiness for change" k="readiness" sub="Whether the organisation can absorb and sustain the change the culture gap calls for.">
          <div className="pt-grid4">
            {([["Digital readiness", rd.d7, rd.d7_band], ["Speaking up safely", rd.d8, rd.d8_band], ["Ready for change", rd.d9, rd.d9_band], ["Transformation Probability Score (TPS)", rd.tps, rd.tps_band]] as const).map(([l, v, b]) => {
              const g = v ? num(v) : null; return (
              <div className="pt-card" key={l} style={{ margin: 0, textAlign: "center" }}><div className="pt-note" style={{ margin: "0 0 4px" }}><b>{l}</b></div><div style={{ maxWidth: 170, margin: "0 auto" }}><Fig id={`r${l.length}`} d={gaugeDrawing(g, 5, gaugeColor(g, 5))} max={170} /></div><b>{b ? human(String(b)) : ""}</b></div>); })}
          </div>
          <p className="pt-note">Speaking up safely is whether people can raise problems and admit mistakes without fear. Ready for change is how well people and teams adjust when plans shift.{rd.provisional ? " The overall reading is provisional until more leadership 360 results are in." : ""}</p>
        </Sec>

        {e && (
          <>
            <Sec id="cds-align" pane="findings" title="Strategy checks" pill={<Chip tone="ok">Hits and misses</Chip>} k="checks">
              <div className="pt-grid2">
                {(ev?.c4 ? checkTiles(ev) : []).map((t) => (
                  <div className="pt-card pt-say" key={t.key} style={{ margin: 0 }}><div className="pt-note" style={{ margin: 0 }}>{t.name}</div><div style={{ margin: "4px 0" }}><Chip tone={tone(t.verdict)}>{human(t.verdict)}</Chip></div><p style={{ fontWeight: 700 }}>{t.figure}</p>{t.why && <p>{t.why}</p>}{t.response && <p><b>What to do</b>{t.response}</p>}</div>))}
              </div>
            </Sec>
            <Sec id="cds-findings" pane="findings" title="Findings" k="findings">
              {e.findings.filter((f) => f.verdict !== "HIT").slice(0, 12).map((f) => (
                <div className="pt-card pt-say" key={f.finding_id}>
                  <div className="pt-find"><h3 style={{ margin: 0 }}>{FINDING_TITLE[f.type] ?? human(f.type)}{f.orientation?.length ? ` (${f.orientation.map(name).join(", ")})` : ""}</h3><div><Chip tone={tone(f.verdict)}>{human(f.verdict)}</Chip> <Chip tone={sevTone(f.severity)}>{human(f.severity)}</Chip></div></div>
                  {f.orientation?.[0] && /^C[1-4]/.test(f.type) && <p style={{ marginTop: 6 }}><b>Why it matters</b>{ORIENT[f.orientation[0] as Orientation]?.low}</p>}
                  {findingHint(f) && <p><b>What to do</b>{findingHint(f)}</p>}
                  {FINDING_SAY[f.type] && <><p style={{ marginTop: 6 }}><b>Why it matters</b>{FINDING_SAY[f.type].meaning}</p><p><b>What to do</b>{FINDING_SAY[f.type].advice}</p></>}
                  <div className="small">{f.blocking ? "Holds related priorities until a pre condition is done. " : ""}Reference {f.finding_id}</div>
                </div>))}
              {e.scenarios.length > 0 && <div className="pt-card"><h3>Patterns to explore</h3>{e.scenarios.map((sc) => <div key={sc.scenario_id} style={{ marginTop: 8 }}><b>{sc.name}</b> <Chip tone={sevTone(sc.severity)}>{human(sc.severity)}</Chip><p style={{ fontSize: 13.5, margin: "4px 0" }}>{sc.diagnosis}</p></div>)}</div>}
            </Sec>
          </>
        )}

        {org && (
          <Sec id="cds-kpis" pane="plan" title="Culture KPIs" k="kpis" sub="The measures the executive team chose to follow the change.">
            {kpis.length === 0 && <div className="pt-card"><p style={{ margin: 0 }}>No KPIs were agreed in setup yet.</p></div>}
            <div className="pt-grid2">{kpis.map((k) => { const say = kpiSay(k.name, k.orientation); return (
              <div className="pt-card pt-say" key={k.name} style={{ margin: 0 }}>
                <h3>{k.name}</h3>
                <div className="pt-kpi-nums"><div>Now<b>{k.baseline ?? "n/a"}</b></div><div>12 months<b>{k.target_12m ?? "n/a"}</b></div><div>3 years<b>{k.target_3y ?? "n/a"}</b></div></div>
                <p><b>What it means</b>{say.meaning}</p><p><b>What to do</b>{say.advice}</p>
              </div>); })}</div>
          </Sec>
        )}

        {org && (
          <Sec id="cds-next" pane="plan" title="From findings to action" k="next">
            <div className="pt-grid2">
              <div className="pt-card"><h3>What to do this month</h3><ol style={{ margin: "0 0 0 18px", fontSize: 13.5 }}>{(wins.length ? wins : thisMonth(gaps)).map((w) => <li key={w}>{w}</li>)}</ol></div>
              <div className="pt-card"><h3>Principles that keep a change on track</h3><ol style={{ margin: "0 0 0 18px", fontSize: 13.5 }}>{CHANGE_PRINCIPLES.map((p) => <li key={p}>{p}</li>)}</ol></div>
            </div>
            {consultant && fac.length > 0 && <div className="pt-card"><h3>Facilitation guide (PAC staff only)</h3>{fac.map((f) => <p key={f} style={{ fontSize: 13.5, margin: "0 0 6px" }}>{f}</p>)}</div>}
            {!released && !wins.length && <p className="pt-note">The first days and the facilitation guide appear here once they are saved above. A draft: {quickWinsDraft.length ? "" : ""}{FACILITATION_TEMPLATE.length ? "" : ""}</p>}
          </Sec>
        )}

        {full && pane("all", <Chapters f={full} />)}

        {consultant && (
          <section id="cds-appendix" data-pane="all">
            <h2 className="pt-h">Versions</h2>
            <div className="pt-card"><table className="pt-ver"><tbody>{appendixRows(loaded).map(([k, v]) => <tr key={k + v}><td>{k}</td><td style={{ fontFamily: v.startsWith("sha256") ? "monospace" : undefined, wordBreak: "break-all" }}>{v}</td></tr>)}</tbody></table></div>
          </section>
        )}
        </PortalTabs>
      </div>
    </StaffShell>
  );
}
