"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export interface UserRow {
  user_id: string; email: string; full_name: string; role: string; tenant_id: string | null; tenant_name: string | null;
  active: boolean; must_change_password: boolean; last_sign_in_at: string | null; person_id?: string | null; person_name?: string | null;
  assignments: { assignment_id: string; engagement_id: string; tenant_name: string; valid_from: string; valid_to: string }[];
}
type Opt = { id: string; label: string };

const CLIENT = ["CLIENT_ADMIN", "EXECUTIVE", "PEOPLE_LEADER", "COACH"];
const LABEL: Record<string, string> = { SUPER_ADMIN: "Super Admin", PAC_CONSULTANT: "PAC Consultant", CLIENT_ADMIN: "Client Admin", EXECUTIVE: "Executive", PEOPLE_LEADER: "People Leader", COACH: "Coach" };
const fmt = (s: string | null) => (s ? s.slice(0, 10) : "never");

export default function UsersClient({ users, people, selfId, isSuper, tenants, engagements }: {
  users: UserRow[]; people: { person_id: string; tenant_id: string; label: string }[]; selfId: string; isSuper: boolean; tenants: { tenant_id: string; name: string }[]; engagements: Opt[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState<{ email: string; password: string; what: string } | null>(null);
  const [role, setRole] = useState(isSuper ? "PAC_CONSULTANT" : "EXECUTIVE");
  const [copied, setCopied] = useState(false);
  const addable = isSuper ? ["PAC_CONSULTANT", ...CLIENT] : ["EXECUTIVE", "PEOPLE_LEADER", "COACH"];

  async function run(fn: () => Promise<Response>, after?: (j: Record<string, unknown>) => void) {
    setBusy(true); setErr("");
    const r = await fn();
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j?.title ?? "That did not work.");
    after?.(j);
    router.refresh();
  }

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const body: Record<string, string> = { email: String(f.get("email")), full_name: String(f.get("name")), role };
    if (role !== "PAC_CONSULTANT" && isSuper) body.tenant_id = String(f.get("tenant"));
    if (role === "PAC_CONSULTANT" && f.get("engagement")) { body.engagement_id = String(f.get("engagement")); body.valid_to = new Date(`${f.get("until")}T23:59:59Z`).toISOString(); }
    run(() => api("POST", "/v1/users", body), (j) => { setSecret({ email: String(j.email), password: String(j.temp_password), what: "Account created" }); form.reset(); });
  }

  const reset = (u: UserRow) => confirm(`Issue a new temporary password for ${u.email}? Their current password stops working.`) &&
    run(() => api("POST", `/v1/users/${u.user_id}/reset-password`), (j) => setSecret({ email: u.email, password: String(j.temp_password), what: "Password reset" }));
  const toggle = (u: UserRow) => (u.active ? confirm(`Deactivate ${u.email}? They are signed out of the database straight away and cannot sign in.`) : true) &&
    run(() => api("PATCH", `/v1/users/${u.user_id}`, { active: !u.active }));
  const assign = (u: UserRow, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    run(() => api("POST", `/v1/users/${u.user_id}/assignments`, { engagement_id: String(f.get("engagement")), valid_to: new Date(`${f.get("until")}T23:59:59Z`).toISOString() }), () => form.reset());
  };
  const today = new Date().toISOString().slice(0, 10);
  const max = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);

  return (
    <>
      {secret && (
        <div className="note blue" role="status">
          <b>{secret.what}: {secret.email}</b><br />
          Temporary password: <code style={{ fontSize: 15, fontWeight: 700 }}>{secret.password}</code>{" "}
          <button className="btn sm ghost" onClick={() => { navigator.clipboard?.writeText(secret.password); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
          <br /><span className="small">Shown once. Pass it on securely. They must replace it when they first sign in. It is not stored anywhere you can read it again.</span>{" "}
          <button className="btn sm ghost" onClick={() => { setSecret(null); setCopied(false); }}>Done</button>
        </div>
      )}
      {err && <div className="note" role="alert"><b>{err}</b></div>}

      <div className="card">
        <div className="sectionhead"><h2>Add a user</h2></div>
        <form className="addbox" onSubmit={add}>
          <div className="formgrid">
            <div className="field"><label className="flab" htmlFor="u-name">Full name</label><input id="u-name" name="name" required maxLength={120} /></div>
            <div className="field"><label className="flab" htmlFor="u-email">Work email</label><input id="u-email" name="email" type="email" required /></div>
            <div className="field"><label className="flab" htmlFor="u-role">Role</label>
              <select id="u-role" value={role} onChange={(e) => setRole(e.target.value)}>{addable.map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}</select></div>
            {isSuper && role !== "PAC_CONSULTANT" && (
              <div className="field"><label className="flab" htmlFor="u-tenant">Organisation</label>
                <select id="u-tenant" name="tenant" required>{tenants.map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.name}</option>)}</select></div>
            )}
            {isSuper && role === "PAC_CONSULTANT" && (
              <>
                <div className="field"><label className="flab" htmlFor="u-eng">Assign to engagement (optional)</label>
                  <select id="u-eng" name="engagement"><option value="">Not yet</option>{engagements.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select></div>
                <div className="field"><label className="flab" htmlFor="u-until">Access until</label><input id="u-until" name="until" type="date" min={today} max={max} defaultValue={max} /></div>
              </>
            )}
          </div>
          <button className="btn gold sm" style={{ marginTop: 12 }} disabled={busy}>{busy ? "Working…" : "Create user"}</button>
          <p className="small muted" style={{ marginTop: 6 }}>A one-time password is shown after creation. {isSuper ? "Client Admins create Executives, People Leaders and Coaches for their own organisation." : "You can add Executives, People Leaders and Coaches for your organisation."}</p>
        </form>
      </div>

      <div className="card">
        <div className="sectionhead"><h2>People <span className="small muted" style={{ fontWeight: 400 }}>· {users.length}</span></h2></div>
        <div className="tblwrap"><table className="tbl">
          <thead><tr><th>User</th><th>Role</th>{isSuper && <th>Organisation</th>}<th>Linked person</th><th>Status</th><th>Last sign-in</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const me = u.user_id === selfId, locked = me || u.role === "SUPER_ADMIN";
              const editableRole = !locked && CLIENT.includes(u.role) && (isSuper || u.role !== "CLIENT_ADMIN");
              const roleOpts = isSuper ? CLIENT : ["EXECUTIVE", "PEOPLE_LEADER", "COACH"];
              return (
                <tr key={u.user_id} style={u.active ? undefined : { opacity: 0.6 }}>
                  <td><strong>{u.full_name || u.email}</strong>{me && <span className="small muted"> (you)</span>}<div className="small muted">{u.email}</div></td>
                  <td>{editableRole
                    ? <select aria-label={`Role for ${u.email}`} value={u.role} disabled={busy} style={{ minWidth: 150 }} onChange={(e) => confirm(`Change ${u.email} to ${LABEL[e.target.value]}?`) ? run(() => api("PATCH", `/v1/users/${u.user_id}`, { role: e.target.value })) : router.refresh()}>
                        {[...new Set([u.role, ...roleOpts])].map((r) => <option key={r} value={r}>{LABEL[r]}</option>)}</select>
                    : LABEL[u.role] ?? u.role}</td>
                  {isSuper && <td className="muted">{u.tenant_name ?? "PAC"}</td>}
                  <td>{u.role === "PEOPLE_LEADER"
                    ? <select aria-label={`Linked person for ${u.email}`} value={u.person_id ?? ""} disabled={busy || locked && !isSuper} style={{ minWidth: 170 }}
                        onChange={(e) => run(() => api("PATCH", `/v1/users/${u.user_id}`, { person_id: e.target.value || null }))}>
                        <option value="">Not linked</option>
                        {people.filter((p) => p.tenant_id === u.tenant_id).map((p) => <option key={p.person_id} value={p.person_id}>{p.label}</option>)}</select>
                    : <span className="muted">n/a</span>}</td>
                  <td>{!u.active ? <span className="tag bad">Deactivated</span> : u.must_change_password ? <span className="tag warn">Temporary password</span> : <span className="tag ok">Active</span>}</td>
                  <td className="muted">{fmt(u.last_sign_in_at)}</td>
                  <td><div className="tbl-actions">
                    {!locked && <button className="btn ghost sm" disabled={busy} onClick={() => reset(u)}>Reset password</button>}
                    {!locked && <button className="btn ghost sm" disabled={busy} onClick={() => toggle(u)}>{u.active ? "Deactivate" : "Reactivate"}</button>}
                  </div></td>
                </tr>
              );
            })}
            {users.length === 0 && <tr><td colSpan={7} className="muted">No users yet.</td></tr>}
          </tbody>
        </table></div>
      </div>

      {isSuper && (
        <div className="card">
          <div className="sectionhead"><h2>PAC Consultant access</h2></div>
          <p className="small muted" style={{ marginBottom: 10 }}>A consultant sees an engagement only while an assignment is in force. Revoking ends it now and keeps the history.</p>
          {users.filter((u) => u.role === "PAC_CONSULTANT").map((u) => (
            <div key={u.user_id} className="addbox">
              <strong>{u.full_name || u.email}</strong> <span className="small muted">{u.email}</span>
              {u.assignments.length === 0 && <p className="small muted" style={{ marginTop: 6 }}>No engagements assigned.</p>}
              {u.assignments.map((a) => {
                const live = new Date(a.valid_to) > new Date();
                return (
                  <div key={a.assignment_id} className="rowline">
                    <span>{a.tenant_name} <span className="small muted">· {fmt(a.valid_from)} to {fmt(a.valid_to)}</span></span>
                    {live ? <button className="btn ghost sm" disabled={busy} onClick={() => confirm("End this access now?") && run(() => api("DELETE", `/v1/assignments/${a.assignment_id}`))}>Revoke</button> : <span className="tag grey">Ended</span>}
                  </div>
                );
              })}
              <form onSubmit={(e) => assign(u, e)} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <select name="engagement" required aria-label="Engagement" style={{ flex: 1, minWidth: 200 }}><option value="">Choose engagement…</option>{engagements.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
                <input name="until" type="date" required min={today} max={max} defaultValue={max} aria-label="Access until" style={{ width: 160 }} />
                <button className="btn gold sm" disabled={busy}>Assign</button>
              </form>
            </div>
          ))}
          {users.every((u) => u.role !== "PAC_CONSULTANT") && <p className="muted">No PAC Consultants yet. Add one above.</p>}
        </div>
      )}
    </>
  );
}
