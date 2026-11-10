"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

/** One call with a busy flag and a status note: the API's problem title on failure, `done` on success, then the page refreshes. */
export function useCall() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = async (url: string, method: string, body: unknown, done = "Saved.") => {
    setBusy(true); setMsg(null);
    const r = await api(method, url, body).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setBusy(false);
    if (!r?.ok) { setMsg({ ok: false, text: j?.title ?? "That did not work. Check your connection." }); return false; }
    setMsg({ ok: true, text: done }); router.refresh(); return true;
  };
  const note = msg && <span className="ssmall" role={msg.ok ? "status" : "alert"} style={{ color: msg.ok ? "var(--hit)" : "var(--bad)" }}>{msg.text}</span>;
  return { busy, run, note };
}
