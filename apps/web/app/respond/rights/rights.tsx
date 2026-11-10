"use client";
import { useEffect, useState } from "react";

type Attr = { attr_id: string; name: string; values_list: string[]; is_sensitive: boolean; value: string | null };
type View = { state: string; message?: string; person?: { employee_ref: string; email: string; display_name: string | null; employment_status: string }; demographics?: Attr[]; note?: string };

// Self service access, correction of demographic answers, objection and erasure of the invitation record (spec 1.4.5).
export default function Rights() {
  const [token, setToken] = useState("");
  const [v, setV] = useState<View | null>(null);
  const [msg, setMsg] = useState("");
  const call = async (method: string, body?: unknown) => {
    const r = await fetch("/v1/survey/rights", { method, headers: { "x-survey-token": token, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    return [r.status, await r.json().catch(() => null)] as const;
  };
  const load = async (t = token) => {
    const r = await fetch("/v1/survey/rights", { headers: { "x-survey-token": t } });
    const j = await r.json().catch(() => null);
    setV(r.status === 410 ? { state: "INVALID", message: "This link is no longer valid." } : j);
  };
  useEffect(() => { const t = window.location.hash.slice(1); setToken(t); if (t) void load(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  if (!v) return <main style={{ maxWidth: 640, margin: "40px auto", padding: 16 }}><p>{token ? "Loading…" : "Open this page from your personal survey link."}</p></main>;
  if (v.state !== "OPEN") return <main style={{ maxWidth: 640, margin: "40px auto", padding: 16 }}><h1>Your data rights</h1><p>{v.message}</p></main>;
  return (
    <main style={{ maxWidth: 640, margin: "40px auto", padding: 16 }}>
      <h1>Your data rights</h1>
      <p>{v.note}</p>
      <h2>What we hold about you</h2>
      <p>Employee reference {v.person!.employee_ref}, email {v.person!.email}{v.person!.display_name ? `, name ${v.person!.display_name}` : ""}.</p>
      {(v.demographics ?? []).length > 0 && <h2>About you</h2>}
      {(v.demographics ?? []).map((a) => (
        <label key={a.attr_id} style={{ display: "block", margin: "8px 0" }}>{a.name}{a.is_sensitive ? " (optional)" : ""}<br />
          <select value={a.value ?? ""} onChange={async (e) => { const [s] = await call("PUT", { attr_id: a.attr_id, value: e.target.value || null }); setMsg(s === 200 ? "Saved." : "That did not work."); void load(); }}>
            <option value="">{a.is_sensitive ? "Prefer not to say" : "Not answered"}</option>{a.values_list.map((x) => <option key={x}>{x}</option>)}
          </select></label>))}
      <h2>Object or erase</h2>
      <button onClick={async () => { const [s] = await call("POST", { kind: "OBJECT" }); setMsg(s === 201 ? "Your objection is recorded. PAC Africa or your organisation will respond." : "That did not work."); }}>I object to my data being processed</button>{" "}
      <button onClick={async () => { if (!confirm("Erase your invitation? Your link will stop working and you will not be able to take part.")) return; const [s] = await call("POST", { kind: "ERASE" }); setMsg(s === 201 ? "Your invitation record is erased." : "That did not work."); void load(); }}>Erase my invitation record</button>
      {msg && <p role="status">{msg}</p>}
    </main>
  );
}
