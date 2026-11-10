"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REGIMES, REGIME_LABEL, RESIDENCY, SECTORS } from "@/lib/tenant-fields";
import { SERVICES, SERVICE_LABEL, type Service } from "@/lib/services-list";
import { api } from "@/lib/api";

export interface Org {
  tenant_id: string; name: string; legal_name: string | null; sector: string | null; headcount: number | null; geographies: string[];
  privacy_regime: string; residency_region: string; timezone: string; cover_colour?: string | null; services?: string[]; engagements: { engagement_id: string; cycle_no: number; state: string }[];
}
const human = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function regimeParts(r: string) { return r.startsWith("OTHER:") ? { regime: "OTHER", name: r.slice(6) } : { regime: r, name: "" }; }

function OrgForm({ org, locked, busy, onSubmit, onCancel }: { org?: Org; locked: boolean; busy: boolean; onSubmit: (b: Record<string, unknown>) => void; onCancel?: () => void }) {
  const rp = regimeParts(org?.privacy_regime ?? "KE_DPA_2019");
  const [regime, setRegime] = useState(rp.regime);
  const id = org?.tenant_id ?? "new";
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSubmit({
      name: f.get("name"), legal_name: f.get("legal"), sector: f.get("sector"), headcount: Number(f.get("headcount")),
      geographies: String(f.get("geo")).split(/[\s,]+/).filter(Boolean), privacy_regime: f.get("regime"), regime_name: f.get("regime_name") ?? "",
      residency_region: f.get("residency"), timezone: f.get("tz"), cover_colour: String(f.get("cover") ?? ""),
    });
  }
  return (
    <form className="addbox" onSubmit={submit}>
      <div className="formgrid">
        <div className="field"><label className="flab" htmlFor={`${id}-n`}>Name</label><input id={`${id}-n`} name="name" required maxLength={200} defaultValue={org?.name} /></div>
        <div className="field"><label className="flab" htmlFor={`${id}-l`}>Legal name (used in the consent text and reports)</label><input id={`${id}-l`} name="legal" maxLength={200} defaultValue={org?.legal_name ?? ""} placeholder="Same as the name if blank" /></div>
        <div className="field"><label className="flab" htmlFor={`${id}-s`}>Sector</label>
          <select id={`${id}-s`} name="sector" required defaultValue={org?.sector && (SECTORS as readonly string[]).includes(org.sector) ? org.sector : ""}><option value="">Choose…</option>{SECTORS.map((s) => <option key={s} value={s}>{human(s)}</option>)}</select></div>
        <div className="field"><label className="flab" htmlFor={`${id}-h`}>Headcount</label><input id={`${id}-h`} name="headcount" type="number" min={1} max={1000000} required defaultValue={org?.headcount ?? ""} /></div>
        <div className="field"><label className="flab" htmlFor={`${id}-g`}>Countries (two-letter codes, comma separated)</label><input id={`${id}-g`} name="geo" required defaultValue={org?.geographies.join(", ") ?? "KE"} placeholder="KE, UG" /></div>
        <div className="field"><label className="flab" htmlFor={`${id}-t`}>Time zone</label><input id={`${id}-t`} name="tz" required defaultValue={org?.timezone ?? "Africa/Nairobi"} /></div>
        <div className="field"><label className="flab" htmlFor={`${id}-cc`}>Client cover colour (hex, for the report cover)</label><input id={`${id}-cc`} name="cover" maxLength={7} pattern="#[0-9A-Fa-f]{6}" placeholder="#1F7A5C" defaultValue={org?.cover_colour ?? ""} /></div>
        <div className="field"><label className="flab" htmlFor={`${id}-p`}>Privacy regime</label>
          <select id={`${id}-p`} name="regime" value={regime} disabled={locked} onChange={(e) => setRegime(e.target.value)}>{REGIMES.map((r) => <option key={r} value={r}>{REGIME_LABEL[r]}</option>)}</select>
          {locked && <input type="hidden" name="regime" value={regime} />}</div>
        {regime === "OTHER" && <div className="field"><label className="flab" htmlFor={`${id}-pn`}>Name of the regime</label><input id={`${id}-pn`} name="regime_name" required maxLength={100} defaultValue={rp.name} disabled={locked} />
          {locked && <input type="hidden" name="regime_name" value={rp.name} />}</div>}
        <div className="field"><label className="flab" htmlFor={`${id}-r`}>Hosting region</label>
          <select id={`${id}-r`} name="residency" disabled={locked} defaultValue={org?.residency_region ?? RESIDENCY[0]}>{RESIDENCY.map((r) => <option key={r} value={r}>{r}</option>)}</select>
          {locked && <input type="hidden" name="residency" value={org?.residency_region} />}</div>
      </div>
      {locked && <p className="small muted" style={{ marginTop: 6 }}>Privacy regime and hosting region are fixed because an engagement has launched.</p>}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn gold sm" disabled={busy}>{busy ? "Working…" : org ? "Save changes" : "Create organisation"}</button>
        {onCancel && <button type="button" className="btn ghost sm" onClick={onCancel}>Close</button>}
      </div>
    </form>
  );
}

export default function OrgClient({ orgs }: { orgs: Org[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [edit, setEdit] = useState("");

  async function run(fn: () => Promise<Response>, msg: string, done?: () => void) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn();
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j?.title ?? "That did not work.");
    setOk(msg); done?.(); router.refresh();
  }

  return (
    <>
      {ok && <div className="note blue" role="status"><b>{ok}</b></div>}
      {err && <div className="note" role="alert"><b>{err}</b></div>}
      <div className="card">
        <div className="sectionhead"><h2>Add an organisation</h2></div>
        <p className="muted" style={{ marginBottom: 8 }}>Then add its first Client Admin on the <a href="/users">Users</a> screen and create an engagement below.</p>
        <OrgForm key={orgs.length} locked={false} busy={busy} onSubmit={(b) => run(() => api("POST", "/v1/tenants", b), "Organisation created.")} />
      </div>
      {orgs.map((o) => {
        const launched = o.engagements.some((e) => e.state !== "SETUP");
        return (
          <section key={o.tenant_id} className="card">
            <div className="sectionhead">
              <h2>{o.name} <span className="small muted" style={{ fontWeight: 400 }}>· {o.headcount ?? "?"} staff · {o.geographies.join(", ")}</span></h2>
              <div className="tbl-actions">
                <button className="btn ghost sm" onClick={() => setEdit(edit === o.tenant_id ? "" : o.tenant_id)}>{edit === o.tenant_id ? "Close" : "Edit details"}</button>
                <button className="btn gold sm" disabled={busy} onClick={() => run(() => api("POST", `/v1/tenants/${o.tenant_id}/engagements`), `Engagement created for ${o.name}. Assign a PAC Consultant on the Users screen.`)}>New engagement</button>
              </div>
            </div>
            <p className="small muted">{o.sector ? human(o.sector) : "No sector"} · {REGIME_LABEL[regimeParts(o.privacy_regime).regime] ?? o.privacy_regime}{regimeParts(o.privacy_regime).name ? ` (${regimeParts(o.privacy_regime).name})` : ""} · hosted in {o.residency_region}</p>
            <Services org={o} busy={busy} onSave={(services) => run(() => api("PUT", `/v1/tenants/${o.tenant_id}/services`, { services }), "Services saved.")} />
            {edit === o.tenant_id && <OrgForm org={o} locked={launched} busy={busy} onCancel={() => setEdit("")} onSubmit={(b) => run(() => api("PATCH", `/v1/tenants/${o.tenant_id}`, b), "Details saved.", () => setEdit(""))} />}
            {o.engagements.length === 0 ? <p className="muted">No engagements yet.</p> : (
              <div className="tblwrap"><table className="tbl">
                <thead><tr><th>Cycle</th><th>State</th></tr></thead>
                <tbody>{o.engagements.map((e) => <tr key={e.engagement_id}><td><strong>Cycle {e.cycle_no}</strong> <span className="small muted">{e.engagement_id}</span></td><td><span className="tag grey">{human(e.state)}</span></td></tr>)}</tbody>
              </table></div>
            )}
          </section>
        );
      })}
    </>
  );
}

// The parts of the platform a client has paid for or selected (owner ruling 22 Oct 2026, Erick Ngala comment 40). A new client starts with none.
function Services({ org, busy, onSave }: { org: Org; busy: boolean; onSave: (s: Service[]) => void }) {
  const [on, setOn] = useState<Service[]>((org.services ?? []) as Service[]);
  const changed = on.slice().sort().join() !== (org.services ?? []).slice().sort().join();
  return (
    <fieldset style={{ border: "1px solid var(--line, #ddd)", borderRadius: 8, padding: "8px 12px", margin: "8px 0" }}>
      <legend className="small"><b>Services this client has</b></legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
        {SERVICES.map((k) => (
          <label key={k} className="small" title={SERVICE_LABEL[k].what}>
            <input type="checkbox" checked={on.includes(k)} onChange={(e) => setOn(e.target.checked ? [...on, k] : on.filter((x) => x !== k))} /> {SERVICE_LABEL[k].name}
          </label>
        ))}
      </div>
      {changed && <button className="btn gold sm" style={{ marginTop: 8 }} disabled={busy} onClick={() => onSave(on)}>Save services</button>}
    </fieldset>
  );
}
