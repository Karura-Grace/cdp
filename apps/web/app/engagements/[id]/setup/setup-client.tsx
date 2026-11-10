"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SECTION_TITLES, type Json } from "@/lib/setup-sections";
import { c4Default } from "@/lib/c4-defaults";
import LaunchExtras from "./launch-extras";
import ConsentDraftNote from "./consent-draft-note";
import SectionForm, { type ExecPerson, type Facilitator, type SaveResult } from "./section-form";
import { api } from "@/lib/api";

type Link = { name: string | null; email: string | null; token: string };
interface Asm { assessment_id: string; status: string; window_open: string | null; window_close: string | null }
interface Section { section: string; status: string; payload_json: unknown; workshop_date: string | null; participants: string[]; facilitator: string | null; facilitator_user_id: string | null; locked_at: string | null }
interface Consent { version: number; title: string; body: string; status: string }
interface Check { id: string; check: string; pass: boolean; blocking: boolean }
interface Preflight { pass: boolean; checks: Check[]; not_assessed: string[] }

const today = () => new Date().toISOString().slice(0, 10);

export default function SetupClient({ engagementId, state, tenant, asm, sections, consent, transfer, preflight, execPeople, facilitators, drafts, confirmations }: {
  engagementId: string; execPeople: ExecPerson[]; facilitators: Facilitator[]; drafts: Record<string, Json>; confirmations: Record<string, number>; state: string; tenant: { name: string; sector: string | null; headcount: number | null; geographies: string[] }; asm: Asm | null; sections: Section[]; consent: Consent | null; transfer: string | null; preflight: Preflight | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [links, setLinks] = useState<(Link & { url: string })[]>([]);
  const [open, setOpen] = useState("");
  const [useDraft, setUseDraft] = useState(false);
  const locked = asm?.status !== "DRAFT";

  async function run(fn: () => Promise<Response>, msg: string, after?: (j: Record<string, unknown>) => void) {
    setBusy(true); setErr(""); setOk("");
    const r = await fn();
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      const failed = Array.isArray(j?.checks) ? ` Failing: ${(j.checks as Check[]).map((c) => c.id).join(", ")}.` : "";
      return setErr((j?.title ?? "That did not work.") + failed);
    }
    setOk(msg); after?.(j); router.refresh();
  }
  const form = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); return new FormData(e.currentTarget); };

  const createAsm = (e: React.FormEvent<HTMLFormElement>) => {
    const f = form(e);
    run(() => api("POST", `/v1/engagements/${engagementId}/assessments`, { window_open: f.get("open"), window_close: f.get("close") }), "Assessment created.");
  };
  async function saveSection(s: string, body: { payload: Json; workshop_date: string | null; participants: string[]; facilitator_user_id: string | null }): Promise<SaveResult | null> {
    setBusy(true); setErr(""); setOk("");
    const r = await api("PUT", `/v1/engagements/${engagementId}/setup/${s}`, body);
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setErr(Array.isArray(j?.errors) ? `Section ${s} was not saved: ${(j.errors as string[]).slice(0, 3).join("; ")}` : j?.title ?? "That did not work."); return null; }
    setOk(`Section ${s} saved as a draft.`); router.refresh();
    return { warnings: j.warnings ?? [], missing: j.missing ?? [], reopened: j.reopened ?? [] };
  }

  if (!asm) {
    return (
      <>
        {err && <div className="note" role="alert"><b>{err}</b></div>}
        <div className="card">
          <div className="sectionhead"><h2>Create the assessment</h2></div>
          <p className="muted" style={{ marginBottom: 10 }}>Sets the survey window and drafts the consent text from the privacy-regime template. The window must cover at least 10 working days; the launch checks enforce it.</p>
          <form className="addbox" onSubmit={createAsm}>
            <div className="formgrid">
              <div className="field"><label className="flab" htmlFor="w-open">Window opens</label><input id="w-open" name="open" type="date" required defaultValue={today()} /></div>
              <div className="field"><label className="flab" htmlFor="w-close">Window closes</label><input id="w-close" name="close" type="date" required /></div>
            </div>
            <button className="btn gold sm" style={{ marginTop: 12 }} disabled={busy || state !== "SETUP"}>{busy ? "Working…" : "Create assessment"}</button>
          </form>
        </div>
      </>
    );
  }
  const A = asm.assessment_id;
  const by = new Map(sections.map((s) => [s.section, s]));
  // B6 starts from the draft C4 table (sector and A5 maturity) when it has no business model yet; the consultant can change it
  const prefill = (sec: string, p: Json | null): Json | null => {
    if (sec !== "B" || p?.business_model) return p;
    const m = c4Default(tenant.sector, (by.get("A")?.payload_json as Json | undefined)?.maturity);
    return m ? { ...(p ?? {}), business_model: m } : p;
  };

  return (
    <>
      {ok && <div className="note blue" role="status"><b>{ok}</b></div>}
      {err && <div className="note" role="alert"><b>{err}</b></div>}

      <div className="card">
        <div className="sectionhead"><h2>Launch checks</h2>
          <span className={`tag ${locked ? "ok" : preflight?.pass ? "ok" : "warn"}`}>{locked ? "Launched" : preflight?.pass ? "Ready to launch" : "Not ready"}</span></div>
        {preflight && (
          <>
            <div className="tblwrap"><table className="tbl"><tbody>
              {preflight.checks.map((c) => {
                const na = preflight.not_assessed.includes(c.id);
                return (
                  <tr key={c.id}>
                    <td style={{ width: 46 }}><strong>{c.id}</strong></td>
                    <td>{c.check}</td>
                    <td style={{ width: 150, textAlign: "right" }}>{na ? <span className="tag grey">Not assessed</span> : c.pass ? <span className="tag ok">Pass</span> : <span className={`tag ${c.blocking ? "bad" : "warn"}`}>{c.blocking ? "Blocks launch" : "Warning"}</span>}</td>
                  </tr>
                );
              })}
            </tbody></table></div>
            {preflight.not_assessed.length > 0 && <p className="small muted" style={{ marginTop: 8 }}>Not assessed: no invitation list tied to people and no leadership 360 exist yet, so L{preflight.not_assessed.map((x) => x.slice(1)).join(", L")} cannot fail.</p>}
            <div className="addbox" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn gold" disabled={busy || !preflight.pass}
                onClick={() => confirm("Launch? Setup is locked, and the survey window, consent text and versions are fixed from now on.") && run(() => api("POST", `/v1/assessments/${A}/launch`), "Launched. The engagement is now fielding.")}>
                {busy ? "Working…" : "Launch assessment"}</button>
              <span className="small muted">Window {asm.window_open?.slice(0, 10)} to {asm.window_close?.slice(0, 10)}. Launch cannot be undone.</span>
            </div>
          </>
        )}
        {locked && <p className="muted">Launched. Setup, window and consent text are locked. Issue survey links below.</p>}
      </div>

      <LaunchExtras engagementId={engagementId} assessmentId={A} state={state} locked={locked} />

      <div className="card">
        <div className="sectionhead"><h2>Setup sections</h2><div className="tbl-actions"><a className="btn ghost sm" href={`/engagements/${engagementId}/setup/perspectives`}>Executive and HR entries</a><a className="btn ghost sm" href={`/engagements/${engagementId}/org`}>Organisation and leaders</a></div></div>
        <div className="tblwrap"><table className="tbl">
          <thead><tr><th>Section</th><th>Status</th><th>Workshop</th><th style={{ textAlign: "right" }} /></tr></thead>
          <tbody>
            {Object.keys(SECTION_TITLES).map((s) => {
              const r = by.get(s);
              return (
                <tr key={s}>
                  <td><strong>{s}</strong> <span className="muted">{SECTION_TITLES[s]}</span></td>
                  <td>{!r ? <span className="tag grey">Not started</span> : r.locked_at ? <span className="tag ok">Locked</span> : r.status === "AGREED" ? <span className="tag ok">Agreed</span> : <span className="tag warn">Draft</span>}
                    {drafts[s] && <> <span className="tag grey">Client draft</span></>}
                    {r?.status === "AGREED" && <> <span className={`tag ${confirmations[s] ? "ok" : "grey"}`}>{confirmations[s] ? `Confirmed by ${confirmations[s]} executive${confirmations[s] === 1 ? "" : "s"}` : "Not yet confirmed"}</span></>}</td>
                  <td className="muted">{r?.workshop_date ? `${r.workshop_date} · ${r.participants.length} present${r.facilitator ? ` · facilitated by ${r.facilitator}` : ""}` : "–"}</td>
                  <td><div className="tbl-actions">
                    {!locked && <button className="btn ghost sm" onClick={() => { setUseDraft(false); setOpen(open === s ? "" : s); }}>{open === s ? "Close" : "Edit"}</button>}
                    {!locked && r?.status === "DRAFT" && <button className="btn gold sm" disabled={busy} onClick={() => run(() => api("POST", `/v1/engagements/${engagementId}/setup/${s}/agree`), `Section ${s} agreed.`)}>Agree</button>}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
        {open && (
          <>
          {drafts[open] && <div className="note blue" style={{ marginBottom: 8 }}><b>The Client Admin has drafted Section {open}.</b>{" "}
            {by.get(open) && !useDraft ? <button className="btn ghost sm" onClick={() => setUseDraft(true)}>Start from the client draft instead</button> : !by.get(open) ? <span className="small">The form below starts from it. Saving makes it the agreed record draft.</span> : <span className="small">Loaded into the form. Saving replaces the record draft.</span>}</div>}
          <SectionForm key={open + useDraft} section={open} initial={prefill(open, (useDraft || !by.get(open) ? drafts[open] : undefined) ?? (by.get(open)?.payload_json as Json | undefined) ?? null)} workshopDate={by.get(open)?.workshop_date ?? null}
            participants={by.get(open)?.participants ?? []} facilitatorUserId={by.get(open)?.facilitator_user_id ?? null} facilitators={facilitators} execPeople={execPeople} kpis={(((by.get("C")?.payload_json as Json | undefined)?.kpis as Json[] | undefined) ?? [])} tenant={tenant}
            busy={busy} onSave={(b) => saveSection(open, b)} onCancel={() => setOpen("")} />
          </>
        )}
      </div>

      <div className="card">
        <div className="sectionhead"><h2>Consent text</h2>{consent && <span className={`tag ${consent.status === "APPROVED" ? "ok" : "warn"}`}>Version {consent.version} · {consent.status === "APPROVED" ? "Approved" : "Draft"}</span>}</div>
        {consent && <ConsentDraftNote body={consent.body} />}
        {consent && (
          <form className="addbox" key={consent.version + consent.status} onSubmit={(e) => { const f = form(e); run(() => api("PUT", `/v1/assessments/${A}/consent-text`, { title: f.get("title"), body: f.get("body") }), "Consent text saved. It needs approving again."); }}>
            <div className="field"><label className="flab" htmlFor="c-title">Title</label><input id="c-title" name="title" defaultValue={consent.title} maxLength={200} disabled={locked} /></div>
            <div className="field" style={{ marginTop: 10 }}><label className="flab" htmlFor="c-body">Text (paragraphs separated by a blank line)</label><textarea id="c-body" name="body" rows={14} defaultValue={consent.body} disabled={locked} /></div>
            {!locked && (
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn ghost sm" disabled={busy}>{consent.status === "APPROVED" ? "Save as a new version" : "Save draft"}</button>
                {consent.status === "DRAFT" && <button type="button" className="btn gold sm" disabled={busy}
                  onClick={() => confirm("Approve this text? An approved text cannot be changed; a change makes a new version.") && run(() => api("POST", `/v1/assessments/${A}/consent-text/approve`), "Consent text approved.")}>Approve</button>}
              </div>
            )}
            <p className="small muted" style={{ marginTop: 6 }}>Drafted from a template. Have PAC legal and the client&rsquo;s data protection officer review the wording before you approve it for a real engagement.</p>
          </form>
        )}
      </div>

      <div className="card">
        <div className="sectionhead"><h2>Transfer basis</h2><span className={`tag ${transfer ? "ok" : "warn"}`}>{transfer ? "Recorded" : "Not recorded"}</span></div>
        <p className="muted">Processing runs in an EU region, so a transfer basis must be on record (check L6). Enter a reference to the signed document. The platform stores the reference only.</p>
        <form className="addbox" onSubmit={(e) => { const f = form(e); run(() => api("PUT", `/v1/assessments/${A}/transfer-basis`, { reference: f.get("ref") }), "Transfer basis recorded."); }}>
          <div className="field"><label className="flab" htmlFor="t-ref">Reference</label><input id="t-ref" name="ref" required minLength={3} maxLength={300} defaultValue={transfer ?? ""} disabled={locked} placeholder="e.g. Data transfer agreement, signed 2 Oct 2026" /></div>
          {!locked && <button className="btn gold sm" style={{ marginTop: 12 }} disabled={busy}>Record</button>}
        </form>
      </div>

      <div className="card">
        <div className="sectionhead"><h2>Survey links</h2></div>
        <p className="muted">Each link works once and is shown here only once; copy or download it straight away. Links for the roster carry each person&rsquo;s department, grade and tenure, so results can be broken down by group; the link to the person is removed when they submit.</p>
        <div className="addbox" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn gold sm" disabled={busy || !locked} onClick={() => run(() => api("POST", `/v1/assessments/${A}/invitations`, { mode: "roster" }), "Links issued for the roster.",
            (j) => { const ls = j.links as Link[]; if (!ls.length) setOk(`Everyone on the roster already has a link (${j.invited_before}).`); setLinks(ls.map((l) => ({ ...l, url: `${location.origin}/respond#${l.token}` }))); })}>Issue a link for everyone on the roster</button>
          <button className="btn ghost sm" disabled={busy || !locked} onClick={() => confirm("Issue a link for everyone on the roster not yet invited and email it to them from hello@pac.africa?") && run(() => api("POST", `/v1/assessments/${A}/invitations`, { mode: "roster", send_email: true }), "Links issued and emailed.",
            (j) => { const ls = j.links as Link[]; const m = j.mail as { sent: number; failed: number } | undefined; setOk(m ? `Emailed ${m.sent} of ${ls.length}.${m.failed ? ` ${m.failed} could not be sent; download the list below and send those by hand.` : ""}` : "Links issued."); setLinks(ls.map((l) => ({ ...l, url: `${location.origin}/respond#${l.token}` }))); })}>Issue and email links</button>
          <span className="small muted">People already invited are skipped.</span>
        </div>
        <details style={{ marginTop: 10 }}><summary className="small muted" style={{ cursor: "pointer" }}>Anonymous links instead (no group breakdown)</summary>
          <form className="addbox" onSubmit={(e) => { const f = form(e); run(() => api("POST", `/v1/assessments/${A}/invitations`, { count: Number(f.get("count")) }), "Links issued.", (j) => setLinks((j.tokens as string[]).map((t) => ({ name: null, email: null, token: t, url: `${location.origin}/respond#${t}` })))); }}>
            <div className="field" style={{ maxWidth: 200 }}><label className="flab" htmlFor="l-n">How many (1 to 500)</label><input id="l-n" name="count" type="number" min={1} max={500} defaultValue={5} required /></div>
            <button className="btn ghost sm" style={{ marginTop: 12 }} disabled={busy}>Issue anonymous links</button>
          </form>
        </details>
        {links.length > 0 && (
          <div className="note blue" role="status">
            <b>{links.length} links</b>{" "}
            <button className="btn sm ghost" onClick={() => {
              const cell = (v: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
              const csv = ["name,email,link", ...links.map((l) => [cell(l.name), cell(l.email), cell(l.url)].join(","))].join("\r\n");
              const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "survey-links.csv"; a.click(); URL.revokeObjectURL(a.href);
            }}>Download CSV</button>{" "}
            <button className="btn sm ghost" onClick={() => navigator.clipboard?.writeText(links.map((l) => (l.email ? `${l.email}\t${l.url}` : l.url)).join("\n"))}>Copy all</button>{" "}
            <button className="btn sm ghost" onClick={() => setLinks([])}>Done</button>
            <div className="tblwrap" style={{ marginTop: 8, maxHeight: 320, overflow: "auto" }}><table className="tbl"><tbody>
              {links.map((l) => <tr key={l.token}><td>{l.name ?? (l.email ? "" : "Anonymous seat")}<div className="small muted">{l.email}</div></td><td style={{ wordBreak: "break-all", fontSize: 12 }}>{l.url}</td></tr>)}
            </tbody></table></div>
            <span className="small">They open only while the survey window is open. These links are not stored anywhere you can read them again.</span>
          </div>
        )}
      </div>
    </>
  );
}
