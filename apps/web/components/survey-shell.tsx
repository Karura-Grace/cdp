import "@/app/respond/invite.css";
import "@/app/respond/survey.css";
import { RightsLink } from "./rights-link";

// Frame for every respondent screen after the invitation: the same paper top bar as the invitation, content on paper.
export function SurveyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sv">
      <header className="inv-top">
        <span className="inv-logo" aria-label="CDP">CDP<span>.</span></span>
        <span className="inv-lock">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          Secure and anonymous
        </span>
      </header>
      <main className="wrap">{children}</main>
      <footer className="inv-foot"><RightsLink /> · Priority Activator Consulting · Culture Dynamics Profile</footer>
    </div>
  );
}
