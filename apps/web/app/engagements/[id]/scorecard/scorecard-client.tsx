"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DIRECTIONS, ORIENTS, UNITS, type KpiOut, type ObjOut } from "@/lib/scorecard-types";

const api = (method: string, url: string, body?: BodyInit, type = "application/json") => fetch(url, { method, headers: { "content-type": type, "x-cdp-csrf": "1" }, body });
const blank = () => ({ info: "", external_ref: "", name: "", unit: "PERCENT", currency_code: "", direction: "HIGHER_IS_BETTER", baseline_value: "", baseline_date: "", baseline_source: "", target_12m: "", target_3y: "", orientation: "" });
type Row = ReturnType<typeof blank>;
interface Obj { title: string; external_ref: string; priority_keys: string[]; kpis: Row[] }
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const KPI_FIELDS = Object.keys(blank()).filter((f) => f !== "info");
const info = (k: KpiOut) => [k.readings.length ? `Readings: ${k.readings.length}, latest ${k.readings.at(-1)!.value} on ${k.readings.at(-1)!.read_on}.` : "", k.actions.length ? `Linked actions: ${k.actions.map((a) => a.action_id).join(", ")}.` : ""].filter(Boolean).join(" ");
const fromOut = (o: ObjOut): Obj => ({ title: o.title, external_ref: str(o.external_ref), priority_keys: o.priority_keys,
  kpis: o.kpis.map((k) => ({ ...blank(), info: info(k), ...Object.fromEntries(KPI_FIELDS.map((f) => [f, str((k as unknown as Record<string, unknown>)[f])])) })) });
const num = (v: string) => (v.trim() === "" ? null : /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN);

export default function ScorecardClient({ engagementId, editable, locked, priorities, initial }: { engagementId: string; editable: boolean; locked: boolean; priorities: { ref: string; text: string }[]; initial: ObjOut[] }) {
  const router = useRouter();
  const [objs, setObjs] = useState<Obj[]>(initial.map(fromOut));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; list?: string[] } | null>(null);
  const base = `/v1/engagements/${engagementId}/scorecard`;

  const upd = (i: number, f: (o: Obj) => Obj) => setObjs((p) => p.map((o, n) => (n === i ? f(o) : o)));
  const body = () => JSON.stringify({ objectives: objs.map((o) => ({ title: o.title, external_ref: o.external_ref.trim() || null, priority_keys: o.priority_keys, kpis: o.kpis.map((k) => ({
    external_ref: k.external_ref.trim() || null, name: k.name, unit: k.unit, currency_code: k.unit === "CURRENCY" ? "USD" : null, direction: k.direction, baseline_value: num(k.baseline_value) ?? NaN, baseline_date: k.baseline_date,
    baseline_source: k.baseline_source, target_12m: num(k.target_12m) ?? NaN, target_3y: num(k.target_3y), orientation: k.orientation || null })) })) });

  async function run(fn: () => Promise<Response>, ok: string) {
    setBusy(true); setMsg(null);
    const r = await fn(), j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j?.title ?? "That did not work.", list: Array.isArray(j?.errors) ? j.errors : undefined });
    setMsg({ ok: true, text: ok }); router.refresh();
    if (j.objectives) setObjs((j.objectives as ObjOut[]).map(fromOut));
    if (Array.isArray(j.skipped) && j.skipped.length) setMsg({ ok: true, text: `${ok} ${j.skipped.length} KPI${j.skipped.length === 1 ? " was" : "s were"} left out.`, list: j.skipped.map((x: { kpi: string; reason: string }) => `${x.kpi}: ${x.reason}`) });
  }
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (f) await run(async () => api("POST", `${base}/import`, await f.text(), "text/csv"), "File imported and merged.");
  };

  return (
    <>
      {locked && <div className="note"><b>The scorecard is locked.</b> The assessment has launched, so nothing here changes.</div>}
      {!locked && !priorities.length && <div className="note"><b>Save Section B first.</b> Every objective is linked to one or more Section B priorities.</div>}
      {msg && <div className="note" role={msg.ok ? "status" : "alert"}><b>{msg.text}</b>{msg.list && <ul>{msg.list.slice(0, 12).map((x) => <li key={x}>{x}</li>)}</ul>}</div>}
      <section className="scard">
        <div className="scard-head"><div><h2>Objectives and KPIs</h2><div className="ssmall smuted">Each KPI needs a baseline and a 12 month target. Link a KPI to an orientation if it should feed the plan; one KPI per orientation.</div></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="sbtn ghost" href={`${base}/export?format=csv`}>Download CSV</a>
            {editable && <button type="button" className="sbtn ghost" disabled={busy} onClick={() => run(() => api("POST", `${base}/from-setup`), "Imported from Sections C and D.")}>Import from Sections C and D</button>}
            {editable && <label className="sbtn ghost" style={{ cursor: "pointer" }}>Import CSV<input type="file" accept=".csv,text/csv" onChange={upload} disabled={busy} style={{ display: "none" }} /></label>}
          </div></div>
        {objs.map((o, i) => (
          <fieldset key={i} className="addbox" style={{ marginBottom: 12 }} disabled={!editable}>
            <legend className="flab">Objective {i + 1}</legend>
            <div className="field"><label className="flab">Title<input value={o.title} maxLength={200} onChange={(e) => upd(i, (x) => ({ ...x, title: e.target.value }))} /></label></div>
            <div className="field"><label className="flab">Reference in your own scorecard system (optional)<input value={o.external_ref} maxLength={100} onChange={(e) => upd(i, (x) => ({ ...x, external_ref: e.target.value }))} /></label></div>
            <div className="field"><span className="flab">Section B priorities it serves</span>
              {priorities.map((p) => <label key={p.ref} style={{ display: "block" }}><input type="checkbox" checked={o.priority_keys.includes(p.ref)}
                onChange={(e) => upd(i, (x) => ({ ...x, priority_keys: e.target.checked ? [...x.priority_keys, p.ref] : x.priority_keys.filter((k) => k !== p.ref) }))} /> {p.ref} {p.text}</label>)}</div>
            {o.kpis.map((k, j) => {
              const set = (key: keyof Row, v: string) => upd(i, (x) => ({ ...x, kpis: x.kpis.map((y, n) => (n === j ? { ...y, [key]: v } : y)) }));
              const inp = (key: keyof Row, label: string, type = "text") => <div className="field"><label className="flab">{label}<input type={type} value={k[key]} onChange={(e) => set(key, e.target.value)} /></label></div>;
              const sel = (key: keyof Row, label: string, opts: readonly string[], blankOpt = false) => <div className="field"><label className="flab">{label}<select value={k[key]} onChange={(e) => set(key, e.target.value)}>{blankOpt && <option value="">None</option>}{opts.map((x) => <option key={x}>{x}</option>)}</select></label></div>;
              return (
                <div key={j} className="formgrid" style={{ borderTop: "1px solid #ddd", paddingTop: 8 }}>
                  {inp("name", `KPI ${j + 1} name`)}{inp("external_ref", "Reference in your own system (optional)")}{sel("unit", "Unit", UNITS)}{k.unit === "CURRENCY" && <span className="small muted">Money KPIs are in US dollars (USD).</span>}
                  {sel("direction", "Direction", DIRECTIONS)}{inp("baseline_value", "Baseline value")}{inp("baseline_date", "Baseline date", "date")}{inp("baseline_source", "Baseline source")}
                  {inp("target_12m", "12 month target")}{inp("target_3y", "3 year target (optional)")}{sel("orientation", "Orientation it tracks", ORIENTS, true)}
                  {editable && <button type="button" className="sbtn ghost" onClick={() => upd(i, (x) => ({ ...x, kpis: x.kpis.filter((_, n) => n !== j) }))}>Remove KPI</button>}
                  {k.info && <div className="ssmall smuted" style={{ gridColumn: "1 / -1" }}>{k.info}</div>}
                </div>);
            })}
            {editable && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button type="button" className="sbtn ghost" onClick={() => upd(i, (x) => ({ ...x, kpis: [...x.kpis, blank()] }))}>Add a KPI</button>
              <button type="button" className="sbtn ghost" onClick={() => setObjs((p) => p.filter((_, n) => n !== i))}>Remove objective</button></div>}
          </fieldset>
        ))}
        {editable && <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="sbtn ghost" onClick={() => setObjs((p) => [...p, { title: "", external_ref: "", priority_keys: [], kpis: [blank()] }])}>Add an objective</button>
          <button type="button" className="sbtn" disabled={busy} onClick={() => run(() => api("PUT", base, body()), "Scorecard saved.")}>Save scorecard</button></div>}
      </section>
    </>
  );
}
