"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLUMNS, KIND_LABEL, TEMPLATES, defectLocations, parseKind, toCsv, type GraphIn, type Kind, type LeaderIn } from "@/lib/org-csv";
import { api } from "@/lib/api";

interface Defect { rule: string; blocking: boolean; refs: string[]; message: string }
interface Chain { team_key: string; leader: string; chain: string[]; cycle: boolean }
type Leader = LeaderIn & { assignment_id: string };

const RULES: [string, string][] = [
  ["STRUCTURE", "One tree, one root, no cycles, every team under a department"], ["V1", "Every team has exactly one accountable leader on the window start date"],
  ["V2", "Every leader is an active person on record"], ["V3", "No one leads a team they are the only member of; no reporting cycles"],
  ["V4", "Every person has one team, one grade and, with several sites, one location"], ["V5", "Executive cohort of at least 5 (a warning)"],
  ["V6", "Every team has at least 5 people or is rolled up to its parent"], ["V7", "Work emails are unique and well formed"],
];
const OVERRIDABLE = new Set(["V1", "V2", "V3", "V4", "V6", "V7"]);
const KINDS: Kind[] = ["grades", "locations", "units", "people", "leaders"];
const download = (name: string, text: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
};

export default function OrgClient({ engagementId, editor, consultant, open, lockedWhy, windowStart, windowFromAssessment, defects, overrides, counts, teams, leaders, chains, scope }: {
  engagementId: string; editor: boolean; consultant: boolean; open: boolean; lockedWhy: string; windowStart: string; windowFromAssessment: boolean;
  defects: Defect[]; overrides: Record<string, string>; counts: Record<string, number>; teams: { key: string; name: string }[]; leaders: Leader[]; chains: Chain[]; scope: { team_key: string; headcount_led: number }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string[]>([]);
  const [ok, setOk] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [staged, setStaged] = useState<Partial<Record<Kind, { name: string; rows: number; data: unknown[] }>>>({});
  // file row of every key in the files uploaded this session, so a defect can say "people file row 14"
  const [rowMaps, setRowMaps] = useState<Partial<Record<Kind, Record<string, number>>>>({});
  const [report, setReport] = useState<(Defect & { where: string[] })[]>([]);
  const [fileErr, setFileErr] = useState<Partial<Record<Kind, string[]>>>({});
  const [rows, setRows] = useState<LeaderIn[]>(() => leaders.map(({ employee_ref, team_key, effect_from, effect_to }) => ({ employee_ref, team_key, effect_from, effect_to })));
  const canEdit = editor && open;
  const base = `/v1/engagements/${engagementId}`;

  async function call(fn: () => Promise<Response>, msg: string, after?: (j: Record<string, unknown>) => void) {
    setBusy(true); setErr([]); setOk(""); setNotes([]);
    const r = await fn();
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(Array.isArray(j?.errors) ? (j.errors as string[]) : [j?.title ?? "That did not work."]); return; }
    setOk(msg); after?.(j); router.refresh();
  }

  async function pick(kind: Kind, file: File | undefined) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return setFileErr((e) => ({ ...e, [kind]: ["The file is larger than 3 MB."] }));
    let text: string;
    if (/\.xlsx$/i.test(file.name)) {
      // the server turns the first sheet into CSV, row for row, so file rows below are the rows Excel shows
      const x = await fetch(`${base}/org-graph/xlsx`, { method: "POST", headers: { "x-cdp-csrf": "1", "content-type": "application/octet-stream" }, body: await file.arrayBuffer() });
      if (!x.ok) { const title = (await x.json().catch(() => null))?.title ?? "The workbook could not be read."; return setFileErr((e) => ({ ...e, [kind]: [title] })); }
      text = await x.text();
    } else text = await file.text();
    const r = parseKind(kind, text);
    setRowMaps((m) => ({ ...m, [kind]: r.rowOf }));
    setFileErr((e) => ({ ...e, [kind]: r.errors.slice(0, 20) }));
    setStaged((s) => { const n = { ...s }; if (r.errors.length) delete n[kind]; else n[kind] = { name: file.name, rows: r.rows.length, data: r.rows }; return n; });
  }

  async function save() {
    setBusy(true); setErr([]); setOk(""); setNotes([]);
    // kinds that were not uploaded keep what is stored; uploaded kinds replace theirs
    const cur = await api("GET", `${base}/org-graph`).then((r) => r.json()).catch(() => null);
    if (!cur?.graph) { setBusy(false); return setErr(["The stored graph could not be read."]); }
    const body = Object.fromEntries(KINDS.map((k) => [k, staged[k] ? staged[k]!.data : (cur.graph as GraphIn)[k] ?? []]));
    const r = await api("PUT", `${base}/org-graph`, body);
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(Array.isArray(j?.errors) ? j.errors : [j?.title ?? "That did not work."]);
    setStaged({}); setFileErr({});
    setReport(((j.defects ?? []) as Defect[]).map((d) => ({ ...d, where: defectLocations(d.rule, d.refs, rowMaps) })));
    setOk(`Saved. ${j.blocking?.length ? `${j.blocking.length} blocking rule(s) still fail: ${j.blocking.join(", ")}.` : "No blocking defects."}`);
    setNotes(j.notes ?? []); router.refresh();
  }

  const failing = new Map(defects.map((d) => [d.rule, d]));
  const blocking = defects.filter((d) => d.blocking);
  const defectCsv = () => download("org-graph-defects.csv", toCsv([["rule", "blocking", "reference", "file_row", "message", "override_reason"],
    ...defects.flatMap((d) => (d.refs.length ? d.refs : [""]).map((r) => [d.rule, d.blocking ? "yes" : "no", r, r ? defectLocations(d.rule, [r], rowMaps).join("; ") : "", d.message, overrides[d.rule] ?? ""]))]));

  const teamsLed = new Set(scope.map((s) => s.team_key));
  const noLeader = teams.filter((t) => !teamsLed.has(t.key));
  const upd = (i: number, k: keyof LeaderIn, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: k === "effect_to" ? v || null : v } : r)));

  return (
    <>
      {ok && <div className="note blue" role="status"><b>{ok}</b></div>}
      {err.length > 0 && <div className="note" role="alert"><b>Not saved.</b><ul style={{ margin: "6px 0 0 18px" }}>{err.slice(0, 12).map((e) => <li key={e}>{e}</li>)}{err.length > 12 && <li>and {err.length - 12} more</li>}</ul></div>}
      {notes.length > 0 && <div className="note" role="status"><b>Saved with references that did not resolve ({notes.length}):</b><ul style={{ margin: "6px 0 0 18px" }}>{notes.slice(0, 10).map((e) => <li key={e}>{e}</li>)}{notes.length > 10 && <li>and {notes.length - 10} more</li>}</ul></div>}
      {!canEdit && <div className="note"><b>{editor ? lockedWhy || "Read only." : "Read only."}</b>{!editor && " Only a PAC Consultant and the organisation's Client Admin can change the graph."}</div>}

      <div className="kgrid">
        {([["Units", counts.units], ["Teams", counts.teams], ["People", counts.people], ["Active people", counts.active], ["Leader assignments", counts.leaders]] as const).map(([l, v]) => <div className="kpi" key={l}><div className="kl">{l}</div><div className="kv">{v}</div></div>)}
      </div>

      <div className="card">
        <div className="sectionhead"><h2>Validation</h2><span className={`tag ${blocking.length ? "bad" : "ok"}`}>{blocking.length ? `${blocking.length} blocking` : "No blocking defects"}</span></div>
        <p className="small muted" style={{ marginBottom: 8 }}>Checked as of {windowStart}{windowFromAssessment ? ", the survey window start" : " (the current date: no assessment has a window yet)"}. Launch is blocked until every blocking defect is fixed or overridden with a reason, and each override is listed in the technical appendix of every report.</p>
        <div className="tblwrap"><table className="tbl"><tbody>
          {RULES.map(([r, label]) => {
            const d = failing.get(r), ov = overrides[r];
            return (
              <tr key={r}>
                <td style={{ width: 80 }}><strong>{r}</strong></td>
                <td>{label}{d && <div className="small muted" style={{ marginTop: 4 }}>{d.refs.length ? <>Affects {d.refs.length}: {d.refs.slice(0, 12).join(", ")}{d.refs.length > 12 ? ` and ${d.refs.length - 12} more` : ""}.</> : d.message}</div>}
                  {ov && <div className="small" style={{ marginTop: 4 }}>Overridden: {ov}</div>}</td>
                <td style={{ width: 150, textAlign: "right" }}>{!d ? <span className="tag ok">Pass</span> : ov ? <span className="tag warn">Overridden</span> : d.blocking ? <span className="tag bad">Blocks launch</span> : <span className="tag warn">Warning</span>}</td>
                <td style={{ width: 330 }}>
                  {consultant && canEdit && OVERRIDABLE.has(r) && (ov
                    ? <button className="btn ghost sm" disabled={busy} onClick={() => call(() => api("PUT", `${base}/org-graph/overrides`, { rule: r, reason: null }), `Override on ${r} removed.`)}>Remove override</button>
                    : d?.blocking && <form style={{ display: "flex", gap: 6 }} onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); call(() => api("PUT", `${base}/org-graph/overrides`, { rule: r, reason: f.get("reason") }), `${r} overridden.`); }}>
                      <input name="reason" required minLength={3} maxLength={500} placeholder="Reason (required)" aria-label={`Reason to override ${r}`} /><button className="btn ghost sm" disabled={busy}>Override</button></form>)}
                </td>
              </tr>
            );
          })}
        </tbody></table></div>
        {defects.length > 0 && <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={defectCsv}>Download the defect list (CSV)</button>}
      </div>

      <div className="card">
        <div className="sectionhead"><h2>Import</h2></div>
        <p className="muted" style={{ marginBottom: 8 }}>Upload CSV files (UTF-8) or XLSX workbooks (the first sheet is read; row 1 holds the column names). Rows match by key: <b>unit_key</b>, <b>employee_ref</b>, grade <b>name</b>, location <b>name</b>. Uploading a file <b>replaces</b> that kind: matching rows keep their identity, rows missing from the file are removed. Kinds you do not upload stay as they are. A person whose unit, grade or location does not exist is saved without it and reported as V4.</p>
        <div className="tblwrap"><table className="tbl">
          <thead><tr><th>File</th><th>Columns</th><th>Stored</th><th>Upload</th></tr></thead>
          <tbody>{KINDS.map((k) => {
            const stored = k === "units" ? counts.units : k === "people" ? counts.people : k === "leaders" ? counts.leaders : counts[k];
            return (
              <tr key={k}>
                <td><strong>{KIND_LABEL[k]}</strong><div className="tbl-actions" style={{ justifyContent: "flex-start", marginTop: 4 }}>
                  <button type="button" className="btn ghost sm" onClick={() => download(`${k}-template.csv`, TEMPLATES[k])}>Template</button>
                  {stored > 0 && (k !== "people" || editor) && <a className="btn ghost sm" href={`${base}/org-graph?format=csv&kind=${k}`}>Download stored</a>}</div></td>
                <td className="small muted">{COLUMNS[k].all.map((c) => (COLUMNS[k].required.includes(c) ? c : `${c} (optional)`)).join(", ")}</td>
                <td>{stored}</td>
                <td>{canEdit ? <>
                  <input type="file" accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" aria-label={`Upload ${KIND_LABEL[k]} file`} onChange={(e) => pick(k, e.target.files?.[0])} />
                  {staged[k] && <div className="small" style={{ marginTop: 4 }}><span className="tag ok">Ready</span> {staged[k]!.name}: {staged[k]!.rows} rows</div>}
                  {(fileErr[k]?.length ?? 0) > 0 && <ul className="small" style={{ margin: "6px 0 0 18px", color: "var(--bad)" }}>{fileErr[k]!.map((m) => <li key={m}>{m}</li>)}</ul>}
                </> : <span className="muted">–</span>}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
        {canEdit && <button className="btn gold sm" style={{ marginTop: 12 }} disabled={busy || Object.keys(staged).length === 0} onClick={save}>{busy ? "Saving…" : `Save ${Object.keys(staged).length || ""} file${Object.keys(staged).length === 1 ? "" : "s"}`}</button>}
      </div>

      {report.length > 0 && (
        <div className="card">
          <div className="sectionhead"><h2>Import report</h2><span className="tag warn">{report.length} rule{report.length === 1 ? "" : "s"} reported</span></div>
          <p className="small muted" style={{ marginBottom: 8 }}>What the file you just saved fails, with the row of each affected line in your file (row 1 is the header).</p>
          <div className="tblwrap"><table className="tbl"><tbody>{report.map((d) => (
            <tr key={d.rule + d.message}><td style={{ width: 80 }}><strong>{d.rule}</strong></td>
              <td>{d.message}<div className="small muted" style={{ marginTop: 4 }}>{d.where.length ? d.where.slice(0, 20).join("; ") + (d.where.length > 20 ? `; and ${d.where.length - 20} more` : "") : d.refs.length ? `Affects: ${d.refs.slice(0, 12).join(", ")}` : ""}</div></td>
              <td style={{ width: 130, textAlign: "right" }}><span className={`tag ${d.blocking ? "bad" : "warn"}`}>{d.blocking ? "Blocks launch" : "Warning"}</span></td></tr>))}</tbody></table></div>
        </div>
      )}

      <div className="card">
        <div className="sectionhead"><h2>Leader mapping</h2></div>
        <p className="muted" style={{ marginBottom: 8 }}>One accountable leader for each team on any date. The end date is inclusive; leave it empty for no end. {noLeader.length > 0 && <b>{noLeader.length} team(s) have no leader on {windowStart}: {noLeader.slice(0, 8).map((t) => t.key).join(", ")}{noLeader.length > 8 ? "…" : ""}.</b>}</p>
        <div className="tblwrap"><table className="tbl">
          <thead><tr><th>Team</th><th>Leader (employee_ref)</th><th>From</th><th>To</th><th /></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{canEdit ? <select aria-label={`Team for row ${i + 1}`} value={r.team_key} onChange={(e) => upd(i, "team_key", e.target.value)}><option value="">Choose…</option>{teams.map((t) => <option key={t.key} value={t.key}>{t.key} · {t.name}</option>)}</select> : r.team_key}</td>
                <td>{canEdit ? <input aria-label={`Leader for row ${i + 1}`} value={r.employee_ref} onChange={(e) => upd(i, "employee_ref", e.target.value)} /> : r.employee_ref}</td>
                <td>{canEdit ? <input type="date" aria-label={`From for row ${i + 1}`} value={r.effect_from} onChange={(e) => upd(i, "effect_from", e.target.value)} /> : r.effect_from}</td>
                <td>{canEdit ? <input type="date" aria-label={`To for row ${i + 1}`} value={r.effect_to ?? ""} onChange={(e) => upd(i, "effect_to", e.target.value)} /> : (r.effect_to ?? "open")}</td>
                <td>{canEdit && <button type="button" className="btn ghost sm" aria-label={`Remove row ${i + 1}`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</button>}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="muted">No leader assignments yet.</td></tr>}
          </tbody>
        </table></div>
        {canEdit && <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button type="button" className="btn ghost sm" onClick={() => setRows((rs) => [...rs, { employee_ref: "", team_key: "", effect_from: windowStart, effect_to: null }])}>Add an assignment</button>
          <button type="button" className="btn gold sm" disabled={busy} onClick={() => call(() => api("PUT", `${base}/leaders`, { leaders: rows }), "Leader mapping saved.")}>Save leader mapping</button></div>}
      </div>

      {chains.length > 0 && (
        <div className="card">
          <div className="sectionhead"><h2>Reporting chains</h2></div>
          <p className="small muted" style={{ marginBottom: 8 }}>A leader reports to whoever leads the team they sit in. A leader who sits in their own team has no one above them here.</p>
          <div className="tblwrap"><table className="tbl">
            <thead><tr><th>Team</th><th>Chain</th><th>Led headcount</th></tr></thead>
            <tbody>{chains.slice(0, 200).map((c) => (
              <tr key={c.team_key + c.leader}><td>{c.team_key}</td>
                <td>{c.chain.join(" → ")}{c.cycle && <span className="tag bad" style={{ marginLeft: 8 }}>Cycle</span>}</td>
                <td>{scope.find((s) => s.team_key === c.team_key)?.headcount_led ?? 0}</td></tr>))}</tbody>
          </table></div>
          {chains.length > 200 && <p className="small muted">Showing 200 of {chains.length}.</p>}
        </div>
      )}
    </>
  );
}
