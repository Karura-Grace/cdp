// Generated from the Claude Design file Platform.dc.html (Desktop/cdp-v3/new-cdp-design). Edit freely; it is plain React now.
import type { Metadata } from "next";
import { pageMeta } from "@/lib/site-seo";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import GapBars from "@/components/site/gap-bars";
import PhoneDemo from "@/components/site/phone-demo";
import MeasureTimeline from "@/components/site/measure-timeline";

export const metadata: Metadata = pageMeta("/platform", "CDP Platform: Assess, Diagnose, Decide, Act, Measure", "See how the Culture Dynamics Profile platform runs the full cycle: anonymous assessment, strategic verdict, owned actions and measured change.");

export default function PlatformPage() {
  return (
    <>


<div className="cdp" style={{ width: "100%", minHeight: "100vh", fontFamily: "var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313", background: "#FAF7F2" }}>
<SiteNav current="platform" />
<main>

<section>
<div className="enter wrap" style={{ paddingBlock: "clamp(24px, 3.4vw, 40px) 24px", display: "flex", flexDirection: "column", gap: "22px" }}>
<p className="eyebrow">Platform</p>
<h1 className="display-l">One platform for the whole culture cycle</h1>
<p className="lead" style={{ maxWidth: "760px" }}>CDP runs an engagement from the first executive workshop to the re-assessment a year later. Each stage has a gate, so nothing moves on until it is ready.</p>
<nav aria-label="On this page" style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" }}>
<a className="chip" href="#assess">01 Assess</a><a className="chip" href="#diagnose">02 Diagnose</a><a className="chip" href="#decide">03 Decide</a><a className="chip" href="#act">04 Act</a><a className="chip" href="#measure">05 Measure</a><a className="chip" href="#access">Who sees what</a>
</nav>
</div>
</section>

<section aria-label="Engagement lifecycle">
<div className="wrap" style={{ paddingBottom: "clamp(28px, 3.5vw, 40px)" }}>
<ol style={{ listStyle: "none", margin: "0", padding: "0", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: "12px" }}>
<li style={{ display: "flex" }}><a className="card hcard" href="#assess" style={{ flex: "1", padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}><span className="caption mono">Stage 1</span><b>Setup</b><span className="small">Strategy, structure and survey design agreed with your executives.</span><span className="caption" style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px dashed #CFC6B9", color: "#131313", fontWeight: "600" }}>Gate · launch checks pass</span></a></li>
<li style={{ display: "flex" }}><a className="card hcard" href="#assess" style={{ flex: "1", padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}><span className="caption mono">Stage 2</span><b>Assessment</b><span className="small">Culture survey and Leadership 360, open long enough for everyone to take part.</span><span className="caption" style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px dashed #CFC6B9", color: "#131313", fontWeight: "600" }}>Gate · window closes, responses secured</span></a></li>
<li style={{ display: "flex" }}><a className="card hcard" href="#diagnose" style={{ flex: "1", padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}><span className="caption mono">Stage 3</span><b>Analysis</b><span className="small">Responses become your culture profile, consistently and securely.</span><span className="caption" style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px dashed #CFC6B9", color: "#131313", fontWeight: "600" }}>Gate · results reviewed</span></a></li>
<li style={{ display: "flex" }}><a className="card hcard" href="#decide" style={{ flex: "1", padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}><span className="caption mono">Stage 4</span><b>Findings and reporting</b><span className="small">Checks against strategy, findings and the report suite.</span><span className="caption" style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px dashed #CFC6B9", color: "#131313", fontWeight: "600" }}>Gate · released by PAC</span></a></li>
<li style={{ display: "flex" }}><a className="card hcard" href="#act" style={{ flex: "1", padding: "18px", display: "flex", flexDirection: "column", gap: "8px" }}><span className="caption mono">Stage 5</span><b>Action planning</b><span className="small">Priorities, owners, dates and leader plans.</span><span className="caption" style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px dashed #CFC6B9", color: "#131313", fontWeight: "600" }}>Gate · plan approved</span></a></li>
<li style={{ display: "flex" }}><a className="card hcard ink" href="#measure" style={{ flex: "1", padding: "18px", display: "flex", flexDirection: "column", gap: "8px", background: "#131313", color: "#FAF7F2" }}><span className="caption mono" style={{ color: "#B8B2A9" }}>Stage 6</span><b>Re-assessment</b><span className="small" style={{ color: "#B8B2A9" }}>Pulses, triggers and the next full cycle.</span><span className="caption" style={{ marginTop: "auto", paddingTop: "10px", borderTop: "1px dashed rgba(250,247,242,.3)", color: "#EB5733", fontWeight: "600" }}>Loops to the next cycle ↺</span></a></li>
</ol>
</div>
</section>

<section id="assess" className="section" style={{ background: "#FFFFFF", borderBlock: "1px solid #E6DFD4" }}>
<div className="wrap grid-2" style={{ alignItems: "center" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
<div className="verb"><i>01</i><b>Assess</b></div>
<h2 className="h1">Capture candid data, and make it impossible to trace</h2>
<ul style={{ margin: "0", padding: "0", display: "flex", flexDirection: "column", gap: "10px" }} className="body">
<li><b style={{ color: "#131313" }}>Culture Assessment.</b> Real workplace scenarios that capture how the organisation feels now and what people believe it must become.</li>
<li><b style={{ color: "#131313" }}>Readiness.</b> How prepared the organisation is for change: Digital Readiness, Psychological Safety and Adaptive Capacity.</li>
<li><b style={{ color: "#131313" }}>Employee Orientation Survey.</b> How people feel about the organisation, including in their own words.</li>
<li><b style={{ color: "#131313" }}>Leadership 360.</b> A self view and rater views for each leader in scope.</li>
</ul>
<p className="small">Designed for a phone first, completable with a keyboard or a screen reader. Answers save as you go.</p>
</div>
<PhoneDemo />
</div>
</section>

<section id="diagnose" className="section">
<div className="wrap grid-2" style={{ alignItems: "center" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "18px", order: "2" }}>
<div className="verb"><i>02</i><b>Diagnose</b></div>
<h2 className="h1">See your culture profile, the culture you need, and every gap</h2>
<p className="lead">CDP shows where the culture you have and the culture you need pull apart: what needs more emphasis, what needs less, and what to protect. It also shows where executives, staff and units experience the same organisation differently.</p>
<p className="small">Small groups are never shown, so no one can be identified.</p>
</div>
<div className="card" style={{ display: "flex", flexDirection: "column", gap: "14px", order: "1" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p className="h4">Culture Gap</p><span className="badge">Illustrative</span></div>
<GapBars />
<div className="rule"></div>
<p className="caption" style={{ color: "#131313", fontWeight: "700", letterSpacing: ".1em" }}>READINESS FOR CHANGE</p>
<div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "12px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><p className="caption">Digital Readiness</p><b style={{ fontSize: "15px" }}>Moderately ready</b></div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><p className="caption">Psychological Safety</p><b style={{ fontSize: "15px", color: "#B23A17" }}>Cautious / selective candour</b></div>
<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><p className="caption">Adaptive Capacity</p><b style={{ fontSize: "15px" }}>Moderate readiness: targeted enablement</b></div>
</div>
</div>
</div>
</section>

<section id="decide" className="section" style={{ background: "#131313", color: "#FAF7F2" }}>
<div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
<div className="grid-2" style={{ alignItems: "end" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "18px" }}><div className="verb"><i style={{ color: "#EB5733" }}>03</i><b>Decide</b></div><h2 className="h1">Your culture, tested against your strategy</h2></div>
<p className="lead" style={{ color: "#B8B2A9" }}>CDP tests the culture against what your executives declared in setup: the strategy, the leadership behaviours it needs, the systems that reinforce it and the business model. Findings are ranked by severity, each with its evidence.</p>
</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: "14px" }}>
<a className="hcard ink" href="/solutions#strategy" style={{ border: "1px solid rgba(250,247,242,.18)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><b>Performance alignment</b><span className="small" style={{ color: "#B8B2A9" }}>Does the culture have enough of what the strategic priorities require?</span><span className="hc-go">Explore the solution<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></a>
<a className="hcard ink" href="/solutions#leadership" style={{ border: "1px solid rgba(250,247,242,.18)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><b>Behaviour gap</b><span className="small" style={{ color: "#B8B2A9" }}>Do leaders and people practices model the behaviours the strategy needs?</span><span className="hc-go">Explore the solution<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></a>
<a className="hcard ink" href="/solutions#systems" style={{ border: "1px solid rgba(250,247,242,.18)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><b>Stop / start</b><span className="small" style={{ color: "#B8B2A9" }}>Do bonding and recognition rituals pull against the direction of travel?</span><span className="hc-go">Explore the solution<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></a>
<a className="hcard ink" href="/solutions#model" style={{ border: "1px solid rgba(250,247,242,.18)", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "8px" }}><b>Business-model readiness</b><span className="small" style={{ color: "#B8B2A9" }}>Is the culture ready for the business model you run, or the one you are moving to?</span><span className="hc-go">Explore the solution<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></a>
</div>
</div>
</section>

<section id="act" className="section">
<div className="wrap grid-2" style={{ alignItems: "center" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
<div className="verb"><i>04</i><b>Act</b></div>
<h2 className="h1">CDP drafts. People decide.</h2>
<p className="lead">CDP proposes priorities, pathways and draft actions from the findings. Your executives and PAC consultant choose, edit and approve them. Nothing is published while a blocking condition is open.</p>
<ul style={{ margin: "0", padding: "0", display: "flex", flexDirection: "column", gap: "8px" }} className="body">
<li>Priority zero: the pre-conditions to clear first, owned by the CEO and CHRO within 30 days.</li>
<li>Up to four priorities, sized to your readiness, with the trade-offs named.</li>
<li>Actions at individual, team, unit and organisation level, each with an owner, date and KPI.</li>
<li>Leader Development Plans built from each leader’s 360.</li>
</ul>
</div>
<div className="panel" style={{ padding: "22px", display: "flex", flexDirection: "column", gap: "12px" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p className="h4">Organisation plan</p><span className="badge">Illustrative</span></div>
<div style={{ border: "1px solid #E6DFD4", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}><div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span className="caption mono">Priority zero · 30 days</span><span className="badge ink">Blocking</span></div><b>Listening sessions where employee voice signals concern</b><span className="caption">Owner CEO + CHRO</span></div>
<div style={{ border: "1px solid #E6DFD4", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}><div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span className="caption mono">Priority 1 · ENGAGE</span><span className="badge orange">Draft not reviewed</span></div><b>Coach-first manager programme</b><span className="caption">Owner: CHRO · linked KPI: voluntary attrition</span></div>
<div style={{ border: "1px solid #E6DFD4", borderRadius: "10px", padding: "14px", display: "flex", flexDirection: "column", gap: "6px" }}><div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}><span className="caption mono">Visible signal · 30 days</span><span className="badge hit">✓ Approved</span></div><b>CEO recognises a manager for developing talent</b><span className="caption">Owner CEO</span></div>
</div>
</div>
</section>

<section id="measure" className="section" style={{ background: "#F3EEE6" }}>
<div className="wrap grid-2" style={{ alignItems: "center" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
<div className="verb"><i>05</i><b>Measure</b></div>
<h2 className="h1">Know whether the culture actually moved</h2>
<p className="lead">Short pulses at 90 and 180 days track the items that matter for each priority. At twelve months, or sooner if a trigger is accepted, CDP re-runs the full profile and compares it with your baseline.</p>
<p className="small">Trade-off verification checks for unintended movement, such as an orientation you meant to protect falling. CDP reports movement and delivery side by side and never claims an action caused a movement.</p>
</div>
<MeasureTimeline />
</div>
</section>

<section id="access" className="section">
<div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
<div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "760px" }}><p className="eyebrow">Who sees what</p><h2 className="h1">Each role sees what it needs, and nothing more</h2><p className="lead">No one, including PAC, can read an individual response. Reports reach your organisation only after a Culture Practitioner releases them.</p></div>
<div className="tscroll" style={{ background: "#fff", border: "1px solid #E6DFD4", borderRadius: "12px" }}>
<table className="tbl" style={{ minWidth: "720px" }}>
<thead><tr><th style={{ paddingLeft: "20px" }}>Role</th><th>Sees</th></tr></thead>
<tbody>
<tr><td style={{ paddingLeft: "20px", color: "#131313", fontWeight: "700" }}>Board and executives</td><td>Released organisational and sub-culture reports, the leadership-team aggregate, the organisation plan, their own leader report and those of their direct reports.</td></tr>
<tr><td style={{ paddingLeft: "20px", color: "#131313", fontWeight: "700" }}>CHRO and setup owner</td><td>Setup, invitations and action administration. Aggregate results after release.</td></tr>
<tr><td style={{ paddingLeft: "20px", color: "#131313", fontWeight: "700" }}>People leaders</td><td>Their own leader report, their team’s report where the team is large enough to protect anonymity, their development plan and unit actions.</td></tr>
<tr><td style={{ paddingLeft: "20px", color: "#131313", fontWeight: "700" }}>Coaches</td><td>Reports and development plans of assigned leaders, for the assignment period only.</td></tr>
<tr><td style={{ paddingLeft: "20px", color: "#131313", fontWeight: "700" }}>Employees</td><td>Their own survey and consent record, and the published summary if your organisation shares it.</td></tr>
</tbody>
</table>
</div>
<div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}><a className="btn btn-primary btn-lg" href="/contact">Talk to us</a><a className="btn btn-secondary btn-lg" href="/methodology">Explore the methodology</a></div>
</div>
</section>
</main>
<SiteFooter />
</div>

    </>
  );
}
