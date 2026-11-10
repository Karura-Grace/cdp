"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTORS } from "@/lib/tenant-fields";
import { api } from "@/lib/api";

export interface Row { tenant_id: string; name: string; sector: string | null; headcount: number | null; geographies: string[]; state: string | null; editable: boolean }
const human = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function RowForm({ r, busy, onSave }: { r: Row; busy: boolean; onSave: (b: Record<string, unknown>) => void }) {
  const id = r.tenant_id;
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave({ name: f.get("name"), sector: f.get("sector"), headcount: Number(f.get("headcount")), geographies: String(f.get("geo")).split(/[\s,]+/).filter(Boolean) });
  }
  return (
    <tr>
      <td colSpan={5}>
        <form className="addbox" onSubmit={submit}>
          <div className="formgrid">
            <div className="field"><label className="flab" htmlFor={`${id}-n`}>A1 Name</label><input id={`${id}-n`} name="name" required maxLength={200} defaultValue={r.name} /></div>
            <div className="field"><label className="flab" htmlFor={`${id}-s`}>A2 Sector</label>
              <select id={`${id}-s`} name="sector" required defaultValue={r.sector && (SECTORS as readonly string[]).includes(r.sector) ? r.sector : ""}><option value="">Choose…</option>{SECTORS.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
            <div className="field"><label className="flab" htmlFor={`${id}-h`}>A3 Headcount</label><input id={`${id}-h`} name="headcount" type="number" min={1} max={1000000} required defaultValue={r.headcount ?? ""} /></div>
            <div className="field"><label className="flab" htmlFor={`${id}-g`}>A4 Countries (two-letter codes, comma separated)</label><input id={`${id}-g`} name="geo" required defaultValue={r.geographies.join(", ")} placeholder="KE, UG" /></div>
          </div>
          <div style={{ marginTop: 12 }}><button className="btn gold sm" disabled={busy}>{busy ? "Working…" : "Save A1 to A4"}</button></div>
        </form>
      </td>
    </tr>
  );
}

export default function SectionAClient({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [edit, setEdit] = useState("");

  async function save(r: Row, b: Record<string, unknown>) {
    setBusy(true); setErr(""); setOk("");
    const res = await api("PUT", `/v1/tenants/${r.tenant_id}/section-a`, b);
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(j?.title ?? "That did not work.");
    setOk(`Section A saved for ${b.name}.`); setEdit(""); router.refresh();
  }

  return (
    <>
      {ok && <div className="note blue" role="status"><b>{ok}</b></div>}
      {err && <div className="note" role="alert"><b>{err}</b></div>}
      <div className="card">
        <p className="muted" style={{ marginBottom: 8 }}>A client&rsquo;s Section A is locked once its latest engagement has launched. Other details stay on the <a href="/organisations">Organisations</a> screen.</p>
        <div className="tblwrap"><table className="tbl">
          <thead><tr><th>A1 Name</th><th>A2 Sector</th><th>A3 Headcount</th><th>A4 Countries</th><th /></tr></thead>
          <tbody>{rows.map((r) => [
            <tr key={r.tenant_id}>
              <td><strong>{r.name}</strong></td>
              <td>{r.sector ? human(r.sector) : <span className="muted">Not set</span>}</td>
              <td>{r.headcount ?? <span className="muted">Not set</span>}</td>
              <td>{r.geographies.join(", ") || <span className="muted">Not set</span>}</td>
              <td className="tbl-actions">{r.editable
                ? <button className="btn ghost sm" onClick={() => setEdit(edit === r.tenant_id ? "" : r.tenant_id)} aria-expanded={edit === r.tenant_id}>{edit === r.tenant_id ? "Close" : "Edit"}</button>
                : <span className="tag grey">Locked ({human(r.state ?? "")})</span>}</td>
            </tr>,
            edit === r.tenant_id && <RowForm key={`${r.tenant_id}-f`} r={r} busy={busy} onSave={(b) => save(r, b)} />,
          ])}</tbody>
        </table></div>
      </div>
    </>
  );
}
