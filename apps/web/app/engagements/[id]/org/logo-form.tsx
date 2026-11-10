"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// The client logo shown on the cover of released reports and exports, beside "Presented by Priority Activator Consulting".
export default function LogoForm({ tenantId, current }: { tenantId: string; current: string | null }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (method: "PUT" | "DELETE", file?: File) => {
    setBusy(true); setMsg(null);
    const r = await fetch(`/v1/tenants/${tenantId}/logo`, { method, headers: { "x-cdp-csrf": "1", ...(file ? { "content-type": file.type } : {}) }, body: file });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: (await r.json().catch(() => null))?.title ?? "Could not save the logo." });
    setMsg({ ok: true, text: method === "PUT" ? "Logo saved." : "Logo removed." });
    router.refresh();
  };
  return (
    <section className="scard" aria-label="Client logo">
      <div className="scard-head"><div><h2>Client logo</h2><div className="ssmall smuted">Shown on the cover of released reports, PDF and PowerPoint. PNG or JPEG, at most 200 KB.</div></div></div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {current ? <img src={current} alt="Current client logo" style={{ maxHeight: 56, maxWidth: 220, objectFit: "contain", border: "1px solid var(--line-2)", borderRadius: 8, padding: 6, background: "#fff" }} /> : <span className="ssmall smuted">No logo yet. Reports show the PAC brand only.</span>}
        <label className="sbtn ghost" style={{ cursor: busy ? "wait" : "pointer" }}>{current ? "Replace logo" : "Upload logo"}
          <input type="file" accept="image/png,image/jpeg" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) send("PUT", f); e.target.value = ""; }} />
        </label>
        {current && <button className="sbtn ghost" disabled={busy} onClick={() => send("DELETE")}>Remove</button>}
      </div>
      {msg && <p className="ssmall" role="status" style={{ marginTop: 8, color: msg.ok ? undefined : "var(--orange-d, #b3261e)" }}>{msg.text}</p>}
    </section>
  );
}
