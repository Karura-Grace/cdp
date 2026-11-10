import "./invite.css";
import { RightsLink } from "@/components/rights-link";

const ico = (d: React.ReactNode) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

// First screen of the survey link: who is asking, what it takes, and the anonymity promise, before consent. Shown at step 0.
export function Invitation({ org, closes, message, estimate, onStart }: { org: string | null; closes: string | null; message?: string | null; estimate?: string | null; onStart: () => void }) {
  const by = closes ? new Date(closes).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <div className="inv">
      <header className="inv-top">
        <span className="inv-logo" aria-label="CDP">CDP<span>.</span></span>
        <span className="inv-lock">{ico(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>)}Secure and anonymous</span>
      </header>
      <main>
        <section className="inv-hero">
          <span className="inv-pill">Survey invitation</span>
          <h1>Culture Dynamics Profile</h1>
          <p>Run with <b>Priority Activator Consulting</b> to map your organisation&rsquo;s culture now and the culture it needs next.</p>
        </section>
        <div className="inv-shell">
          <section className="inv-panel">
            {org && <div className="inv-org">
              <div><p className="inv-eyebrow">Organisation</p><h2>{org}</h2></div>
              <span className="inv-mark" aria-hidden="true">{org.trim().charAt(0).toUpperCase()}</span>
            </div>}
            {message && <div className="inv-msg">{message.split("\n\n").map((para, i) => <p key={i} style={{ margin: "0 0 10px", whiteSpace: "pre-line" }}>{para}</p>)}</div>}
            <div className="inv-facts">
              <div className="inv-fact"><i>{ico(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)}</i><div><b>{estimate ?? "35 to 45 minutes"}</b><span>You can stop and come back with the same link. Progress is kept on this device.</span></div></div>
              <div className="inv-fact"><i>{ico(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>)}</i><div><b>{by ? `Open until ${by}` : "Open for a limited time"}</b><span>Each personal link works for one submission.</span></div></div>
              <div className="inv-fact"><i>{ico(<><circle cx="12" cy="12" r="9" /><path d="M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .8-1 1.7M12 17h.01" /></>)}</i><div><b>No right answers</b><span>Answer for the whole organisation, not just your own team.</span></div></div>
            </div>
            <div className="inv-anon">
              {ico(<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z" />)}
              <div><b>Strictly anonymous</b><p>Your name is separated from your answers the moment you submit, and cannot be put back. Results are only reported for groups of five or more. Participation is voluntary.</p></div>
            </div>
            <button className="inv-go" onClick={onStart}>Start the survey{ico(<path d="M5 12h14M13 6l6 6-6 6" />)}</button>
            <p className="inv-next">Next you read and agree to the consent text, then the questions begin.</p>
          </section>
          <section className="inv-help">
            <p className="inv-eyebrow">Technical support</p>
            <a href="mailto:hello@pac.africa?subject=CDP%20survey%20help"><b>Something not working?</b><span>Email hello@pac.africa and say which page you are on.</span></a>
            <div><b>System requirements</b><span>Any current browser on a phone, tablet or computer. Keep cookies and local storage on so your progress is saved.</span></div>
          </section>
        </div>
      </main>
      <footer className="inv-foot"><RightsLink /> · © 2026 Priority Activator Consulting · Culture Dynamics Profile</footer>
    </div>
  );
}
