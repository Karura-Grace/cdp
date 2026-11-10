// The full report's chapters on the web page, collapsed by default, from the same content model as the full PDF.
import type { Block, FullModel } from "@/lib/export/full-model";
import { barsDrawing, verdictColor, concentricDrawing, gaugeColor, gaugeDrawing, heatmapDrawing, mapDrawing, rangeDrawing, toSvg, type O } from "@/lib/graphics/culture";

function Bars({ b }: { b: Extract<Block, { bars: unknown }>["bars"] }) {
  return (
    <div style={{ display: "grid", gap: 6, margin: "8px 0 12px" }}>
      {b.labels.map((lab, i) => (
        <div key={lab} style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10, alignItems: "center" }}>
          <span className="ssmall"><b>{lab}</b></span>
          <div style={{ display: "grid", gap: 3 }}>{b.series.map((s) => Number.isFinite(s.values[i]) && (
            <div key={s.name} title={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ height: 9, width: `${(Math.min(s.values[i], b.max) / b.max) * 100}%`, background: s.color, borderRadius: 3 }} />
              <span className="tiny muted">{s.values[i].toFixed(1)}</span></div>))}</div>
        </div>))}
      <span className="tiny muted">{b.series.map((s) => s.name).join(" against ")}{b.note ? `. ${b.note}` : ""}</span>
    </div>
  );
}

function BlockView({ b, g }: { b: Block; g: FullModel["graphics"] }) {
  if ("gauges" in b) return <div style={{ display: "grid", gridTemplateColumns: `repeat(${b.gauges.length}, 1fr)`, gap: 10, margin: "8px 0 12px" }}>{b.gauges.map((g) => <div key={g.label} style={{ textAlign: "center", background: "#fff", border: "1px solid #E6DFD4", borderRadius: 14, padding: 8 }}><div className="tiny muted">{g.label}</div><div style={{ maxWidth: 130, margin: "4px auto" }} dangerouslySetInnerHTML={{ __html: toSvg(gaugeDrawing(g.value, g.max, gaugeColor(g.value, g.max)), "g" + g.label.length) }} /><b className="small">{g.band}</b></div>)}</div>;
  if ("pills" in b) return <div style={{ display: "grid", gridTemplateColumns: `repeat(${b.pills.length}, 1fr)`, gap: 10, margin: "8px 0 12px" }}>{b.pills.map((pl) => <div key={pl.name} style={{ background: "#fff", border: "1px solid #E6DFD4", borderLeft: `5px solid ${verdictColor(pl.verdict)}`, borderRadius: 14, padding: 10 }}><div className="tiny muted">{pl.name}</div><b style={{ color: verdictColor(pl.verdict), fontSize: 12 }}>{pl.word.toUpperCase()}</b></div>)}</div>;
  if ("range" in b) return <div style={{ margin: "8px 0 12px" }} dangerouslySetInnerHTML={{ __html: toSvg(rangeDrawing(b.range.rows, b.range.aName, b.range.bName), "rng") }} />;
  if ("heat" in b) return <div style={{ margin: "8px 0 12px" }} dangerouslySetInnerHTML={{ __html: toSvg(heatmapDrawing(b.heat.rows, 480), "heat") }} />;
  if ("fig" in b) {
    const pf = b.prof ?? g, d = b.fig === "chart" ? concentricDrawing(pf.now, pf.pref, 300) : mapDrawing(b.fig, pf.now, pf.pref, null as O | null, 300);
    return <div style={{ display: "grid", gridTemplateColumns: b.text ? "minmax(200px, 300px) 1fr" : "1fr", gap: 16, alignItems: "center", margin: "8px 0" }}><div style={{ maxWidth: 340, margin: "0 auto", width: "100%" }} dangerouslySetInnerHTML={{ __html: toSvg(d, `w${b.fig}`) }} />{b.text && <div>{b.text.map((t) => <p key={t} className="small" style={{ marginBottom: 8 }}>{t}</p>)}</div>}</div>;
  }
  if ("p" in b) return <p className="small" style={{ marginBottom: 8 }}>{b.p}</p>;
  if ("h3" in b) return <h3 style={{ fontSize: 14, margin: "12px 0 6px" }}>{b.h3}</h3>;
  if ("callout" in b) return <div className="cds-explain">{b.callout}</div>;
  if ("bullets" in b) return <ul className="small" style={{ margin: "0 0 8px 18px" }}>{b.bullets.map((t) => <li key={t}>{t}</li>)}</ul>;
  if ("bars" in b) return <Bars b={b.bars} />;
  if ("cards" in b) return <div className="cds-kpis">{b.cards.map(([l, v, n]) => <div className="cds-kpi" key={l}><div className="k-l">{l}</div><div className="k-v">{v}</div><div className="k-n">{n}</div></div>)}</div>;
  if ("ph" in b) return <h3 style={{ fontSize: 14, margin: "12px 0 6px" }}>{b.ph.title}</h3>;
  if ("pb" in b) return <hr style={{ margin: "14px 0", border: 0, borderTop: "1px solid var(--line, #e3e3e3)" }} />;
  if ("box" in b) return <div className="cds-explain"><b>{b.box.label}.</b> {b.box.text}</div>;
  // the chosen looks (Q-ER18 to Q-ER20), the same drawings as the PDF
  const legend = (l: [string, string, boolean][]) => <div className="tiny muted" style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "4px 0" }}>{l.map(([t, c, ghost]) => <span key={t}><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: c, opacity: ghost ? 0.25 : 1, marginRight: 4, verticalAlign: "middle" }} />{t}</span>)}</div>;
  if ("tiles" in b) return <div className="cds-kpis">{b.tiles.map((t) => <div className="cds-kpi" key={t.label} style={{ background: t.tone, color: "#fff" }}><div className="k-l" style={{ color: "#fff" }}>{t.label}</div><div className="k-v" style={{ color: "#fff" }}>{t.value}</div><div className="k-n" style={{ color: "#fff" }}>{t.note}</div></div>)}</div>;
  if ("big3" in b) return <div style={{ display: "grid", gridTemplateColumns: `repeat(${b.big3.length}, 1fr)`, gap: 12, margin: "8px 0 12px" }}>{b.big3.map((x) => <div key={x.kind}><b className="tiny" style={{ color: x.good ? "#2f8f4e" : "#c0392b" }}>{x.kind}</b><div style={{ background: x.good ? "#2f8f4e" : "#c0392b", color: "#fff", borderRadius: 12, padding: "8px 12px", margin: "6px 0", fontWeight: 700 }}>{x.title}</div><p className="small">{x.text}</p><b>{x.figure}</b></div>)}</div>;
  if ("glance" in b) return <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 260px) 1fr", gap: 16, alignItems: "center", margin: "8px 0" }}><div dangerouslySetInnerHTML={{ __html: toSvg(concentricDrawing(g.now, g.pref, 300), "glance") }} /><div><h3 style={{ fontSize: 14, margin: "0 0 6px" }}>The culture at a glance</h3><ul className="small" style={{ margin: "0 0 0 18px" }}>{b.glance.map((t) => <li key={t}>{t}</li>)}</ul></div></div>;
  if ("chart" in b) return <div style={{ margin: "8px 0 12px" }}>{legend(b.chart.legend)}<div dangerouslySetInnerHTML={{ __html: toSvg(barsDrawing(b.chart.groups, b.chart.max, 520, 230, b.chart.step), "bars") }} /></div>;
  if ("grid" in b) return <div style={{ margin: "8px 0 12px" }}>{legend(b.legend)}<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>{b.grid.map((c) => <div key={c.title}><b className="small">{c.title}</b><div dangerouslySetInnerHTML={{ __html: toSvg(barsDrawing(c.groups, b.max, 300, 170), c.title.slice(0, 2)) }} /></div>)}</div></div>;
  // the remaining tables as cards, bars and chips (owner Q-ER24)
  const TONE = { ok: "#2f8f4e", warn: "#b7791f", bad: "#c0392b" } as const;
  const bar = (v: number | null, max: number, color: string) => <span style={{ display: "inline-block", width: 160, height: 9, background: "#efe9df", borderRadius: 5, verticalAlign: "middle" }}><span style={{ display: "block", height: 9, width: `${v === null ? 0 : Math.min(100, (v / max) * 100)}%`, background: color, borderRadius: 5 }} /></span>;
  if ("check" in b) { const c = b.check, col = verdictColor(c.verdict);
    return <div className="pt-card" style={{ borderLeft: `5px solid ${col}`, margin: "10px 0" }}><h3 style={{ fontSize: 14, margin: "0 0 4px" }}>{c.code} · {c.name} <span className="cds-pill" style={{ background: col, color: "#fff" }}>{c.word}</span></h3><p className="tiny muted">{c.asks}</p>{c.result.map((t) => <p className="small" key={t}>{t}</p>)}
      {c.risk && <p className="small"><b>Risk if not addressed.</b> {c.risk}</p>}<p className="small"><b>Proposed intervention.</b> {c.action}</p><p className="tiny muted">Owner: {c.owner} · Urgency: {c.urgency}</p>
      {c.pattern && <div className="cds-explain"><b>Pattern to explore: {c.pattern.name}.</b> {c.pattern.diagnosis} Questions for the debrief: {c.pattern.prompts.join(" ")}</div>}</div>; }
  if ("hbars" in b) return <div style={{ margin: "6px 0 10px" }}><b className="small">{b.hbars.title}</b>{b.hbars.rows.map((r) => <div key={r.label} className="small" style={{ display: "grid", gridTemplateColumns: "1fr 170px 40px", gap: 8, alignItems: "center", margin: "4px 0" }}><span>{r.label}</span>{bar(r.value, b.hbars.max, "#eb5733")}<b>{r.shown}</b></div>)}</div>;
  if ("meters" in b) return <div style={{ margin: "6px 0 10px" }}>{b.meters.map((m) => <div key={m.label} className="small" style={{ display: "grid", gridTemplateColumns: "1fr 170px 60px 130px", gap: 8, alignItems: "center", margin: "4px 0" }}><span>{m.label} <span className="tiny muted">(target {m.targetText})</span></span>{bar(m.value, m.max, m.ok ? TONE.ok : TONE.bad)}<b>{m.shown}</b><span className="cds-pill" style={{ background: m.ok ? TONE.ok : TONE.bad, color: "#fff" }}>{m.ok ? "On target" : "Needs attention"}</span></div>)}</div>;
  if ("chips" in b) return <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "6px 0 10px" }}>{b.chips.map((c) => <span key={c.label} className="cds-pill" style={{ background: TONE[c.tone], color: "#fff" }}>{c.label}</span>)}</div>;
  if ("split" in b) { const tot = b.split.reduce((a, x) => a + x.count, 0) || 1;
    return <div style={{ margin: "6px 0 10px" }}><div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden" }}>{b.split.map((x) => <span key={x.label} style={{ width: `${(x.count / tot) * 100}%`, background: x.color }} />)}</div>{legend(b.split.map((x) => [`${x.label}: ${x.count}`, x.color, false]))}</div>; }
  if ("actions" in b) return <ol className="small" style={{ margin: "6px 0 10px 18px" }}>{b.actions.map((a) => <li key={a.text} style={{ marginBottom: 6 }}>{a.recommended && <b>Recommended. </b>}{a.text} <span className="tiny muted">({a.when}; owner {a.owner})</span></li>)}</ol>;
  if ("dept" in b) return <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 3fr) 2fr", gap: 14, alignItems: "start", margin: "10px 0" }}><div><b className="small">{b.dept.title}</b><div dangerouslySetInnerHTML={{ __html: toSvg(barsDrawing(b.dept.groups, b.dept.max, 480, 200), "dept") }} /></div><div className="cds-explain"><b style={{ color: b.dept.color }}>{b.dept.head}.</b> {b.dept.text}</div></div>;
  const t = b.table;
  return (
    <div className="tblwrap" style={{ margin: "6px 0 12px" }}><table className="tbl">
      {t.head.some(Boolean) && <thead><tr>{t.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>}
      <tbody>{t.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

export function Chapters({ f }: { f: FullModel }) {
  return (
    <section className="cds-sec" id="cds-full">
      <h2>The full report <span className="cds-pill grey">{f.chapters.length} chapters and appendices</span></h2>
      <p className="cds-sub">Every chapter of the full PDF. Open any to read it here.</p>
      {f.chapters.map((c) => (
        <details key={c.key} className="cds-card" style={{ margin: "0 0 8px" }}>
          <summary style={{ cursor: "pointer" }}><b>{c.num && c.num !== "ES" ? `${c.num} · ` : ""}{c.title}</b> <span className="tiny muted">{c.lead}</span></summary>
          <div style={{ marginTop: 10 }}>{c.blocks.map((b, i) => <BlockView key={i} b={b} g={f.graphics} />)}
            {c.consultant?.trim() && <div className="cds-explain"><b>Consultant&apos;s note.</b> {c.consultant}</div>}</div>
        </details>))}
    </section>
  );
}
