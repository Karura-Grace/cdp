"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Version = { version_id: string; version_no: number; file_name: string; clean: boolean; uploaded_at: string };
type Change = { section: string; path: string; was: unknown; now: unknown };
type UploadResult = { version_no?: number; changed?: boolean; clean?: boolean; message?: string; problems?: Record<string, string[]>; changes?: Change[]; title?: string };

const send = (url: string, init?: RequestInit) => fetch(url, { ...init, headers: { "x-cdp-csrf": "1", ...(init?.headers ?? {}) } });
const show = (v: unknown) => (v === null || v === undefined ? "empty" : Array.isArray(v) ? v.join(", ") : typeof v === "boolean" ? (v ? "Yes" : "No") : String(v));

// The Workshop 1 workbook: download the Excel file, fill it in at the workshop, review and change it, upload it again. Every upload is a new version and none is overwritten.
// The version marked final is written to the Setup drafts; it still has to be agreed in the workshop steps before the engine reads it. Excel only, no CSV.
export default function WorkbookPanel({ engagementId, locked }: { engagementId: string; locked: boolean }) {
  const base = `/v1/engagements/${engagementId}/setup/workbook`;
  const [vs, setVs] = useState<Version[]>([]);
  const [fin, setFin] = useState<string | null>(null);
  const [res, setRes] = useState<UploadResult | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const r = await send(`${base}/versions`);
    if (r.ok) { const j = await r.json(); setVs(j.versions); setFin(j.final_version_id); }
  }, [base]);
  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    const f = file.current?.files?.[0];
    if (!f) return setMsg({ ok: false, text: "Choose the filled workbook (.xlsx) first." });
    setBusy(true); setMsg(null); setRes(null);
    const r = await send(`${base}?name=${encodeURIComponent(f.name)}`, { method: "POST", body: await f.arrayBuffer(), headers: { "content-type": "application/octet-stream" } });
    const j = (await r.json().catch(() => null)) as UploadResult | null;
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j?.title ?? "The upload did not work." });
    setRes(j); setMsg({ ok: true, text: j?.changed === false ? (j.message ?? "No change.") : `Saved as version ${j?.version_no}.` });
    if (file.current) file.current.value = "";
    load();
  };
  const mark = async (id: string) => {
    setBusy(true); setMsg(null);
    const r = await send(`${base}/final`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version_id: id }) });
    const j = await r.json().catch(() => null);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: `Version ${j.version_no} is final. Sections ${j.sections_written.join(", ")} were written to Setup as drafts: agree them in the workshop steps below.` } : { ok: false, text: j?.title ?? "That did not work." });
    load();
  };
  const problems = res?.problems ? Object.entries(res.problems) : [];
  return (
    <section className="scard" aria-labelledby="wb-h">
      <div className="scard-head"><div><h2 id="wb-h">Workshop 1 workbook</h2>
        <p className="ssmall smuted">An Excel file with one sheet for each setup section, A to I. Fill it in at the workshop, review and change it, then upload it again. Each upload is a new version; the one you mark final fills Setup.</p></div></div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <a className="sbtn ghost" href={base} download>Download the blank workbook</a>
        {!locked && <>
          <input ref={file} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label="Filled workbook" />
          <button className="sbtn orange" disabled={busy} onClick={upload}>{busy ? "Working…" : "Upload the workbook"}</button></>}
        {msg && <span className="ssmall" role={msg.ok ? "status" : "alert"} style={{ color: msg.ok ? "var(--hit)" : "var(--bad)" }}>{msg.text}</span>}
      </div>
      {problems.length > 0 && <div className="cds-explain" role="alert" style={{ marginTop: 10 }}><b>Fix these in the workbook and upload it again:</b>
        {problems.map(([sec, list]) => <div key={sec}><b>Section {sec}</b><ul style={{ margin: "2px 0 6px 18px" }}>{list.slice(0, 8).map((p) => <li key={p}>{p}</li>)}{list.length > 8 && <li>and {list.length - 8} more</li>}</ul></div>)}</div>}
      {res?.changes && res.changes.length > 0 && <details style={{ marginTop: 10 }}><summary className="ssmall"><b>{res.changes.length} change{res.changes.length === 1 ? "" : "s"} since the previous version</b></summary>
        <div className="stblwrap"><table className="stbl"><thead><tr><th>Section</th><th>Answer</th><th>Was</th><th>Now</th></tr></thead>
          <tbody>{res.changes.slice(0, 200).map((c, i) => <tr key={i}><td>{c.section}</td><td className="ssmall">{c.path}</td><td className="ssmall">{show(c.was)}</td><td className="ssmall">{show(c.now)}</td></tr>)}</tbody></table></div></details>}
      {vs.length > 0 && <div className="stblwrap" style={{ marginTop: 10 }}><table className="stbl"><thead><tr><th>Version</th><th>File</th><th>Uploaded</th><th>Checks</th><th /></tr></thead>
        <tbody>{vs.map((v) => (
          <tr key={v.version_id}><td><b>{v.version_no}</b>{fin === v.version_id && <span className="stag ok" style={{ marginLeft: 6 }}>Final</span>}</td><td className="ssmall">{v.file_name}</td><td className="ssmall">{v.uploaded_at.slice(0, 16).replace("T", " ")}</td>
            <td><span className={`stag ${v.clean ? "ok" : "orange"}`}>{v.clean ? "Clean" : "Has problems"}</span></td>
            <td style={{ display: "flex", gap: 6 }}><a className="sbtn ghost" href={`${base}?version=${v.version_id}`} download>Download</a>
              {!locked && v.clean && fin !== v.version_id && <button className="sbtn ghost" disabled={busy} onClick={() => mark(v.version_id)}>Mark final</button>}</td></tr>))}</tbody></table></div>}
    </section>
  );
}
