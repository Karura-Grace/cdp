/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-seo";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import Faq from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";
import { BRAND_FAQ } from "@/lib/faq";

export const metadata: Metadata = pageMeta("/what-is-cdp", "What is CDP? Culture Dynamics Profile by PAC", "CDP at Priority Activator Consulting (PAC) means Culture Dynamics Profile: an organisational culture assessment that tests culture against strategy, then measures change.");

const GLANCE: [string, string][] = [
  ["Full name", "Culture Dynamics Profile (CDP)"],
  ["Made by", "Priority Activator Consulting (PAC)"],
  ["What it answers", "Can our culture deliver our strategy, where will it resist, and what should change first?"],
  ["Culture orientations", "4: Engage, Innovate, Perform, Govern"],
  ["Dimensions", "9: six culture dimensions and three readiness dimensions"],
  ["Perspectives", "2: Now and Preferred"],
  ["Data points per respondent", "98"],
  ["Anonymity rule", "Results shown only for groups of five or more"],
  ["Engagement model", "4D Framework: Diagnose, Design, Develop, Deliver"],
  ["Follow up", "Pulses at 90 and 180 days, reassessment at twelve months"],
];

const GRAPH = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebPage", "@id": "https://cdp.pac.africa/what-is-cdp#page", url: "https://cdp.pac.africa/what-is-cdp", name: "What is the Culture Dynamics Profile (CDP)?", isPartOf: { "@id": "https://cdp.pac.africa/#website" }, about: { "@id": "https://cdp.pac.africa/#service" }, inLanguage: "en" },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cdp.pac.africa/" },
      { "@type": "ListItem", position: 2, name: "What is CDP", item: "https://cdp.pac.africa/what-is-cdp" },
    ] },
  ],
};

export default function WhatIsCdpPage() {
  return (
    <div className="cdp" style={{ width: "100%", minHeight: "100vh", fontFamily: "var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313", background: "#FAF7F2" }}>
      <JsonLd data={GRAPH} />
      <SiteNav current="none" />
      <main>
        <section>
          <div className="enter wrap" style={{ paddingBlock: "clamp(24px, 3.4vw, 40px) 32px", display: "flex", flexDirection: "column", gap: "18px" }}>
            <p className="eyebrow">Culture Dynamics Profile (CDP)</p>
            <h1 className="display-l">What is the Culture Dynamics Profile (CDP) by Priority Activator Consulting?</h1>
            <p className="lead" style={{ maxWidth: "760px" }}>The Culture Dynamics Profile (CDP) is an organisational culture assessment from Priority Activator Consulting (PAC). It measures whether a culture can deliver the organisation&rsquo;s strategy, shows where the culture will resist, names what to change first with an owner and a deadline, and then measures whether the culture moved.</p>
            <div className="card" style={{ maxWidth: "760px", borderLeft: "3px solid #EB5733" }}>
              <p className="small"><b>Looking for a different CDP?</b> Here, CDP means Culture Dynamics Profile. It is not the contractor&rsquo;s design portion used in construction contracts, the Conflict Dynamics Profile, the Cultural Data Profile, the environmental disclosure nonprofit CDP, or a customer data platform.</p>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ maxWidth: "760px", display: "flex", flexDirection: "column", gap: "12px" }}><p className="eyebrow">CDP at a glance</p><h2 className="h1">The facts in one table</h2></div>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E6DFD4" }}>
              <caption className="sr">The Culture Dynamics Profile (CDP) at a glance</caption>
              <tbody>
                {GLANCE.map(([k, v]) => (
                  <tr key={k} style={{ borderTop: "1px solid #E6DFD4" }}>
                    <th scope="row" className="small" style={{ textAlign: "left", padding: "12px 16px", width: "34%", verticalAlign: "top" }}>{k}</th>
                    <td className="small" style={{ padding: "12px 16px" }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section" style={{ background: "#F3EEE6" }}>
          <div className="wrap grid-2" style={{ alignItems: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p className="eyebrow">How it works</p>
              <h2 className="h1">From measurement to measured change</h2>
              <p className="lead">Every engagement follows the <a href="/methodology#4d">4D Framework</a>: Diagnose, Design, Develop and Deliver. People answer anonymously, CDP shows the culture you have now and the culture you need, tests both against your strategy, and turns the gaps into owned, dated actions.</p>
              <p className="body">The <a href="/platform">Culture Dynamics Profile platform</a> runs the whole cycle in one place. The <a href="/methodology">CDP methodology</a> explains the four orientations, the nine dimensions and how to read the gap between Now and Preferred.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div className="card"><p className="h4">Assess and diagnose</p><p className="small">Culture, leadership and employee voice, measured anonymously. Your Now profile, the one you need, and the gap.</p></div>
              <div className="card"><p className="h4">Decide and act</p><p className="small">A strategic verdict and up to four priorities, with owned actions and leader development plans.</p></div>
              <div className="card"><p className="h4">Measure</p><p className="small">Pulses at 90 and 180 days and a reassessment at twelve months show whether the culture moved.</p></div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "820px" }}>
            <p className="eyebrow">Read more</p>
            <h2 className="h1">Go deeper on the Culture Dynamics Profile</h2>
            <p className="body"><a href="/insights/what-is-the-culture-dynamics-profile">A plain English guide to the Culture Dynamics Profile</a>, <a href="/insights/culture-assessment-vs-engagement-survey">culture assessment versus engagement survey</a> and <a href="/insights/current-vs-preferred-culture">how to read the gap between current and preferred culture</a>. Prefer to talk it through? <a href="/contact">Book a Culture Dynamics Profile briefing</a>.</p>
          </div>
        </section>

        <Faq items={BRAND_FAQ} eyebrow="CDP by PAC" title="Questions about CDP and Priority Activator Consulting" id="faq" />
      </main>
      <SiteFooter />
    </div>
  );
}
