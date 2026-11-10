import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-seo";
import LegalPage from "@/components/site/legal";

export const metadata: Metadata = pageMeta("/cookies", "Cookie Policy | Culture Dynamics Profile", "The cookies and browser storage the Culture Dynamics Profile uses.");

// Matches middleware.ts (Supabase session cookie, cdp_seen idle cookie) and respond/flow.tsx (localStorage draft). Update when either changes.
export default function CookiesPage() {
  return (
    <LegalPage
      eyebrow="Cookie Policy"
      title="Cookies and browser storage"
      intro="We use only what is needed to keep signed-in users signed in and to save a survey draft on your own device. We do not use advertising or tracking cookies."
      updated="12 October 2026"
      sections={[
        { id: "public", title: "On this website", body: (<p>The public pages (home, platform, methodology, solutions, insights and contact) do not set cookies and we run no analytics on them.</p>) },
        { id: "signedin", title: "When you sign in", body: (<>
          <p>Signing in to the platform sets the cookies below. Both are needed for the platform to work, so there is nothing to switch off.</p>
          <table>
            <thead><tr><th>Name</th><th>What it does</th><th>Lasts</th></tr></thead>
            <tbody>
              <tr><td>sb-…-auth-token</td><td>Keeps you signed in (Supabase session).</td><td>Until you sign out, and no longer than 7 days.</td></tr>
              <tr><td>cdp_seen</td><td>Records your last page view so an idle session can end after 8 hours. Not readable by scripts.</td><td>Refreshed on each page view while signed in.</td></tr>
            </tbody>
          </table>
        </>) },
        { id: "survey", title: "Taking a survey", body: (<p>Survey respondents are not signed in and get no cookies. While you answer, a draft of your answers is saved in your browser’s local storage on your own device, so you can come back with the same link. It is removed when you submit, and it never leaves your device until you press Submit.</p>) },
        { id: "control", title: "Your choices", body: (<p>You can clear cookies and site storage in your browser settings at any time. Clearing the sign-in cookie signs you out. Because we use only these essential items, we do not show a cookie banner. More on how we handle personal data is in the <a href="/privacy">Privacy Policy</a>.</p>) },
        { id: "contact", title: "Questions", body: (<p>Write to <a href="mailto:hello@pac.africa">hello@pac.africa</a>.</p>) },
      ]}
    />
  );
}
