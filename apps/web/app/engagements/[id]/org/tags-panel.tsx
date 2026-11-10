"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Person = { employee_ref: string; name: string | null; role_tag: string | null; locked: boolean };
type Loc = { name: string; country: string | null };
const TAGS = [["", "Not set (the grade decides)"], ["STAFF", "Staff"], ["LEADER", "Leader"], ["EXECUTIVE", "Executive"]] as const;

// Who is staff, leader or executive for the Leadership 360 and the executive cohort, and which country each location is in (owner rulings 22 Oct 2026,
// Erick Ngala comments 39 and 34). A tag wins over the grade flag. It is written on the survey link when the link is issued, so people who already have
// a link are locked. A LEADER tag does not create a leader: leaders still need a team in the leaders file.
export default function TagsPanel({ engagementId, showTags }: { engagementId: string; showTags: boolean }) {
  const base = `/v1/engagements/${engagementId}`;
  const [people, setPeople] = useState<Person[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [locs, setLocs] = useState<Loc[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [lEdits, setLEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch(`${base}/role-tags`, { cache: "no-store" }), fetch(`${base}/location-countries`, { cache: "no-store" })]);
    if (a.ok) setPeople((await a.json()).people);
    if (b.ok) { const j = await b.json(); setLocs(j.locations); setCountries(j.countries); }
    setEdits({}); setLEdits({});
  }, [base]);
  useEffect(() => { load(); }, [load]);

  async function save(path: string, body: unknown, done: string) {
    setBusy(true); setMsg(null);
    const r = await api("PUT", `${base}/${path}`, body); const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j?.title ?? "That did not work." });
    setMsg({ ok: true, text: done }); load();
  }
  const shown = people.filter((p) => !q || `${p.employee_ref} ${p.name ?? ""}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60);

  return (
    <div className="card">
      <h2>Roles and countries</h2>
      {msg && <div className={`note${msg.ok ? " blue" : ""}`} role="status">{msg.text}</div>}
      {showTags && <>
        <p className="muted small">Tag each person staff, leader or executive. A tag wins over the grade. It is fixed on a person&apos;s survey link when it is issued, so people who already have one are locked. A leader tag does not create a leader: leaders still need a team in the leaders file.</p>
        <input aria-label="Find a person" placeholder="Find a person" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
        <div className="tblwrap"><table className="tbl"><thead><tr><th>Person</th><th>Role</th></tr></thead><tbody>
          {shown.map((p) => (
            <tr key={p.employee_ref}><td>{p.name ?? p.employee_ref} <span className="small muted">{p.employee_ref}</span></td>
              <td>{p.locked ? <span className="small muted">{TAGS.find((t) => t[0] === (p.role_tag ?? ""))?.[1]} (locked: has a survey link)</span> : (
                <select aria-label={`Role for ${p.employee_ref}`} value={edits[p.employee_ref] ?? p.role_tag ?? ""} onChange={(e) => setEdits({ ...edits, [p.employee_ref]: e.target.value })}>{TAGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>)}</td></tr>
          ))}
        </tbody></table></div>
        {people.length > shown.length && <p className="small muted">Showing {shown.length} of {people.length}. Use the search to find the rest.</p>}
        <button className="btn gold sm" style={{ marginTop: 8 }} disabled={busy || !Object.keys(edits).length}
          onClick={() => save("role-tags", { tags: Object.entries(edits).map(([employee_ref, v]) => ({ employee_ref, role_tag: v || null })) }, "Roles saved.")}>Save roles ({Object.keys(edits).length})</button>
      </>}

      <h3 style={{ marginTop: 18 }}>Country of each location</h3>
      <p className="muted small">Results can be cut by country. The countries are the organisation&apos;s own ({countries.join(", ") || "none"}); a Super Admin can add more on the Organisations screen.</p>
      {locs.length === 0 ? <p className="muted small">No locations loaded yet.</p> : (
        <div className="tblwrap"><table className="tbl"><thead><tr><th>Location</th><th>Country</th></tr></thead><tbody>
          {locs.map((l) => (
            <tr key={l.name}><td>{l.name}</td><td><select aria-label={`Country for ${l.name}`} value={lEdits[l.name] ?? l.country ?? ""} onChange={(e) => setLEdits({ ...lEdits, [l.name]: e.target.value })}>
              <option value="">Not set</option>{countries.map((c) => <option key={c} value={c}>{c}</option>)}</select></td></tr>
          ))}
        </tbody></table></div>)}
      <button className="btn gold sm" style={{ marginTop: 8 }} disabled={busy || !Object.keys(lEdits).length}
        onClick={() => save("location-countries", { locations: Object.entries(lEdits).map(([name, v]) => ({ name, country: v || null })) }, "Countries saved.")}>Save countries ({Object.keys(lEdits).length})</button>
    </div>
  );
}
