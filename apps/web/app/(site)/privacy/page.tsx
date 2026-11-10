import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-seo";
import LegalPage from "@/components/site/legal";

export const metadata: Metadata = pageMeta("/privacy", "Privacy Policy | Culture Dynamics Profile", "What the Culture Dynamics Profile collects, who sees it, where it is kept and for how long.");

// Drafted from what the platform does today (consent text, retention rules, hosting). Needs legal review before it is relied on.
export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy Policy"
      title="How the Culture Dynamics Profile handles personal data"
      intro="Priority Activator Consulting (PAC Africa) runs the Culture Dynamics Profile for organisations. This policy explains what is collected from visitors, platform users and survey respondents, who sees it, where it is kept and when it is destroyed."
      updated="12 October 2026"
      sections={[
        { id: "who", title: "Who we are", body: (<>
          <p>The Culture Dynamics Profile (CDP) is a method and platform of Priority Activator Consulting, the registered company name of PAC Africa. An organisation asks PAC to run a CDP engagement; PAC consultants prepare the report and the organisation’s leadership receives it.</p>
          <p>Which organisation decides what is collected and why, and which one acts on its behalf, is set out in the services contract for each engagement. Questions about this policy can be sent to <a href="mailto:hello@pac.africa">hello@pac.africa</a>.</p>
        </>) },
        { id: "collect", title: "What we collect", body: (<>
          <p><b>Visitors to this website.</b> The public pages need no account. The enquiry form opens your own email app with the details you typed, addressed to hello@pac.africa; the website does not store them. Our hosting provider keeps standard technical logs.</p>
          <p><b>People who sign in.</b> Consultants and client users (administrators, executives, people leaders and coaches) have a name, work email address and role. We record sign-in sessions and an audit log of actions taken in the platform.</p>
          <p><b>Survey respondents.</b> Your answers to the scenario questions (how you distribute 100 points), the rating questions, the experience questions and any typed comments. Typed comments are stored encrypted. Your name and email address are never stored with your answers. If your organisation set a group label for your link, such as a department or grade, it is stored with your answers so results can be reported by group. We also record your consent decision.</p>
          <p><b>Leadership 360.</b> Ratings and comments given by raters about a leader, and the leader’s own self view.</p>
        </>) },
        { id: "anonymity", title: "Anonymity of survey answers", body: (<>
          <p>When you submit, the link between your invitation and your answers is destroyed. After that, your answers cannot be individually found, retrieved or deleted, by you or by anyone else.</p>
          <ul>
            <li>No role, including PAC, can read an individual response.</li>
            <li>Results are never shown for a group of fewer than 5 people.</li>
            <li>Comments are quoted only when no one can be identified, and are reviewed before a leader sees them.</li>
          </ul>
        </>) },
        { id: "use", title: "How we use it", body: (<>
          <p>To run the engagement: to invite and sign in users, to produce group-level culture results, findings, action plans and leader reports, and to compare later pulses and re-assessments with the baseline.</p>
          <p>Survey results guide leadership decisions about culture. They are not used to assess, reward or discipline any individual, and leader reports can never be exported into pay, performance, succession or disciplinary decisions.</p>
        </>) },
        { id: "sharing", title: "Who sees it", body: (<>
          <p>PAC consultants prepare reports. A client organisation’s leadership receives group results only, and only after a certified Culture Practitioner has reviewed and released the report. A leader sees their own 360 result. A coach sees the plans of assigned leaders for the assignment period.</p>
          <p>We use service providers to host the platform: Supabase (database and sign-in), Vercel (website hosting) and Cloudflare (domain name service and file storage). They process data on our instructions.</p>
        </>) },
        { id: "where", title: "Where it is kept", body: (<>
          <p>Data is hosted in the EU (Ireland) and encrypted in transit and at rest. The basis for any transfer of data is recorded for each organisation. In-country hosting is not offered yet.</p>
        </>) },
        { id: "retention", title: "How long we keep it", body: (<>
          <p>Response-level data (answers, comments, invitations and consent records) is kept for 24 months after the survey closes and is then permanently destroyed, unless the organisation asks PAC in writing, before then, to keep it differently. The organisation’s administrator is notified 90 and 30 days beforehand and a destruction certificate is issued.</p>
          <p>Group results, findings, plans and action history contain no response rows. They are kept for the life of the client relationship plus 24 months, and are destroyed earlier on the organisation’s written request.</p>
        </>) },
        { id: "rights", title: "Your rights", body: (<>
          <p>Your rights under the data protection law that applies to your organisation include access to, correction of and objection to the processing of your personal data. To use them, write to <a href="mailto:hello@pac.africa">hello@pac.africa</a> or to your organisation’s data protection officer. You can also complain to the data protection authority that applies to you.</p>
          <p>Taking part in a survey is voluntary and has no consequence for you either way. If you decline, nothing is recorded except that the link was declined. Because submitted answers are unlinked from you, they cannot be individually located afterwards.</p>
        </>) },
        { id: "cookies", title: "Cookies", body: (<p>We use only the cookies needed to keep signed-in users signed in. See the <a href="/cookies">Cookie Policy</a>.</p>) },
        { id: "changes", title: "Changes to this policy", body: (<p>We will update this page when what we collect or how we protect it changes, and show the date at the top.</p>) },
      ]}
    />
  );
}
