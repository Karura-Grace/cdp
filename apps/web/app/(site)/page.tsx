/* eslint-disable @typescript-eslint/no-explicit-any */
// Generated from the Claude Design file Home.dc.html (Desktop/cdp-v3/new-cdp-design). Edit freely; it is plain React now.
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-seo";
import SiteNav from "@/components/site/nav";
import NowPrefMini from "@/components/site/now-pref-mini";
import SiteFooter from "@/components/site/footer";
import { OrientationGrid } from "@/components/site/orientations";
import { FingerprintDemo, LivingStats, Magnetic, ParallaxDots } from "@/components/site/fingerprint-demo";
import GapBars from "@/components/site/gap-bars";
import EntryCards from "@/components/site/entry-cards";
import { Fragment } from "react";
import { Scene, CountUp } from "@/components/site/fx";
import SurveyVsCdp from "@/components/site/survey-vs-cdp";
import Faq from "@/components/site/faq";
import { HOME_FAQ } from "@/lib/faq";

// Headline: the words rise in one by one (CSS only, so the text is in the server HTML); the orange question lands after a short pause.
export const metadata: Metadata = pageMeta("/", "Culture Dynamics Profile (CDP) | Culture Assessment | PAC", "The Culture Dynamics Profile (CDP) by Priority Activator Consulting measures whether your culture can deliver your strategy, then tracks if it changes.");

const HEAD = ["Your", "strategy", "is", "written.", "Is", "your", "culture", "able", "to"];
const TAIL = ["deliver", "it?"];
const STEPS = [
  { name: "Assess", body: "Culture, leadership and employee voice, anonymously." },
  { name: "Diagnose", body: "Your Now profile, the one you need, and the gap." },
  { name: "Decide", body: "A strategic verdict and up to four priorities." },
  { name: "Act", body: "Owned actions and leader development plans." },
  { name: "Measure", body: "Pulses and re-assessment show whether it moved." },
];
// The five cards from current culture to action. Icons are line paths on a 24 grid, the same style as the steps in the race below.
const JOURNEY = [
  { title: "Current culture", badge: "NOW", badgeClass: "ink", acc: "#131313", dark: false, href: "/methodology#dna", go: "Learn more", text: "How people experience the organisation now.", icon: ["M9,10.5 A2.8,2.8 0 1 1 9.01,10.5 Z", "M3.5,19 V18 Q3.5,14.5 9,14.5 Q14.5,14.5 14.5,18 V19", "M16,9.5 A2.3,2.3 0 1 1 16.01,9.5 Z", "M17,14.2 Q20.5,14.4 20.5,17.5 V19"] },
  { title: "Preferred culture", badge: "PREFERRED", badgeClass: "orange", acc: "#C8401F", dark: false, href: "/methodology#dna", go: "Learn more", text: "The culture people believe the organisation needs to become.", icon: ["M6,20.5 V4", "M6,5 H17.5 L15,8.5 L17.5,12 H6"] },
  { title: "Culture Gap", badge: "GAP", badgeClass: "", acc: "#C8401F", dark: false, href: "/methodology#gap", go: "Learn more", text: "Where meaningful gaps exist, and where strategic tension lives.", icon: ["M5,12 A1.7,1.7 0 1 1 5.01,12 Z", "M19,12 A1.7,1.7 0 1 1 19.01,12 Z", "M8,12 H15", "M12.8,9.6 L15.2,12 L12.8,14.4"] },
  { title: "Strategic insight", badge: "INSIGHT", badgeClass: "", acc: "#131313", dark: false, href: "/methodology#measures", go: "Learn more", text: "Whether the culture supports the strategy you declared, and why.", icon: ["M9,18 H15", "M10,21 H14", "M12,3 A6,6 0 0 0 8.5,14 Q9,15 9,16.5 V18 H15 V16.5 Q15,15 15.5,14 A6,6 0 0 0 12,3 Z"] },
  { title: "Deliberate action", badge: "ACTION", badgeClass: "orange", acc: "#EB5733", dark: true, href: "/platform#act", go: "See the platform", text: "Owned priorities and leader plans, then proof of whether the culture moved.", icon: ["M5,7 L6.5,8.5 L9,6", "M12,7.5 H19", "M5,13 L6.5,14.5 L9,12", "M12,13.5 H19", "M5,19 H9", "M12,19 H19"] },
];
const STATS = [
  { value: 4, label: "strategy alignment checks" },
  { value: 4, label: "culture orientations" },
  { value: 9, label: "culture dimensions" },
  { value: 2, label: "perspectives: NOW and PREFERRED" },
  { value: 98, label: "data points per respondent" },
];

export default function HomePage() {
  return (
    <>


<div className="cdp" style={{ width: "100%", minHeight: "100vh", fontFamily: "var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313", background: "#FAF7F2" }}>
<SiteNav current="home" />

<main>
<section style={{ background: "#FAF7F2", position: "relative", overflow: "hidden" }}>
<ParallaxDots />
<div className="wrap grid-2 cdp-hero" style={{ alignItems: "start", paddingBlock: "clamp(16px, 2.4vw, 28px)", position: "relative", zIndex: 1 }}>
<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
<p className="eyebrow">Culture Dynamics Profile (CDP)</p>
<h1 className="display-xl" style={{ fontSize: "clamp(38px, 1.6rem + 2.6vw, 62px)" }}>
{HEAD.map((w, i) => (<Fragment key={i}><span className="cdp-word" style={{ animationDelay: `${120 + i * 45}ms` }}>{w}</span>{" "}</Fragment>))}
<span className="em-orange">{TAIL.map((w, i) => (<Fragment key={i}><span className="cdp-word" style={{ animationDelay: `${120 + HEAD.length * 45 + 320 + i * 90}ms` }}>{w}</span>{i < TAIL.length - 1 ? " " : ""}</Fragment>))}</span>
</h1>
<p className="lead cdp-rise" style={{ maxWidth: "600px", lineHeight: 1.55, fontSize: "clamp(17px, 1vw + 8px, 19px)", animationDelay: "800ms" }}>The Culture Dynamics Profile (CDP) is an organisational culture assessment from Priority Activator Consulting. It measures whether your culture can deliver your strategy, shows where it will resist, and names what to change first, with an owner and a deadline for every gap. Then it measures whether the culture actually moves.</p>
<div className="cdp-rise" style={{ display: "flex", flexWrap: "wrap", gap: "12px", animationDelay: "920ms" }}>
<Magnetic><a className="btn btn-primary btn-lg" rel="nofollow" href="/login?email=demo%40cdp-demo.example&amp;next=%2Fdashboard">See CDP in action<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></a></Magnetic>
<Magnetic><a className="btn btn-secondary btn-lg" href="#cycle">See how it works</a></Magnetic>
</div>
<p className="small cdp-rise" style={{ display: "flex", alignItems: "center", gap: "8px", animationDelay: "1040ms" }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#131313" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>Anonymous by design. Results are reported only for groups of five or more.</p>
</div>
<FingerprintDemo />
</div>
</section>

<section aria-label="CDP in numbers" style={{ background: "#FFFFFF", borderBlock: "1px solid #E6DFD4" }}>
<div className="wrap" style={{ paddingBlock: "22px" }}>
<LivingStats stats={STATS} />
</div>
</section>

<section className="section" id="cycle">
<Scene className="wrap" style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "900px" }}>
<p className="eyebrow">What CDP is</p>
<h2 className="display-l">Not a survey. A complete cycle from measurement to measured change.</h2>
<p className="lead">Most culture surveys stop at a chart. CDP connects what people experience to what the strategy requires, decides what to change, and checks whether it changed.</p>
</div>
<ol className="fd jstrip" style={{ "--fd-n": "5", "--fd-gap": "36px", "--fd-arrow-top": "44px", "--fd-arrow-left": "24px" } as any} aria-label="From current culture to action">
{JOURNEY.map((j, i) => (
<li key={j.title} style={{ display: "flex", "--i": i } as any}>
<a className={"jcard hcard" + (j.dark ? " ink" : "")} href={j.href} style={{ "--acc": j.acc } as any}>
<span className="jc-top" aria-hidden="true"></span>
<span className="jc-head"><span className="jc-icon" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24">{j.icon.map((d) => (<path key={d} d={d} pathLength={1} />))}</svg></span><span className="jc-no mono">{String(i + 1).padStart(2, "0")}</span></span>
<span className={"badge" + (j.badgeClass ? " " + j.badgeClass : "")} style={{ alignSelf: "flex-start" }}>{j.badge}</span>
<p className="h3 jc-title">{j.title}</p>
<p className="small jc-text">{j.text}</p>
<span className="hc-go">{j.go}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>
</a>
</li>))}
</ol>
</Scene>
</section>

<section className="section" style={{ paddingTop: 0 }}>
<Scene className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
<p className="eyebrow">Survey vs CDP</p>
<SurveyVsCdp steps={STEPS} />
</Scene>
</section>

<section className="section" style={{ background: "#FFFFFF", borderBlock: "1px solid #E6DFD4" }}>
<Scene className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "640px" }}><p className="eyebrow">What CDP reveals</p><h2 className="h1">Where you are, where you need to be, and the gap between</h2></div>
<span className="badge">Illustrative organisation</span>
</div>
<div className="grid-2" style={{ alignItems: "stretch" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
<p className="h4">Where strategic tension exists</p>
<GapBars />
</div>
<blockquote style={{ margin: "0", padding: "24px 26px", borderLeft: "3px solid #EB5733", background: "#FAF7F2", borderRadius: "0 12px 12px 0", display: "flex", flexDirection: "column", justifyContent: "center" }}>
<p style={{ margin: "0", font: "700 20px/1.4 var(--font-inter), 'Roboto', 'Open Sans', sans-serif" }}>The culture as measured does not yet support a strategy built on digital growth, principally because INNOVATE is the weakest orientation Now.</p>
<p className="caption" style={{ marginTop: "10px" }}>An example of the strategic insight CDP delivers, reviewed by a Culture Practitioner before release.</p>
</blockquote>
</div>
</Scene>
</section>

<section className="section">
<Scene className="wrap grid-2" style={{ alignItems: "start" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "24px" }}>
<p className="eyebrow">Culture Fingerprint</p>
<h2 className="h1">Every culture is a mix of four orientations</h2>
<p className="lead">Every organisation carries all four. CDP reveals the mix you have now, the mix your people believe you need, and where the two pull apart. That pattern is your Organisational DNA.</p>
<a className="btn btn-link" href="/methodology#orientations" style={{ alignSelf: "flex-start" }}>Explore the Culture Fingerprint</a>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
<OrientationGrid href="/methodology#orientations" />
</div>
</Scene>
</section>

<section className="section" id="dimensions" style={{ background: "#F3EEE6" }}>
<Scene className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "760px" }}><p className="eyebrow">Nine dimensions</p><h2 className="h1">Six dimensions of culture. Three of readiness.</h2><p className="lead">The first six show what the culture is. The last three show whether it can change.</p></div>
<div className="dimtables"><table className="dimt"><caption className="sr">Dimensions D1 to D3</caption><thead><tr><th scope="col">D1 to D3</th><th scope="col">Culture Score</th></tr></thead><tbody><tr><th scope="row"><span className="dim-code">D1</span><span className="dim-name"><a href="/methodology#dimensions">Cultural DNA</a></span><span className="dim-desc">Character, first impressions and how the organisation responds to adversity.</span></th><td><span className="dim-note">Read as NOW and PREFERRED</span><NowPrefMini /></td></tr><tr><th scope="row"><span className="dim-code">D2</span><span className="dim-name"><a href="/methodology#dimensions">Leadership Blueprint</a></span><span className="dim-desc">How leaders lead, where they spend their time and what they are recognised for.</span></th><td><span className="dim-note">Read as NOW and PREFERRED</span><NowPrefMini /></td></tr><tr><th scope="row"><span className="dim-code">D3</span><span className="dim-name"><a href="/methodology#dimensions">People Architecture</a></span><span className="dim-desc">Management philosophy, development and how performance conversations happen.</span></th><td><span className="dim-note">Read as NOW and PREFERRED</span><NowPrefMini /></td></tr></tbody></table><table className="dimt"><caption className="sr">Dimensions D4 to D6</caption><thead><tr><th scope="col">D4 to D6</th><th scope="col">Culture Score</th></tr></thead><tbody><tr><th scope="row"><span className="dim-code">D4</span><span className="dim-name"><a href="/methodology#dimensions">Cohesion Drivers</a></span><span className="dim-desc">What holds people together, why they stay and how identity survives change.</span></th><td><span className="dim-note">Read as NOW and PREFERRED</span><NowPrefMini /></td></tr><tr><th scope="row"><span className="dim-code">D5</span><span className="dim-name"><a href="/methodology#dimensions">Strategic Compass</a></span><span className="dim-desc">Strategic orientation, how resources are allocated and long-term investment logic.</span></th><td><span className="dim-note">Read as NOW and PREFERRED</span><NowPrefMini /></td></tr><tr><th scope="row"><span className="dim-code">D6</span><span className="dim-name"><a href="/methodology#dimensions">Victory Conditions</a></span><span className="dim-desc">How success is defined, celebrated and measured.</span></th><td><span className="dim-note">Read as NOW and PREFERRED</span><NowPrefMini /></td></tr></tbody></table><table className="dimt"><caption className="sr">Dimensions D7 to D9</caption><thead><tr><th scope="col">D7 to D9</th><th scope="col">Readiness check</th></tr></thead><tbody><tr className="is-readiness"><th scope="row"><span className="dim-code">D7</span><span className="dim-name"><a href="/methodology#dimensions">Digital Readiness</a></span><span className="dim-desc">Openness to digital tools and data-informed decisions.</span></th><td><span className="dim-range">Digitally resistant <span aria-hidden="true">→</span><span className="sr"> to </span> Digitally advanced</span><details className="dim-more"><summary aria-label="Show more"><span aria-hidden="true">...</span></summary><span className="dim-chip is-open">Not yet assessed</span></details></td></tr><tr className="is-readiness"><th scope="row"><span className="dim-code">D8</span><span className="dim-name"><a href="/methodology#dimensions">Psychological Safety</a></span><span className="dim-desc">Whether people can speak up and take risks without fear.</span></th><td><span className="dim-range">Fear-based culture <span aria-hidden="true">→</span><span className="sr"> to </span> Challenge culture: highly safe</span><details className="dim-more"><summary aria-label="Show more"><span aria-hidden="true">...</span></summary><span className="dim-chip is-open">Not yet assessed</span></details></td></tr><tr className="is-readiness"><th scope="row"><span className="dim-code">D9</span><span className="dim-name"><a href="/methodology#dimensions">Adaptive Capacity</a></span><span className="dim-desc">The organisation’s capacity to absorb and sustain change.</span></th><td><span className="dim-range">Critical resistance <span aria-hidden="true">→</span><span className="sr"> to </span> Strong readiness</span><details className="dim-more"><summary aria-label="Show more"><span aria-hidden="true">...</span></summary><span className="dim-chip is-open">Not yet assessed</span></details></td></tr></tbody></table></div>
</Scene>
</section>

<section className="section">
<Scene className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}><div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "640px" }}><p className="eyebrow">The 4D Framework</p><h2 className="h1">How PAC runs a CDP engagement</h2></div><a className="btn btn-secondary" href="/methodology#4d">Read the methodology</a></div>
<ol className="fd" aria-label="The 4D Framework: Diagnose, then Design, then Develop, then Deliver" style={{ "--fd-gap": "48px", "--fd-arrow-top": "36px", "--fd-arrow-left": "0px", borderTop: "1px solid #131313" } as any}>
<li className="hcard flat" style={{ "--hc-inset": "0px", padding: "24px 0", display: "flex", flexDirection: "column", gap: "10px" } as any}><span style={{ font: "700 44px/1 var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#EB5733" }}><CountUp n={1} /></span><p className="h3"><a className="stretch" href="/methodology#4d">Diagnose</a></p><p className="small">Set up the engagement with your executives, then measure the culture you have and the culture you need.</p><span className="hc-go">How it works<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></li>
<li className="hcard flat" style={{ "--hc-inset": "0px", padding: "24px 0", display: "flex", flexDirection: "column", gap: "10px" } as any}><span style={{ font: "700 44px/1 var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#EB5733" }}><CountUp n={2} /></span><p className="h3"><a className="stretch" href="/methodology#4d">Design</a></p><p className="small">Test the culture against your strategy, agree the verdict and choose up to four priorities.</p><span className="hc-go">How it works<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></li>
<li className="hcard flat" style={{ "--hc-inset": "0px", padding: "24px 0", display: "flex", flexDirection: "column", gap: "10px" } as any}><span style={{ font: "700 44px/1 var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#EB5733" }}><CountUp n={3} /></span><p className="h3"><a className="stretch" href="/methodology#4d">Develop</a></p><p className="small">Turn priorities into owned, dated actions and leader development plans.</p><span className="hc-go">How it works<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></li>
<li className="hcard flat" style={{ "--hc-inset": "0px", padding: "24px 0", display: "flex", flexDirection: "column", gap: "10px" } as any}><span style={{ font: "700 44px/1 var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#EB5733" }}><CountUp n={4} /></span><p className="h3"><a className="stretch" href="/methodology#4d">Deliver</a></p><p className="small">Track every action, pulse at 90 and 180 days, and re-assess at twelve months.</p><span className="hc-go">How it works<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></li>
</ol>
</Scene>
</section>

<section className="section">
<Scene className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "760px" }}><p className="eyebrow">What you walk away with</p><h2 className="h1">A verdict, the reasons, and what to do first</h2></div>
<div className="grid-3">
<div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}><p className="h3">Culture audit report</p><p className="small">Your Now profile and the one you need, the gaps, executive blindspots, readiness scores and the Transformation Preparedness Score, in a boardroom ready document and slide deck.</p></div>
<div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}><p className="h3">Hits and misses</p><p className="small">Four checks score your culture against your strategy, your KPIs, your change agenda and your business model. Every miss gets a named, time bound intervention.</p></div>
<div className="card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}><p className="h3">Transformation roadmap</p><p className="small">A phased plan built from your own data: foundation in the first 90 days, activation from month four to twelve, embedding in years two and three.</p></div>
</div>
</Scene>
</section>

<section className="section" style={{ background: "#131313", color: "#FAF7F2" }}>
<Scene className="wrap grid-2" style={{ alignItems: "center" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
<p className="eyebrow" style={{ color: "#EB5733" }}>What organisations receive</p>
<h2 className="h1">A report suite shaped to each audience</h2>
<p className="lead" style={{ color: "#B8B2A9" }}>Every report is reviewed and released by a certified Culture Practitioner before it reaches your organisation.</p>
</div>
<ul className="rep-list" style={{ listStyle: "none", margin: "0", padding: "0", display: "flex", flexDirection: "column" }}>
<li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "18px 0" }}><b>Board / Executive Summary</b><span className="small" style={{ color: "#B8B2A9", textAlign: "right" }}>Board and CEO</span></li>
<li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "18px 0" }}><b>Organisational Culture Report</b><span className="small" style={{ color: "#B8B2A9", textAlign: "right" }}>Entire organisation</span></li>
<li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "18px 0" }}><b>Sub-culture Reports</b><span className="small" style={{ color: "#B8B2A9", textAlign: "right" }}>Branches, departments and units</span></li>
<li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "18px 0" }}><b>Leader Reports</b><span className="small" style={{ color: "#B8B2A9", textAlign: "right" }}>Each leader</span></li>
<li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "18px 0" }}><b>Leadership-Team Report</b><span className="small" style={{ color: "#B8B2A9", textAlign: "right" }}>Entire leadership</span></li>
<li style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "18px 0" }}><b>Action Plan Report</b><span className="small" style={{ color: "#B8B2A9", textAlign: "right" }}>All levels, by role</span></li>
</ul>
</Scene>
</section>

<section className="section" id="trust">
<Scene className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "760px" }}><p className="eyebrow">Privacy and trust</p><h2 className="h1">Candour needs protection. CDP builds it in.</h2></div>
<div className="grid-4">
<div className="tp" style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "18px" }}><p className="h4">Unlinked at submission</p><p className="small">Your name is separated from your answers the moment you submit. It cannot be put back.</p></div>
<div className="tp" style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "18px" }}><p className="h4">Groups of five or more</p><p className="small">No result is shown for a group with fewer than five responses.</p></div>
<div className="tp" style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "18px" }}><p className="h4">No one sees your answers</p><p className="small">Not your manager, not your HR team, not PAC. Only group summaries exist.</p></div>
<div className="tp" style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "18px" }}><p className="h4">Data residency recorded</p><p className="small">Encrypted in transit and at rest, hosted in an EU cloud region, with the data transfer basis recorded for every organisation.</p></div>
</div>
</Scene>
</section>

<Faq items={HOME_FAQ} />

<section className="section" id="start" style={{ background: "#F3EEE6" }}>
<Scene className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "760px" }}><p className="eyebrow">Already invited?</p><h2 className="h1">Start here</h2></div>
<EntryCards />
</Scene>
</section>

<section style={{ background: "#C8401F", color: "#fff", padding: "clamp(24px, 4vw, 44px) 0" }}>
<Scene className="wrap" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "24px 40px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: "1 1 420px" }}>
<p className="sc-up" style={{ margin: "0", fontSize: "12px", fontWeight: "700", letterSpacing: ".14em", textTransform: "uppercase", opacity: "0.9" }}>Direct advisory: talk to a PAC consultant</p>
<h2 className="h1 sc-up" style={{ color: "#fff", "--i": "1" } as any}>Ready to activate your culture?</h2>
<p className="body sc-up" style={{ margin: "0", color: "rgba(255,255,255,.92)", maxWidth: "640px", "--i": "2" } as any}>Schedule a 15-minute briefing to see how the Culture Dynamics Profile™ can be tailored to your organisation.</p>
</div>
<div className="sc-up" style={{ display: "flex", flexWrap: "wrap", gap: "12px", "--i": "3" } as any}><Magnetic><a className="btn btn-lg" href="/contact" style={{ background: "#131313", color: "#fff" }}>Talk to us</a></Magnetic><Magnetic><a className="btn btn-outline-light btn-lg" href="/platform">See the platform</a></Magnetic></div>
</Scene>
</section>
</main>

<SiteFooter />
</div>

    </>
  );
}
