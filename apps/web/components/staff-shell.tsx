import "@/app/staff.css";
import "@/app/portal.css";
import { SIco, type SIC } from "./icons";

export interface StaffNav { href: string; label: string; icon: keyof typeof SIC; active?: boolean }

// The app frame (owner pick Q-RD2-5, option C, 27 Oct 2026): a slim left sidebar of icons with labels, a thin top bar with who you are, and a wide cream canvas with a plain page head.
// On a phone the sidebar becomes a bar at the bottom. Server component; sign-out is a plain form POST. The props are the same as before, so every page keeps working.
export function StaffShell({ title, subtitle, nav, email, roleLabel, actions, section, side, children }: {
  title: string; subtitle?: string; nav: StaffNav[]; email: string; roleLabel?: string; actions?: React.ReactNode;
  section?: { label: string; items: StaffNav[] }; side?: { label: string; items: StaffNav[] }[]; children: React.ReactNode;
}) {
  const initials = (email.split("@")[0].match(/[a-z]/gi) ?? ["C"]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="stf af">
      <aside className="af-side" aria-label="Main">
        <a className="af-logo" href="/dashboard" aria-label="CDP home">CDP</a>
        <nav>
          {nav.map((n) => (
            <a key={n.href} href={n.href} aria-current={n.active ? "page" : undefined} title={n.label}><SIco k={n.icon} /><span>{n.label}</span></a>
          ))}
        </nav>
      </aside>
      <div className="af-col">
        <header className="af-top">
          <span className="af-crumb">{roleLabel ?? "Culture Dynamics Profile"}</span>
          <div className="af-user">
            <span className="af-mail" title={email}>{email}</span>
            <a href="/account/password">Password</a>
            <form action="/auth/signout" method="post"><button className="sbtn ghost">Sign out</button></form>
            <b className="af-avatar" aria-hidden="true">{initials}</b>
          </div>
        </header>
        <main className="af-main pt">
          <div className="af-head">
            <div>
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="af-actions">{actions}</div>}
          </div>
          {section && (
            <nav className="af-tabs" aria-label={section.label}>
              {section.items.map((n) => <a key={n.href} href={n.href} aria-current={n.active ? "page" : undefined}><SIco k={n.icon} /><span>{n.label}</span></a>)}
            </nav>
          )}
          {side ? (
            <div className="pt-layout">
              <nav className="pt-side" aria-label="This report">{side.map((g) => <div key={g.label}><h4>{g.label}</h4>{g.items.map((n) => <a key={n.href} href={n.href}><SIco k={n.icon} /><span>{n.label}</span></a>)}</div>)}</nav>
              <div className="pt-main">{children}</div>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}
