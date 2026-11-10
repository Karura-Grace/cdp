"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCall } from "@/lib/use-call";



export function CompareButton({ engagementId, label }: { engagementId: string; label: string }) {
  const { busy, run, note } = useCall();
  return <div className="state-act"><button className="sbtn orange" disabled={busy} onClick={() => run(`/v1/engagements/${engagementId}/comparison`, "POST", {}, "Comparison stored.")}>{busy ? "Comparing…" : label}</button>{note}</div>;
}

export function CheckTriggers({ engagementId }: { engagementId: string }) {
  const { busy, run, note } = useCall();
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button className="sbtn ghost" disabled={busy} onClick={() => run(`/v1/engagements/${engagementId}/triggers`, "POST", {}, "Checked.")}>Check for triggers</button>
      <button className="sbtn ghost" disabled={busy} onClick={() => run(`/v1/engagements/${engagementId}/triggers`, "POST", { board_request: true }, "Board request recorded.")}>Record a board request</button>
      {note}
    </div>
  );
}

export function DecideTrigger({ id }: { id: string }) {
  const { busy, run, note } = useCall();
  const [reason, setReason] = useState("");
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input aria-label="Reason (needed to dismiss)" placeholder="Reason (needed to dismiss)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} style={{ width: 220 }} />
      <button className="sbtn orange" disabled={busy} onClick={() => run(`/v1/triggers/${id}`, "PATCH", { decision: "ACCEPTED", reason }, "Accepted.")}>Accept</button>
      <button className="sbtn ghost" disabled={busy || !reason.trim()} onClick={() => run(`/v1/triggers/${id}`, "PATCH", { decision: "DISMISSED", reason }, "Dismissed.")}>Dismiss</button>
      {note}
    </div>
  );
}

const TYPES: [string, string][] = [["RESTRUCTURE", "Restructure"], ["MERGER", "Merger"], ["NEW_CEO", "New CEO"], ["MODEL_TRANSITION_LIVE", "Business model change now live"], ["OTHER", "Other"]];
export function OrgChangeForm({ engagementId }: { engagementId: string }) {
  const { busy, run, note } = useCall();
  const [type, setType] = useState("RESTRUCTURE");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [text, setText] = useState("");
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await run(`/v1/engagements/${engagementId}/org-changes`, "POST", { type, effective_date: date, description: text }, "Recorded.")) setText(""); }}
      style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <label className="ssmall">Type<br /><select value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="ssmall">Effective<br /><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <label className="ssmall" style={{ flex: "1 1 260px" }}>What changed<br /><input value={text} onChange={(e) => setText(e.target.value)} maxLength={500} required style={{ width: "100%" }} /></label>
      <button className="sbtn orange" disabled={busy || !text.trim()}>Record change</button>{note}
    </form>
  );
}

export interface PulseOffer { priority_id: string; label: string; items: { ref: string; text: string }[] }

// S6-01: pick a priority, pick items from its watch-list (at most ten), choose the review point.
export function PulseBuilder({ engagementId, offers, max }: { engagementId: string; offers: PulseOffer[]; max: number }) {
  const { busy, run, note } = useCall();
  const [pid, setPid] = useState(offers[0]?.priority_id ?? "");
  const [point, setPoint] = useState("+90d");
  const [picked, setPicked] = useState<string[]>([]);
  const offer = offers.find((o) => o.priority_id === pid);
  const pick = (ref: string) => setPicked((p) => (p.includes(ref) ? p.filter((x) => x !== ref) : p.length < max ? [...p, ref] : p));
  return (
    <form onSubmit={async (e) => { e.preventDefault(); if (await run(`/v1/engagements/${engagementId}/pulses`, "POST", { priority_id: pid, review_point: point, items: picked }, "Pulse created as a draft.")) setPicked([]); }}
      style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label className="ssmall">Priority<br /><select value={pid} onChange={(e) => { setPid(e.target.value); setPicked([]); }}>{offers.map((o) => <option key={o.priority_id} value={o.priority_id}>{o.label}</option>)}</select></label>
        <label className="ssmall">Review point<br /><select value={point} onChange={(e) => setPoint(e.target.value)}><option value="+90d">90 days</option><option value="+180d">180 days</option></select></label>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="ssmall">Watch-list items of this priority ({picked.length} of {max} chosen)</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {(offer?.items ?? []).map((i) => (
            <label key={i.ref} className="ssmall" style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <input type="checkbox" checked={picked.includes(i.ref)} onChange={() => pick(i.ref)} /><b>{i.ref}</b><span className="smuted">{i.text}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}><button className="sbtn orange" disabled={busy || !picked.length}>Create pulse</button>{note}</div>
    </form>
  );
}

// Open (links to everyone on the roster, optionally emailed), close, and read the results of one pulse.
// The raw links exist only in the reply to opening; they are kept in this page as a download and are not stored anywhere.
export function PulseActions({ id, status, emailReady }: { id: string; status: string; emailReady: boolean }) {
  const router = useRouter();
  const { busy, run, note } = useCall();
  const [closes, setCloses] = useState(new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  const [mail, setMail] = useState(emailReady);
  const [opening, setOpening] = useState(false);
  const [links, setLinks] = useState<string | null>(null);
  const [info, setInfo] = useState<{ ok: boolean; text: string } | null>(null);
  const open = async () => {
    setOpening(true); setInfo(null);
    const r = await api("POST", `/v1/pulses/${id}/open`, { closes, send_email: mail }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setOpening(false);
    if (!r?.ok) return setInfo({ ok: false, text: j?.title ?? "That did not work. Check your connection." });
    const csv = ["name,email,link", ...j.links.map((l: { name: string | null; email: string | null; token: string }) => `"${l.name ?? ""}","${l.email ?? ""}",${location.origin}/respond/pulse#${l.token}`)].join("\n");
    setLinks(URL.createObjectURL(new Blob([csv], { type: "text/csv" })));
    setInfo({ ok: true, text: `Opened for ${j.count} people.${j.mail ? ` Emailed ${j.mail.sent} of ${j.count}.` : ""} Download the links now: they are not shown again.` });
    router.refresh();
  };
  const msg = info && <span className="ssmall" role={info.ok ? "status" : "alert"} style={{ color: info.ok ? "var(--hit)" : "var(--bad)" }}>{info.text}</span>;
  const dl = links && <a className="sbtn ghost" href={links} download="pulse-links.csv">Download links</a>;
  if (status === "DRAFT") return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <label className="ssmall">Closes<br /><input type="date" value={closes} onChange={(e) => setCloses(e.target.value)} /></label>
      {emailReady && <label className="ssmall" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} />Email each person their link</label>}
      <button className="sbtn orange" disabled={opening} onClick={() => { if (confirm("Open this pulse and issue one link to every active person on the roster? Links can be shown only once.")) void open(); }}>{opening ? "Opening…" : "Open pulse"}</button>{dl}{msg}
    </div>
  );
  if (status === "OPEN") return <div className="state-act"><button className="sbtn ghost" disabled={busy} onClick={() => { if (confirm("Close this pulse now? No more answers are accepted.")) void run(`/v1/pulses/${id}/close`, "POST", {}, "Closed."); }}>Close pulse</button>{dl}{msg}{note}</div>;
  return <div className="state-act"><button className="sbtn orange" disabled={busy} onClick={() => run(`/v1/pulses/${id}/results`, "POST", {}, "Results stored.")}>Read the results</button>{note}</div>;
}

// S6-05: create the next cycle once the engine's guard is met. Nothing of this cycle changes.
export function RolloverButton({ engagementId }: { engagementId: string }) {
  const { busy, run, note } = useCall();
  return <div className="state-act"><button className="sbtn orange" disabled={busy} onClick={() => { if (confirm("Create the next cycle? The agreed setup sections are copied as drafts and the open actions are carried over. This cannot be undone.")) void run(`/v1/engagements/${engagementId}/rollover`, "POST", {}, "Next cycle created."); }}>{busy ? "Creating…" : "Create the next cycle"}</button>{note}</div>;
}
