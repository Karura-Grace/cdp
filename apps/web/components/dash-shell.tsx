import "@/app/dash.css";
import type { StaffNav } from "./staff-shell";
import { SIco } from "./icons";

// The frame of the new dashboard and assessment preview (Claude Design export, owner Q-D9-43 to Q-D9-46, 5 Nov 2026): a dark sidebar
// with labels, or (rail) the orange icon rail of the consultant preview, and a top bar with the role, the email, Password and Sign out.
// Server component; sign out is a plain form POST like the staff shell.
const NAV_SVG: Record<string, React.ReactNode> = {
  "/dashboard": <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M9 9v11" /></>,
  "/glossary": <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  "/users": <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4a4 4 0 0 1 0 8" /><path d="M22 21a7 7 0 0 0-4-6.3" /></>,
};

export function Svg({ d, size = 18, w = 1.9, children }: { d?: string; size?: number; w?: number; children?: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d ? <path d={d} /> : children}</svg>;
}

export function DashShell({ nav, email, roleLabel, rail, top, children }: { nav: StaffNav[]; email: string; roleLabel: string; rail?: boolean; top?: React.ReactNode; children: React.ReactNode }) {
  const initials = (email.split("@")[0].match(/[a-z]/gi) ?? ["C"]).slice(0, 2).join("").toUpperCase();
  return (
    <div className={`cdp dsh${rail ? " is-rail" : ""}`}>
      <aside className="dsh-side" aria-label="Workspace">
        <a className="dsh-logo" href="/dashboard" aria-label="CDP home"><span>CDP</span></a>
        {nav.map((n) => (
          <a key={n.href} className={`dsh-nav${n.active ? " is-on" : ""}`} href={n.href} aria-current={n.active ? "page" : undefined} title={n.label}>
            {NAV_SVG[n.href] ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{NAV_SVG[n.href]}</svg> : <SIco k={n.icon} />}
            {n.label}
          </a>
        ))}
      </aside>
      <div className="dsh-main">
        <header className="dsh-top">
          {top}
          <span className="dsh-role">{roleLabel.toUpperCase()}</span>
          <span className="dsh-mail">{email}</span>
          <a className="dsh-link" href="/account/password">Password</a>
          <form className="dsh-out" action="/auth/signout" method="post"><button className="dsh-pill">Sign out</button></form>
          <span className="dsh-av" aria-label={`Signed in as ${initials}`}>{initials}</span>
        </header>
        {children}
      </div>
    </div>
  );
}

// "What it means and what to do" and the other toggles: a native <details>, so it works without script.
export function More({ label, children, className = "dsh-more" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <details>
      <summary className={className}>{label}<Svg size={18} w={2.4}><path d="M12 5v14" /><path d="M5 12h14" /></Svg></summary>
      {children}
    </details>
  );
}
