"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTION_TITLES, type Json } from "@/lib/setup-sections";
import { SECTORS } from "@/lib/tenant-fields";
import SectionForm, { type SaveResult } from "../section-form";
import { api } from "@/lib/api";

interface FieldCompare { key: string; label: string; executive: unknown; hr: unknown; agreed: unknown; kind: "tags" | "text"; diverges: boolean; share?: number; positions?: number[]; consultant_flag?: boolean }
interface Comparison { section: string; executive_status: string | null; hr_status: string | null; agreed_status: string | null; both_captured: boolean; fields: FieldCompare[]; findings: { field: string }[] }
interface Tenant { name: string; sector: string | null; headcount: number | null; geographies: string[] }

const human = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function Value({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") return <span className="muted">Not entered</span>;
  if (Array.isArray(v)) return <ul style={{ margin: 0, paddingLeft: 18 }}>{v.map((x, i) => <li key={i}>{typeof x === "object" && x ? `${(x as Json).text ?? ""}${(x as Json).orientation ? ` (${human(String((x as Json).orientation))})` : ""}` : String(x)}</li>)}</ul>;
  return <span>{typeof v === "string" && /^[A-Z_]+$/.test(v) ? human(v) : String(v)}</span>;
}

export default function PerspectivesClient({ engagementId, role, locked, comparisons, tenant }: { engagementId: string; role: string; locked: boolean; comparisons: Comparison[]; tenant: Tenant }) {
  const router = useRouter();
  const [section, setSection] = useState(comparisons[0].section);
  const [editing, setEditing] = useState<"EXECUTIVE" | "HR" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const cmp = comparisons.find((c) => c.section === section)!;
  const canWrite = !locked && (role === "PAC_CONSULTANT" || role === "CLIENT_ADMIN");
  const initial = (p: "EXECUTIVE" | "HR"): Json => Object.fromEntries(cmp.fields.map((f) => [f.key, p === "EXECUTIVE" ? f.executive : f.hr]).filter(([, v]) => v !== null && v !== undefined));

  async function call(fn: () => Promise<Response>, msg: string) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn(); const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(Array.isArray(j?.errors) ? (j.errors as string[]).slice(0, 3).join("; ") : j?.title ?? "That did not work."); return null; }
    setOk(msg); router.refresh(); return j;
  }
  async function savePerspective(body: { payload: Json }): Promise<SaveResult | null> {
    const j = await call(() => api("PUT", `/v1/engagements/${engagementId}/setup/${section}/perspectives/${editing}`, { payload: body.payload }), `${editing === "HR" ? "HR" : "Executive"} entry for Section ${section} saved as a draft.`);
    return j ? { warnings: [], missing: j.missing ?? [], reopened: [] } : null;
  }
  const flag = (key: string, v: boolean) => call(() => api("PUT", `/v1/engagements/${engagementId}/setup/${section}/comparison`, { flags: { [key]: v } }), "Flag saved.");
  const form = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); return new FormData(e.currentTarget); };

  return (
    <>
      {ok && <div className="note blue" role="status"><b>{ok}</b></div>}
      {err && <div className="note" role="alert"><b>{err}</b></div>}

      <div className="card">
        <div className="sectionhead"><h2>Compare Executive and HR entries</h2></div>
        <div className="tbl-actions" role="tablist" style={{ marginBottom: 10 }}>
          {comparisons.map((c) => (
            <button key={c.section} role="tab" aria-selected={c.section === section} className={`btn sm ${c.section === section ? "gold" : "ghost"}`} onClick={() => { setSection(c.section); setEditing(null); }}>
              {c.section} {SECTION_TITLES[c.section]}</button>))}
        </div>
        <p className="small muted">Sections B, C and D are agreed first. Then the executive team and senior HR each enter Section {section} on their own. Only the agreed record feeds the rules.</p>
        <div className="tbl-actions" style={{ margin: "8px 0" }}>
          <span className={`tag ${cmp.executive_status ? "ok" : "grey"}`}>Executive: {cmp.executive_status ? "entered" : "not entered"}</span>
          <span className={`tag ${cmp.hr_status ? "ok" : "grey"}`}>HR: {cmp.hr_status ? "entered" : "not entered"}</span>
          <span className={`tag ${cmp.agreed_status === "AGREED" ? "ok" : "warn"}`}>Agreed record: {cmp.agreed_status ? human(cmp.agreed_status) : "not started"}</span>
          {cmp.findings.length > 0 && <span className="tag bad">{cmp.findings.length} difference{cmp.findings.length === 1 ? "" : "s"} flagged</span>}
          {canWrite && <><button className="btn ghost sm" onClick={() => setEditing(editing === "EXECUTIVE" ? null : "EXECUTIVE")}>{editing === "EXECUTIVE" ? "Close" : "Executive entry"}</button>
            <button className="btn ghost sm" onClick={() => setEditing(editing === "HR" ? null : "HR")}>{editing === "HR" ? "Close" : "HR entry"}</button></>}
        </div>
        {editing && (
          <SectionForm key={`${section}-${editing}`} section={section} perspective initial={initial(editing)} workshopDate={null} participants={[]} kpis={[]} tenant={tenant} busy={busy}
            onSave={savePerspective} onCancel={() => setEditing(null)} />
        )}
        <div className="tblwrap"><table className="tbl">
          <thead><tr><th>Field</th><th>Executive</th><th>HR</th><th>Agreed</th><th>Difference</th></tr></thead>
          <tbody>{cmp.fields.map((f) => (
            <tr key={f.key}>
              <td><strong>{f.label}</strong></td>
              <td><Value v={f.executive} /></td><td><Value v={f.hr} /></td><td><Value v={f.agreed} /></td>
              <td>{f.kind === "tags"
                ? (cmp.both_captured ? <span className={`tag ${f.diverges ? "bad" : "ok"}`}>{f.diverges ? `${Math.round((f.share ?? 0) * 100)}% tagged differently (behaviours ${f.positions?.join(", ")})` : "Same tags"}</span> : <span className="muted">Needs both entries</span>)
                : role === "PAC_CONSULTANT" && !locked
                  ? <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={f.consultant_flag === true} disabled={busy || !cmp.both_captured} onChange={(e) => flag(f.key, e.target.checked)} />Differs</label>
                  : cmp.both_captured ? <span className={`tag ${f.diverges ? "bad" : "grey"}`}>{f.diverges ? "Differs" : "Not flagged"}</span> : <span className="muted">Needs both entries</span>}</td>
            </tr>))}</tbody>
        </table></div>
        <p className="small muted" style={{ marginTop: 8 }}>Tags on F1 are compared by the rules engine. For text fields the consultant reads both entries and flags whether they differ. Each flag is reported as a setup divergence finding.</p>
      </div>

      {role === "CLIENT_ADMIN" && (
        <div className="card">
          <div className="sectionhead"><h2>A1 to A4 Organisation details</h2></div>
          <p className="muted">These come from the organisation record. The Client Admin keeps them up to date.</p>
          <form className="addbox" key={tenant.name + tenant.headcount} onSubmit={(e) => { const f = form(e); call(() => api("PUT", `/v1/engagements/${engagementId}/organisation`, {
            name: f.get("name"), sector: f.get("sector"), headcount: Number(f.get("headcount")), geographies: String(f.get("geo") ?? "").split(",").map((x) => x.trim()).filter(Boolean) }), "Organisation details saved."); }}>
            <div className="formgrid">
              <div className="field"><label className="flab" htmlFor="a-name">A1 Organisation name</label><input id="a-name" name="name" defaultValue={tenant.name} maxLength={200} required disabled={locked} /></div>
              <div className="field"><label className="flab" htmlFor="a-sector">A2 Sector</label>
                <select id="a-sector" name="sector" defaultValue={tenant.sector ?? ""} disabled={locked}>{SECTORS.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
              <div className="field"><label className="flab" htmlFor="a-hc">A3 Headcount</label><input id="a-hc" name="headcount" type="number" min={1} defaultValue={tenant.headcount ?? ""} required disabled={locked} /></div>
              <div className="field"><label className="flab" htmlFor="a-geo">A4 Geography (country codes, comma separated)</label><input id="a-geo" name="geo" defaultValue={tenant.geographies.join(", ")} required disabled={locked} /></div>
            </div>
            {!locked && <button className="btn gold sm" style={{ marginTop: 12 }} disabled={busy}>Save</button>}
          </form>
        </div>
      )}
    </>
  );
}
