"use client";

import { useState } from "react";
import { browserDb } from "@/lib/supabase/browser";

// email: prefilled from ?email= (the demo link on the home page passes the shared demo login)
export default function LoginForm({ next, email }: { next: string | null; email?: string }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr("");
    const f = new FormData(e.currentTarget);
    const { error } = await browserDb().auth.signInWithPassword({ email: String(f.get("email")).trim().toLowerCase(), password: String(f.get("password")) });
    if (error) { setBusy(false); return setErr("Email or password is not right."); }   // one message: never say which
    // only same-site paths: a crafted ?next= must not send people elsewhere
    window.location.assign(next && /^\/[^/\\]/.test(next) ? next : "/dashboard");
  }

  return (
    <form onSubmit={onSubmit}>
      <label className="auth-label" htmlFor="email">Work email</label>
      <input id="email" name="email" type="email" inputMode="email" autoComplete="username" required placeholder="you@company.com" defaultValue={email} />
      <label className="auth-label" htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required placeholder="Password" />
      <button className="auth-btn" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      {err && <p className="auth-err" role="alert">{err}</p>}
    </form>
  );
}
