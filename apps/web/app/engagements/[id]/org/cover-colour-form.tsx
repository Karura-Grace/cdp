"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// The client cover colour: a band on the cover of released reports and the title slide. A PAC Consultant sets it here; a Super Admin also on the Organisations screen.
export default function CoverColourForm({ tenantId, current }: { tenantId: string; current: string | null }) {
  const router = useRouter();
  const [v, setV] = useState(current ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(colour: string | null) {
    setBusy(true); setMsg(null);
    const r = await api("PUT", `/v1/tenants/${tenantId}/cover-colour`, { colour });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: (await r.json().catch(() => null))?.title ?? "Could not save the colour." });
    setMsg({ ok: true, text: colour ? "Cover colour saved." : "Cover colour removed." }); if (!colour) setV(""); router.refresh();
  }
  const valid = /^#[0-9A-Fa-f]{6}$/.test(v.trim());
  return (
    <section className="scard" aria-label="Client cover colour">
      <div className="scard-head"><div><h2>Client cover colour</h2><div className="ssmall smuted">A band across the top of the cover of released reports, PDF and PowerPoint. Six digit hex, for example #1F7A5C.</div></div></div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label className="flab" htmlFor="cover-colour" style={{ margin: 0 }}>Colour</label>
        <input id="cover-colour" value={v} maxLength={7} placeholder="#1F7A5C" onChange={(e) => setV(e.target.value)} style={{ width: 120 }} />
        <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid var(--line-2)", background: valid ? v : "transparent" }} />
        <button className="sbtn ghost" disabled={busy || !valid} onClick={() => save(v.trim())}>Save colour</button>
        {current && <button className="sbtn ghost" disabled={busy} onClick={() => save(null)}>Remove</button>}
      </div>
      {msg && <p className="ssmall" role="status" style={{ marginTop: 8, color: msg.ok ? undefined : "var(--orange-d, #b3261e)" }}>{msg.text}</p>}
    </section>
  );
}
