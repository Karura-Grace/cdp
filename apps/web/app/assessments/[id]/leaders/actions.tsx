"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const GROUPS = [["SUPERIOR", "Manager"], ["PEER", "Peer"], ["DIRECT_REPORT", "Direct report"], ["OTHER", "Other"]] as const;
type Person = { person_id: string; label: string };
type Nom = { person_id: string; rater_group: string; invited: boolean };


// Edit the raters of one leader. Invited raters are fixed; the rest are replaced on save.
export function Nominate({ assessmentId, assignmentId, people, current, locked }: { assessmentId: string; assignmentId: string; people: Person[]; current: Nom[]; locked: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(current.filter((n) => !n.invited).map((n) => ({ person_id: n.person_id, rater_group: n.rater_group })));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const invited = current.filter((n) => n.invited);
  const taken = new Set([...invited.map((n) => n.person_id), ...rows.map((r) => r.person_id)]);
  const name = (id: string) => people.find((p) => p.person_id === id)?.label ?? id;

  const save = async () => {
    setBusy(true); setMsg("");
    const r = await api("PUT", `/v1/assessments/${assessmentId}/l360/nominations`, { assignment_id: assignmentId, raters: rows.filter((x) => x.person_id) });
    const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) return setMsg(j?.title ?? "That did not save.");
    setMsg("Saved."); router.refresh();
  };

  return (
    <div>
      {invited.length > 0 && <p className="ssmall smuted" style={{ marginBottom: 6 }}>Invited: {invited.map((n) => `${name(n.person_id)} (${GROUPS.find((g) => g[0] === n.rater_group)?.[1]})`).join(", ")}</p>}
      {!locked && <>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 150px auto", gap: 8, marginBottom: 6 }}>
            <select aria-label="Rater" value={r.person_id} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, person_id: e.target.value } : x)))}>
              <option value="">Choose a person…</option>
              {people.filter((p) => p.person_id === r.person_id || !taken.has(p.person_id)).map((p) => <option key={p.person_id} value={p.person_id}>{p.label}</option>)}
            </select>
            <select aria-label="Relationship" value={r.rater_group} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, rater_group: e.target.value } : x)))}>
              {GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <button className="sbtn ghost" aria-label="Remove rater" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="sbtn ghost" onClick={() => setRows([...rows, { person_id: "", rater_group: "PEER" }])}>Add rater</button>
          <button className="sbtn orange" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save raters"}</button>
          {msg && <span className="ssmall" role="status">{msg}</span>}
        </div>
      </>}
    </div>
  );
}

type Link = { kind: string; leader: string; name: string | null; email: string | null; token: string };

// Issue the 360 links. They are shown once; only their hashes are stored.
export function IssueLinks({ assessmentId }: { assessmentId: string }) {
  const router = useRouter();
  const [links, setLinks] = useState<Link[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const issue = async () => {
    setBusy(true); setMsg("");
    const r = await api("POST", `/v1/assessments/${assessmentId}/l360/invitations`, {});
    const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) return setMsg(j?.title ?? "No links were issued.");
    setLinks(j.links); if (!j.links.length) setMsg("Everyone already has a link."); router.refresh();
  };
  const base = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="sbtn orange" disabled={busy} onClick={issue}>{busy ? "Issuing…" : "Issue 360 links"}</button>
        <span className="ssmall smuted">One self form per leader, one form per nominated rater. Links are shown once.</span>
        {msg && <span className="ssmall" role="status">{msg}</span>}
      </div>
      {links && links.length > 0 && (
        <div className="stblwrap" style={{ marginTop: 12 }}><table className="stbl">
          <thead><tr><th>For</th><th>Form</th><th>Link</th></tr></thead>
          <tbody>{links.map((l) => (
            <tr key={l.token}><td>{l.name ?? l.email}<div className="ssmall smuted">{l.email}</div></td>
              <td>{l.kind === "SELF" ? "Self" : `Rating ${l.leader}`}</td>
              <td><input readOnly value={`${base}/respond360#${l.token}`} onFocus={(e) => e.currentTarget.select()} aria-label={`Link for ${l.email}`} style={{ fontSize: 12 }} /></td></tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- development plans

function useSend() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async (url: string, method: string, body: unknown, done: string) => {
    setBusy(true); setMsg(null);
    const r = await api(method, url, body).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setBusy(false);
    if (!r?.ok) return setMsg({ ok: false, text: j?.title ?? "That did not work." });
    setMsg({ ok: true, text: done }); router.refresh();
  };
  const note = msg && <span className="ssmall" role={msg.ok ? "status" : "alert"} style={{ color: msg.ok ? "var(--hit)" : "var(--bad)" }}>{msg.text}</span>;
  return { busy, send, note };
}

export function DraftPlans({ assessmentId }: { assessmentId: string }) {
  const { busy, send, note } = useSend();
  return <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
    <button className="sbtn orange" disabled={busy} onClick={() => send(`/v1/assessments/${assessmentId}/development`, "POST", {}, "Development plans drafted.")}>Draft development plans</button>
    <span className="ssmall smuted">Up to three items per leader with a result: growth area, the leadership the strategy needs, and one blind spot.</span>{note}</div>;
}

export type DevItem = { item_id: string; basis: string; label: string; support: string; start_stop_keep: string | null; behaviour: string | null; visible_change_30d: string | null; agreed_at: string | null };
const BASIS: Record<string, string> = { GROWTH: "Growth area", TARGET: "Leadership the strategy needs", BLIND_SPOT: "Blind spot" };

export function DevPlan({ assessmentId, assignmentId, items, editable }: { assessmentId: string; assignmentId: string; items: DevItem[]; editable: boolean }) {
  const agree = useSend();
  const agreed = items.every((i) => i.agreed_at);
  const complete = items.every((i) => i.start_stop_keep && i.behaviour && i.visible_change_30d);
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: 14 }}>Development plan</h3>
        <span className={`stag ${agreed ? "ok" : "warn"}`}>{agreed ? `Agreed ${items[0].agreed_at!.slice(0, 10)}` : "Draft"}</span>
      </div>
      {items.map((it) => <DevRow key={it.item_id} it={it} editable={editable && !agreed} />)}
      {editable && !agreed && <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
        <button className="sbtn orange" disabled={agree.busy || !complete} onClick={() => agree.send(`/v1/assessments/${assessmentId}/development`, "POST", { agree: assignmentId }, "Agreed.")}>Agree the plan</button>
        {!complete && <span className="ssmall smuted">Complete every item first.</span>}{agree.note}</div>}
    </div>
  );
}

function DevRow({ it, editable }: { it: DevItem; editable: boolean }) {
  const { busy, send, note } = useSend();
  const support = it.support === "COACHING_MIN_8_SESSIONS" ? "Coaching, at least 8 sessions" : "Coaching";
  if (!editable) return (
    <div className="cds-check"><div className="top"><strong>{BASIS[it.basis]}: {it.label}</strong><span className="ssmall smuted">{support}</span></div>
      <p className="ssmall" style={{ marginTop: 4 }}>{it.start_stop_keep ? <><b>{it.start_stop_keep[0] + it.start_stop_keep.slice(1).toLowerCase()}:</b> {it.behaviour}</> : <span className="smuted">Not completed yet.</span>}</p>
      {it.visible_change_30d && <p className="ssmall smuted">Visible within 30 days: {it.visible_change_30d}</p>}</div>
  );
  return (
    <form className="cds-check" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget);
      send(`/v1/development/${it.item_id}`, "PATCH", { start_stop_keep: f.get("ssk") || null, behaviour: String(f.get("beh") ?? ""), visible_change_30d: String(f.get("vis") ?? "") }, "Saved."); }}>
      <div className="top"><strong>{BASIS[it.basis]}: {it.label}</strong><span className="ssmall smuted">{support}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr auto", gap: 8, marginTop: 8, alignItems: "end" }}>
        <select name="ssk" aria-label="Start, stop or keep" defaultValue={it.start_stop_keep ?? ""}><option value="">Choose…</option><option value="START">Start</option><option value="STOP">Stop</option><option value="KEEP">Keep</option></select>
        <input name="beh" aria-label="Behaviour" placeholder="The behaviour, in observable terms" defaultValue={it.behaviour ?? ""} maxLength={500} />
        <input name="vis" aria-label="Visible change in 30 days" placeholder="What others will see within 30 days" defaultValue={it.visible_change_30d ?? ""} maxLength={500} />
        <button className="sbtn ghost" disabled={busy}>Save</button>
      </div>{note}
    </form>
  );
}
