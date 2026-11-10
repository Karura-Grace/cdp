import type { Metadata } from "next";
import Link from "next/link";
import "../auth.css";
import LoginForm from "./form";

export const metadata: Metadata = { title: "Sign in | Culture Dynamics Profile", robots: { index: false } };

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="rgba(235,87,51,.25)" /><path d="M7 12.5l3 3 7-7" stroke="#EB5733" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// New design: ink brand panel, paper form side. Password sign in only. Single sign on, "remember this device" and password
// reset by email are in the design but not built, so they are left out rather than shown as buttons that do nothing.
export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; inactive?: string; expired?: string; email?: string }> }) {
  const { next, inactive, expired, email } = await searchParams;
  return (
    <div className="auth">
      <aside className="auth-brand">
        <Link href="/" aria-label="Back to home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pac-logo-bw.png" alt="Priority Activator Consulting" className="auth-pac" />
        </Link>
        <div className="auth-hero">
          <span className="auth-kicker">Secure enterprise access</span>
          <h1>Unlock the architecture of organisational performance.</h1>
          <p>Sign in to your Culture Dynamics Profile dashboard to map, measure and optimise the cultural dimensions that drive your organisation forward.</p>
          <ul className="auth-points">
            <li><Check /><span>Results are released by a Culture Practitioner.</span></li>
            <li><Check /><span>No one, in your organisation or at PAC, can read an individual response.</span></li>
            <li><Check /><span>Groups under five people are never reported.</span></li>
          </ul>
        </div>
        <div className="auth-foot">© 2026 Priority Activator Consulting · Culture Dynamics Profile™</div>
      </aside>

      <main className="auth-form">
        <div className="auth-top">
          <Link className="auth-mini" href="/" aria-label="CDP home">CDP<span>.</span></Link><span className="auth-minisub">Culture Dynamics Profile</span>
          <Link className="auth-back" href="/"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>Back to homepage</Link>
        </div>
        <div className="auth-cardwrap">
          <div className="auth-card">
            <h2>Sign in</h2>
            <p className="auth-desc">Enter your work email and password to see your insights.</p>
            {inactive && <p className="auth-err" role="alert">This account has been deactivated. Contact your administrator.</p>}
            {expired && !inactive && <p className="auth-err" role="status">You were signed out for security. Sign in again to continue.</p>}
            <LoginForm next={next ?? null} email={email && /^[^@\s]+@[^@\s]+$/.test(email) ? email : undefined} />
            <p className="auth-note">Forgot your password? Ask your organisation&rsquo;s administrator to issue a new temporary one.<br />
              Taking a survey? You do not need to sign in: use the personal link in your invitation.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
