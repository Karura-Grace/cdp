import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-seo";
import LegalPage from "@/components/site/legal";

export const metadata: Metadata = pageMeta("/security", "Security | Culture Dynamics Profile", "How the Culture Dynamics Profile protects anonymity and data.");

// States only controls that exist in the platform today. Do not add certifications, MFA or penetration-test claims until they are real.
export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Security"
      title="How the Culture Dynamics Profile protects data"
      intro="Anonymity is built into how the platform works. These are properties of the platform, not settings someone can switch off."
      updated="12 October 2026"
      sections={[
        { id: "anonymity", title: "Anonymity by design", body: (<>
          <ul>
            <li>The link between a person and their response is destroyed as the response is saved.</li>
            <li>Results appear only for groups of 5 or more, and comments are quoted only when no one can be identified.</li>
            <li>No role, including PAC, can read an individual response. This is enforced in the database, not only in the screens.</li>
          </ul>
        </>) },
        { id: "access", title: "Access control", body: (<>
          <p>Every user has a role, and the database decides which rows that role may read. Executives and people leaders see only what their role allows. Reports reach an organisation only after a Culture Practitioner has released them.</p>
          <p>Sessions end after 8 hours without activity and after 7 days in total.</p>
        </>) },
        { id: "data", title: "Protecting data", body: (<>
          <ul>
            <li>Hosted in the EU (Ireland), encrypted in transit and at rest.</li>
            <li>Typed comments are stored encrypted.</li>
            <li>Personal survey links are stored only as hashes.</li>
            <li>Exported reports carry a confidential marking.</li>
          </ul>
        </>) },
        { id: "audit", title: "Audit trail", body: (<>
          <p>Actions in the platform are written to an append-only audit log. Every query for results by group is logged, and the log cannot be deleted by platform users.</p>
        </>) },
        { id: "retention", title: "Destruction", body: (<>
          <p>Response-level data is permanently destroyed 24 months after the survey closes unless the organisation asks in writing for something different. See the <a href="/privacy#retention">Privacy Policy</a>.</p>
        </>) },
        { id: "report", title: "Reporting a security concern", body: (<>
          <p>If you think you have found a weakness, or that something has been exposed, write to <a href="mailto:hello@pac.africa">hello@pac.africa</a> with what you saw. Please do not access data that is not yours while investigating.</p>
        </>) },
      ]}
    />
  );
}
