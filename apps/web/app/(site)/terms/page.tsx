import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-seo";
import LegalPage from "@/components/site/legal";

export const metadata: Metadata = pageMeta("/terms", "Terms of Service | Culture Dynamics Profile", "The terms for using the Culture Dynamics Profile website and platform.");

// Drafted from how the platform works today. Liability, governing law and commercial terms live in each services contract and need legal review.
export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms of Service"
      title="Terms for using the Culture Dynamics Profile"
      intro="These terms cover use of this website and the Culture Dynamics Profile platform. A services contract for an engagement sets the commercial terms and prevails over this page where the two differ."
      updated="12 October 2026"
      sections={[
        { id: "service", title: "The service", body: (<>
          <p>The Culture Dynamics Profile (CDP) is a method and platform of Priority Activator Consulting, the registered company name of PAC Africa. The platform analyses survey responses. Certified Culture Practitioners interpret, challenge and release the results; nothing reaches an organisation until a practitioner has released it.</p>
        </>) },
        { id: "accounts", title: "Accounts and access", body: (<>
          <p>Access depends on your role. Keep your sign-in details to yourself and tell us at <a href="mailto:hello@pac.africa">hello@pac.africa</a> if you think they have been used by someone else. Sessions end after 8 hours without activity and after 7 days in total.</p>
          <p>Survey respondents do not need an account. A personal survey link belongs to the person it was sent to and should not be shared.</p>
        </>) },
        { id: "use", title: "Acceptable use", body: (<>
          <p>You agree not to:</p>
          <ul>
            <li>try to identify a survey respondent, or to reverse the anonymity protections;</li>
            <li>access data or roles you have not been given, or probe the platform for weaknesses without our written permission;</li>
            <li>use leader results in pay, performance, succession or disciplinary decisions;</li>
            <li>copy or scrape the platform or this website, or resell the method or its reports.</li>
          </ul>
        </>) },
        { id: "survey", title: "Taking part in a survey", body: (<>
          <p>Taking part is voluntary. Your consent is recorded before the first question and you can stop at any time before you submit. What happens to your answers is described in the <a href="/privacy">Privacy Policy</a> and in the consent text shown before the survey.</p>
        </>) },
        { id: "ip", title: "Ownership", body: (<>
          <p>The four orientations, the nine dimensions, the method and the platform are PAC’s own work. Reports delivered to an organisation may be used by that organisation for its own internal purposes under its services contract.</p>
        </>) },
        { id: "availability", title: "Availability and accuracy", body: (<>
          <p>We work to keep the platform available but do not promise it will be uninterrupted. Results describe how people in an organisation responded at a point in time and are an input to leadership judgement, not a prediction. Nothing in these terms limits any liability that cannot be limited by law; other limits are set in the services contract.</p>
        </>) },
        { id: "changes", title: "Changes and contact", body: (<>
          <p>We may update these terms and will show the date at the top. Questions go to <a href="mailto:hello@pac.africa">hello@pac.africa</a>.</p>
        </>) },
      ]}
    />
  );
}
