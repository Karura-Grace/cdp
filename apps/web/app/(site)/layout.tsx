import type { Metadata } from "next";
import "./cdp.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Culture Dynamics Profile (CDP) | Culture Assessment | PAC",
  description: "The Culture Dynamics Profile (CDP) by Priority Activator Consulting measures whether your culture can deliver your strategy, then tracks if it changes.",
  applicationName: "Culture Dynamics Profile",
  robots: { index: true, follow: true },
  openGraph: { type: "website", siteName: "Culture Dynamics Profile (CDP)", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
};

const ORG = "https://www.pac.africa/#organization";
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization", "@id": ORG, name: "Priority Activator Consulting", alternateName: ["PAC", "PAC Africa"], url: "https://www.pac.africa/",
      logo: "https://www.pac.africa/uploads/pac-logo-black.png",
      sameAs: ["https://www.linkedin.com/company/priority-activator-consulting/", "https://www.instagram.com/pac.africa/", "https://www.youtube.com/@pac.africa", "https://www.tiktok.com/@priorityactivator"],
    },
    {
      "@type": "WebSite", "@id": "https://cdp.pac.africa/#website", url: "https://cdp.pac.africa/", name: "Culture Dynamics Profile", inLanguage: "en",
      alternateName: ["CDP", "Culture Dynamics Profile (CDP)", "CDP by Priority Activator Consulting"], publisher: { "@id": ORG },
    },
    {
      "@type": "Service", "@id": "https://cdp.pac.africa/#service", name: "Culture Dynamics Profile (CDP)", serviceType: "Organisational culture assessment",
      description: "The Culture Dynamics Profile (CDP) is an organisational culture assessment from Priority Activator Consulting. It measures whether a culture can deliver the organisation's strategy, shows where the culture will resist, and sets owned, dated actions, then measures whether the culture moved.",
      url: "https://cdp.pac.africa/", provider: { "@id": ORG },
    },
  ],
};

// The public website, from the Claude Design pages. Its stylesheet is scoped under .cdp-site so it cannot reach the app's own screens.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  // Vercel Analytics counts visits to these public pages only (cookie free, no personal data). The survey, 360 and staff screens are outside this
  // layout on purpose, so nothing about respondents or their links is ever measured.
  return (
    <div className="cdp-site">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      {children}
      <Analytics />
    </div>
  );
}
