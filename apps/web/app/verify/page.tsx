import type { Metadata } from "next";
import Link from "next/link";
import "../auth.css";

export const metadata: Metadata = { title: "Verify your device | Culture Dynamics Profile", robots: { index: false } };

// The design's multi-factor screen. Multi-factor sign in is NOT active yet (gap 1), so nothing here sends or checks a code and no
// sign in leads to this page. It is shown clearly marked, so the design can be reviewed without implying protection that is not there.
export default function Page() {
  return (
    <div className="auth">
      <aside className="auth-brand">
        <span className="auth-kicker">Multi-factor authentication for every platform role</span>
        <div className="auth-hero">
          <h1>Securing the future of organisational intelligence.</h1>
          <p>Your data privacy is our highest priority. Multi-factor authentication will make sure only authorised people can open your organisation&rsquo;s culture insights.</p>
        </div>
        <div className="auth-foot">© 2026 Priority Activator Consulting · Culture Dynamics Profile™</div>
      </aside>
      <main className="auth-form">
        <div className="auth-top"><Link className="auth-mini" href="/" aria-label="CDP home">CDP<span>.</span></Link><span className="auth-minisub">Culture Dynamics Profile</span></div>
        <div className="auth-cardwrap">
          <div className="auth-card">
            <span className="auth-badge">Coming soon</span>
            <h2 style={{ marginTop: 10 }}>Verify your device</h2>
            <p className="auth-desc">Preview only. Two-step sign in is not switched on yet, so no code is sent or checked and you can sign in with your password alone.</p>
            <div className="auth-otp" role="group" aria-label="Verification code (preview)">
              {[1, 2, 3, 4, 5, 6].map((n) => <input key={n} disabled inputMode="numeric" maxLength={1} aria-label={`Digit ${n} of 6`} />)}
            </div>
            <div className="auth-soon">When it is on, you will enter a 6-digit code from your authenticator app after your password.</div>
            <button className="auth-btn" disabled>Verify and continue</button>
            <Link className="auth-btn ghost" href="/login">Back to sign in</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
