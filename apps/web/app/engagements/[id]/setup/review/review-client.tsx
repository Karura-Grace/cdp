"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTION_TITLES, type Json } from "@/lib/setup-sections";
import SectionForm, { type SaveResult } from "../section-form";
import { api } from "@/lib/api";

interface Agreed { section: string; status: string; payload: unknown; workshop_date: string | null; facilitator: string | null }
interface Tick { section: string; user_id: string; confirmed_at: string }
interface Tenant { name: string; sector: string | null; headcount: number | null; geographies: string[] }

const human = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function Show({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") return <span className="muted">Not entered</span>;
  if (Array.isArray(v)) return <ul style={{ margin: 0, paddingLeft: 18 }}>{v.map((x, i) => <li key={i}>{typeof x === "object" && x ? Object.entries(x as Json).filter(([k]) => k !== "ref" && k !== "id").map(([k, y]) => `${human(k)}: ${typeof y === "string" ? y : JSON.stringify(y)}`).join(", ") : String(x)}</li>)}</ul>;
  if (typeof v === "boolean") return <span>{v ? "Yes" : "No"}</span>;
  return <span>{typeof v === "string" && /^[A-Z_]+$/.test(v) ? human(v) : String(v)}</span>;
}

export default function ReviewClient({ engagementId, role, locked, me, agreed, drafts, ticks, tenant }: {
  engagementId: string; role: string; locked: boolean; me: string; agreed: Agreed[]; drafts: Record<string, { status: string; payload: unknown }>; ticks: Tick[]; tenant: Tenant;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [editing, setEditing] = useState("");
  const by = new Map(agreed.map((a) => [a.section, a]));
  const canDraft = !locked && (role === "CLIENT_ADMIN" || role === "PAC_CONSULTANT");

  async function call(fn: () => Promise<Response>, msg: string) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn(); const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(Array.isArray(j?.errors) ? (j.errors as string[]).slice(0, 3).join("; ") : j?.title ?? "That did not work."); return null; }
    setOk(msg); router.refresh(); return j;
  }
  async function saveDraft(body: { payload: Json }): Promise<SaveResult | null> {
    const j = await call(() => api("PUT", `/v1/engagements/${engagementId}/setup/${editing}/perspectives/EXECUTIVE`, { payload: body.payload }), `Draft of Section ${editing} saved.`);
    return j ? { warnings: [], missing: j.missing ?? [], reopened: [] } : null;
  }
  const kpisOf = (): Json[] => ((((by.get("C")?.payload ?? drafts.C?.payload) as Json | undefined)?.kpis as Json[] | undefined) ?? []);

  return (
    <>
      {ok && <div className="note blue" role="status"><b>{ok}</b></div>}
      {err && <div className="note" role="alert"><b>{err}</b></div>}

      {canDraft && (
        <div className="card">
          <div className="sectionhead"><h2>Draft Sections A to D</h2></div>
          <p className="muted">Draft what you know for Sections A to D. A draft is not the record: the consultant agrees each section at the workshop, starting from your draft.</p>
          <div className="tbl-actions" style={{ margin: "8px 0" }}>
            {["A", "B", "C", "D"].map((s) => (
              <button key={s} className={`btn sm ${editing === s ? "gold" : "ghost"}`} onClick={() => setEditing(editing === s ? "" : s)}>{s} {SECTION_TITLES[s]}{drafts[s] ? " (drafted)" : ""}</button>))}
          </div>
          {editing && <SectionForm key={editing} section={editing} perspective initial={(drafts[editing]?.payload as Json | undefined) ?? null} workshopDate={null} participants={[]} kpis={kpisOf()} tenant={tenant} busy={busy} onSave={saveDraft} onCancel={() => setEditing("")} />}
        </div>
      )}

      <div className="card">
        <div className="sectionhead"><h2>Agreed sections</h2></div>
        <p className="muted">Read only. {role === "EXECUTIVE" ? "Tick a section to confirm that it states what the executive team agreed. A tick is recorded with your name and the time, and is cleared if the section changes." : "These are the records the consultant has agreed."}</p>
        <div className="tblwrap"><table className="tbl"><tbody>
          {Object.keys(SECTION_TITLES).map((s) => {
            const a = by.get(s); const t = ticks.filter((x) => x.section === s); const mine = t.some((x) => x.user_id === me);
            return (
              <tr key={s}>
                <td style={{ width: 220 }}><strong>{s}</strong> <span className="muted">{SECTION_TITLES[s]}</span>
                  <div className="small muted">{a ? `${a.status === "LOCKED" ? "Locked" : a.status === "AGREED" ? "Agreed" : "Draft"}${a.workshop_date ? ` · workshop ${a.workshop_date}` : ""}` : "Not started"}</div></td>
                <td>{a && a.status !== "DRAFT"
                  ? <details><summary className="small" style={{ cursor: "pointer" }}>View</summary>
                      <dl style={{ margin: "6px 0" }}>{Object.entries((a.payload as Json) ?? {}).filter(([k]) => !["f1_tags", "f1_overrides"].includes(k)).map(([k, v]) => <div key={k} style={{ margin: "4px 0" }}><dt className="small muted">{human(k)}</dt><dd style={{ margin: 0 }}><Show v={v} /></dd></div>)}</dl></details>
                  : <span className="muted">Not yet agreed</span>}</td>
                <td style={{ width: 230, textAlign: "right" }}>
                  {t.length > 0 && <span className="tag ok">Confirmed by {t.length}</span>}{" "}
                  {role === "EXECUTIVE" && !locked && a?.status === "AGREED" && (mine ? <span className="tag ok">You confirmed</span>
                    : <button className="btn gold sm" disabled={busy} onClick={() => call(() => api("POST", `/v1/engagements/${engagementId}/setup/${s}/confirm`), `Section ${s} confirmed.`)}>Confirm</button>)}
                </td>
              </tr>);
          })}
        </tbody></table></div>
      </div>
    </>
  );
}
