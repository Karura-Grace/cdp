"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Set one person's value for one attribute from its closed list (people can also do this themselves from their survey link).
export default function DemoValueForm({ url, persons, values }: { url: string; persons: [string, string][]; values: [string, string][] }) {
  const router = useRouter();
  const [p, setP] = useState(""), [av, setAv] = useState(""), [msg, setMsg] = useState("");
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const [attr_id, ...rest] = av.split("|");
      const r = await api("PUT", url, { person_id: p, attr_id, value: rest.join("|") });
      const j = await r.json().catch(() => null);
      setMsg(r.ok ? "Saved." : j?.title ?? "That did not work."); if (r.ok) router.refresh();
    }} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 14 }}>
      <label className="ssmall" style={{ flex: "1 1 220px" }}>Person<br /><select required value={p} onChange={(e) => setP(e.target.value)} style={{ width: "100%" }}><option value="">Choose</option>{persons.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></label>
      <label className="ssmall" style={{ flex: "1 1 220px" }}>Attribute and value<br /><select required value={av} onChange={(e) => setAv(e.target.value)} style={{ width: "100%" }}><option value="">Choose</option>{values.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></label>
      <button className="sbtn orange">Set value</button>{msg && <span className="ssmall" role="status">{msg}</span>}
    </form>
  );
}
