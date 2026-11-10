"use client";

import { useState } from "react";
import { browserDb } from "@/lib/supabase/browser";

export default function PasswordForm({ forced }: { forced: boolean }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const pw = String(f.get("pw")), again = String(f.get("again"));
    if (pw.length < 12 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return setErr("Use at least 12 characters, with an upper case letter, a lower case letter and a number.");
    if (pw !== again) return setErr("The two passwords do not match.");
    setBusy(true); setErr("");
    const { error } = await browserDb().auth.updateUser({ password: pw });
    if (error) { setBusy(false); return setErr(error.message.includes("different") ? "Choose a password you have not used before." : "Could not change the password. Try a longer one."); }
    const r = await fetch("/v1/me/password-changed", { method: "POST", headers: { "x-cdp-csrf": "1" } });
    if (!r.ok) { setBusy(false); return setErr("The password was changed but we could not finish. Sign in again with your new password."); }
    window.location.assign("/dashboard");
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="f" htmlFor="pw">New password<span className="hint">At least 12 characters, with an upper case letter, a lower case letter and a number.</span></label>
      <input id="pw" name="pw" type="password" autoComplete="new-password" required minLength={12} />
      <label className="f" htmlFor="again">Repeat new password</label>
      <input id="again" name="again" type="password" autoComplete="new-password" required />
      {err && <div className="note" role="alert">{err}</div>}
      <div className="navbtns" style={{ justifyContent: "flex-start" }}>
        <button className="btn gold" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
        {!forced && <a className="btn ghost" href="/dashboard">Cancel</a>}
      </div>
    </form>
  );
}
