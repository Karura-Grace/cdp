import Link from "next/link";
import "@/app/auth.css";

// The neutral page for any survey or feedback link that cannot be used: used, expired, closed or unknown all look the same,
// so a link cannot be probed (CLAUDE.md §4). Server and client components can both render it.
export function LinkExpired({ what = "survey" }: { what?: "survey" | "feedback" }) {
  return (
    <div className="auth solo">
      <main className="auth-form">
        <div className="auth-top"><Link className="auth-mini" href="/" aria-label="CDP home">CDP<span>.</span></Link><span className="auth-minisub">Culture Dynamics Profile</span></div>
        <div className="auth-cardwrap">
          <div className="auth-card" style={{ maxWidth: 520 }}>
            <div className="auth-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div>
            <span className="auth-badge">Link inactive</span>
            <h2 style={{ marginTop: 10 }}>This {what} link is no longer active</h2>
            <p className="auth-desc" style={{ fontSize: 15 }}>The window may have closed, or the link may already have been used. For your privacy we cannot show any other detail about it.</p>
            <ul className="auth-steps">
              <li><b>Why did this happen?</b>Each {what} runs for a fixed window, and each personal link works for one submission. After the window closes it cannot reopen.</li>
              <li><b>Next steps</b>If you think you have not taken part yet and it is still open, contact the person in your organisation who sent the invitation.</li>
            </ul>
            <Link className="auth-btn ghost" href="/" style={{ marginTop: 20 }}>Back to the homepage</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
