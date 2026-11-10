"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-html-link-for-pages */
// Generated from the Claude Design file Nav.dc.html (Desktop/cdp-v3/new-cdp-design). Edit freely; it is plain React now.
import { Fragment } from "react";
import { useState } from "react";

export default function SiteNav({ current = "none" }: { current?: string }) {
  const MENUS: [string, string, string][] = [["platform", "Platform", "/platform"], ["methodology", "Methodology", "/methodology"], ["solutions", "Solutions", "/solutions"], ["insights", "Insights", "/insights"]];
  const MLINKS: Record<string, [string, string][]> = {
    platform: [["Assess", "/platform#assess"], ["Diagnose", "/platform#diagnose"], ["Decide", "/platform#decide"], ["Act", "/platform#act"], ["Measure", "/platform#measure"]],
    methodology: [["The 4D Framework", "/methodology#4d"], ["Organisational DNA", "/methodology#dna"], ["Culture Fingerprint", "/methodology#orientations"], ["Nine dimensions", "/methodology#dimensions"], ["What CDP reveals", "/methodology#measures"]],
    solutions: [["Align culture to strategy", "/solutions#strategy"], ["Leadership behaviour gap", "/solutions#leadership"], ["Business-model change", "/solutions#model"], ["Readiness for transformation", "/solutions#readiness"], ["By role", "/solutions#roles"]],
    insights: [["Articles and research", "/insights#library"], ["The Cultural Pulse", "/insights#pulse"]],
  };
  const menuCur = current !== "none" && current !== "contact" ? current : null;
  const [open, setOpen] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [acc, setAcc] = useState<string | null>(null);
  const items = MENUS.map(([k, l, h]) => { const isOpen = open === k; return { label: l, href: h, exp: isOpen ? "true" : "false", caretLabel: (isOpen ? "Hide " : "Show ") + l + " menu",
    gcls: "mnav-group" + (isOpen ? " is-open" : ""), cls: "mnav-item" + (menuCur === k ? " is-current" : ""), toggle: () => setOpen(isOpen ? null : k), open: () => setOpen(k) }; });
  const mItems = MENUS.map(([k, l]) => ({ label: l, on: acc === k, exp: acc === k ? "true" : "false", rot: acc === k ? 180 : 0, cls: "acc-btn" + (menuCur === k ? " is-current" : ""),
    toggle: () => setAcc(acc === k ? null : k), links: MLINKS[k].map(([t, h]) => ({ t, href: h, cls: "msheet-link" })) }));
  const toggleMobile = () => { if (!mobile) setAcc(menuCur && MLINKS[menuCur] ? menuCur : "platform"); setMobile(!mobile); };
  const closeAll = () => setOpen(null);
  const onKey = (e: any) => { if (e.key === "Escape") { setOpen(null); setMobile(false); } };
  const onNavClick = (e: any) => { if (e.target?.closest?.("a[href]")) { setOpen(null); setMobile(false); } };
  const hdrCls = "cdp mnav is-fixed", spacerCls = "mnav-spacer";
  const isPlatform = open === "platform", isMethod = open === "methodology", isSolutions = open === "solutions", isInsights = open === "insights";
  const burgerLabel = mobile ? "Close menu" : "Open menu", mobileExp = mobile ? "true" : "false", notMobile = !mobile;
  return (
    <>


<div className="pacbar"><a href="https://www.pac.africa">A Priority Activator Consulting product <span aria-hidden="true">·</span> <b>Visit pac.africa ↗</b></a></div>
<div className={spacerCls} aria-hidden="true"></div>
<header className={hdrCls} style={{ width: "100%", fontFamily: "var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313" }} onKeyDown={onKey} onMouseLeave={closeAll} onClick={onNavClick}>
<div className="wrap mnav-bar">
<a className="logo" href="/" aria-label="Culture Dynamics Profile home"><img className="mnav-logo" src="/site/fdded5cc4af547478c085033c2008049.png" alt="CDP · Culture Dynamics Profile" /></a>
<nav className="mnav-links" aria-label="Main">
<div className="mnav-group is-home"><a className="mnav-item" href="/">Home</a></div>
{items.map((it: any, _i: number) => (<Fragment key={_i}>
<div className={it.gcls} onMouseEnter={it.open}><a className={it.cls} href={it.href}>{it.label}</a><button type="button" className="mnav-caret" aria-label={it.caretLabel} aria-expanded={it.exp} onClick={it.toggle}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></button></div>
</Fragment>))}
</nav>
<div className="mnav-right">
<a className="btn btn-primary btn-pill mnav-cta" rel="nofollow" href="/login?email=demo%40cdp-demo.example&amp;next=%2Fdashboard" style={{ minHeight: "44px", fontSize: "14px" }}>See CDP in action</a>
<button type="button" className="mnav-burger" aria-label={burgerLabel} aria-expanded={mobileExp} onClick={toggleMobile}>
{mobile && (<><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></>)}
{notMobile && (<><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h16"></path></svg></>)}
</button>
</div>
</div>

{isPlatform && (<>
<div className="mega" id="mega" role="region" aria-label="Platform">
<div className="wrap">
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "24px", paddingTop: "32px" }}>
<div><p className="eyebrow">Platform</p><p className="h3" style={{ marginTop: "6px" }}>One cycle, from assessment to measured change</p></div>
</div>
<div style={{ position: "relative", marginTop: "22px", height: "12px" }}>
<span style={{ position: "absolute", left: "4px", right: "4px", top: "5px", height: "2px", background: "linear-gradient(90deg,#131313 0%,#EB5733 100%)" }}></span>
<div style={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}><span style={{ width: "12px", height: "12px", borderRadius: "99px", background: "#131313" }}></span><span style={{ width: "12px", height: "12px", borderRadius: "99px", background: "#3B2A24" }}></span><span style={{ width: "12px", height: "12px", borderRadius: "99px", background: "#6E3A28" }}></span><span style={{ width: "12px", height: "12px", borderRadius: "99px", background: "#AE4A2D" }}></span><span style={{ width: "12px", height: "12px", borderRadius: "99px", background: "#EB5733" }}></span></div>
</div>
<div className="mega-in" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", paddingTop: "18px" }}>
<div className="mega-col"><a className="verb mega-head" href="/platform#assess"><i>01</i><b>Assess</b></a><ul className="mega-list is-plain"><li><b>Culture Assessment</b><span>NOW and PREFERRED across six culture dimensions</span></li><li><b>Leadership 360</b><span>Self and rater views of each leader in scope</span></li><li><b>Employee Orientation Survey</b><span>Anonymous employee voice, in their own words</span></li></ul></div>
<div className="mega-col"><a className="verb mega-head" href="/platform#diagnose"><i>02</i><b>Diagnose</b></a><ul className="mega-list is-plain"><li><b>Culture Profile</b><span>Your Organisational DNA on four orientations</span></li><li><b>Current vs Preferred</b><span>Where you are and where you need to be</span></li><li><b>Culture Gaps</b><span>Where strategic tension exists</span></li><li><b>9 Dimensions · 4 Orientations</b><span>The lenses CDP looks through</span></li></ul></div>
<div className="mega-col"><a className="verb mega-head" href="/platform#decide"><i>03</i><b>Decide</b></a><ul className="mega-list is-plain"><li><b>Strategic Alignment</b><span>Your culture tested against your strategy</span></li><li><b>Findings</b><span>Ranked by severity, each with its evidence</span></li><li><b>Strategic Verdict</b><span>Does the culture support the strategy?</span></li><li><b>Priority Areas</b><span>A focused set, with the trade-offs named</span></li></ul></div>
<div className="mega-col"><a className="verb mega-head" href="/platform#act"><i>04</i><b>Act</b></a><ul className="mega-list is-plain"><li><b>Action Planning</b><span>From finding to owned, dated action</span></li><li><b>Leader Development</b><span>Plans built from each leader’s 360</span></li><li><b>30 / 90 / 180 day actions</b><span>Reviews and escalation built in</span></li></ul></div>
<div className="mega-col"><a className="verb mega-head" href="/platform#measure"><i>05</i><b>Measure</b></a><ul className="mega-list is-plain"><li><b>Pulse Assessments</b><span>Targeted pulses at 90 and 180 days</span></li><li><b>Trend Comparison</b><span>Each cycle against your baseline</span></li><li><b>Re-assessment</b><span>The full profile, twelve months on</span></li><li><b>Culture Change</b><span>Did it move, and at what cost?</span></li></ul></div>
</div>
</div>
<div className="mega-foot"><div className="wrap" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", paddingBlock: "16px", flexWrap: "wrap" }}><p className="small" style={{ color: "#131313" }}><b>CDP drafts. People decide.</b> Every recommendation is reviewed by a certified Culture Practitioner before it reaches you.</p><span className="small">Anonymous by design · reported in groups of 5 or more</span></div></div>
</div>
</>)}

{isMethod && (<>
<div className="mega" role="region" aria-label="Methodology">
<div className="wrap mega-in" style={{ gridTemplateColumns: "1.3fr 1fr 1fr" }}>
<div className="mega-col"><p className="eyebrow"><a className="mega-head" href="/methodology#4d">The 4D Framework</a></p><ul className="mega-list is-plain"><li><b>Diagnose</b><span>Measure the culture you have and the one you need</span></li><li><b>Design</b><span>Test it against strategy and choose priorities</span></li><li><b>Develop</b><span>Turn priorities into owned actions and leader plans</span></li><li><b>Deliver</b><span>Track, pulse and re-assess until it moves</span></li></ul></div>
<div className="mega-col"><p className="eyebrow">Core concepts</p><ul className="mega-list"><li><a href="/methodology#dna"><b>Organisational DNA</b></a></li><li><a href="/methodology#gap"><b>Culture Gap</b></a></li><li><a href="/methodology#orientations"><b>Culture Fingerprint</b></a></li><li><a href="/methodology#dimensions"><b>Nine dimensions</b></a></li></ul></div>
<div className="mega-col"><p className="eyebrow"><a className="mega-head" href="/methodology#measures">What CDP reveals</a></p><ul className="mega-list is-plain"><li><b>Transformation Probability Score</b></li><li><b>Leader Readiness Index</b></li><li><b>Employee Orientation Survey</b></li><li><b>Strategic alignment</b></li></ul></div>
</div>
</div>
</>)}

{isSolutions && (<>
<div className="mega" role="region" aria-label="Solutions">
<div className="wrap mega-in" style={{ gridTemplateColumns: "2fr 1fr" }}>
<div className="mega-col"><p className="eyebrow">By organisational need</p><ul className="mega-list" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: "32px" }}><li><a href="/solutions#strategy"><b>Align culture to strategy</b><span>Does the culture you have now support the strategy you declared?</span></a></li><li><a href="/solutions#leadership"><b>Close the leadership behaviour gap</b><span>Leaders modelling the behaviours the strategy needs</span></a></li><li><a href="/solutions#systems"><b>Fix systems that fight the strategy</b><span>What to stop and start in rituals and HR systems</span></a></li><li><a href="/solutions#model"><b>Prepare for a business-model change</b><span>Readiness for the model you are moving to</span></a></li><li><a href="/solutions#readiness"><b>Test readiness before transformation</b><span>Can the organisation absorb change right now?</span></a></li><li><a href="/solutions#subcultures"><b>See sub-cultures and perception gaps</b><span>Where units, levels and leadership see it differently</span></a></li></ul></div>
<div className="mega-col"><p className="eyebrow"><a className="mega-head" href="/solutions#roles">By role</a></p><ul className="mega-list is-plain"><li><b>Boards and CEOs</b><span>A clear verdict and three findings that matter</span></li><li><b>CHROs and OD leaders</b><span>The full diagnosis and a governed plan</span></li><li><b>People leaders</b><span>Your report, your team, your development plan</span></li></ul></div>
</div>
</div>
</>)}

{isInsights && (<>
<div className="mega" role="region" aria-label="Insights">
<div className="wrap mega-in" style={{ gridTemplateColumns: "1fr 1fr 1.4fr" }}>
<div className="mega-col"><p className="eyebrow">Read</p><ul className="mega-list"><li><a href="/insights#articles"><b>Articles</b><span>Culture, strategy and leadership</span></a></li><li><a href="/insights#research"><b>Research</b><span>What PAC learns across engagements</span></a></li><li><a href="/insights#concepts"><b>Culture concepts</b><span>Plain-language explainers</span></a></li></ul></div>
<div className="mega-col"><p className="eyebrow">Subscribe</p><ul className="mega-list"><li><a href="/insights#pulse"><b>The Cultural Pulse</b><span>A monthly briefing for executive leadership</span></a></li></ul></div>
<a href="/insights#featured" className="hcard" style={{ boxShadow: "0 0 0 1px #E6DFD4", borderRadius: "12px", padding: "22px", textDecoration: "none", display: "flex", flexDirection: "column", gap: "10px", background: "#FAF7F2" }}><span className="badge" style={{ alignSelf: "flex-start" }}>Featured</span><span style={{ font: "700 22px/1.25 var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313" }}>Why a healthy headline can hide a warning sign</span><span className="small">What a positive overall picture can miss.</span><span className="hc-go">Read the article<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span></a>
</div>
</div>
</>)}


{mobile && (<>
<div className="mobile-sheet" role="dialog" aria-label="Menu">
<a className="acc-btn" href="/" style={{ textDecoration: "none" }}>Home</a>
{mItems.map((m: any, _i: number) => (<Fragment key={_i}>
<div>
<button type="button" className={m.cls} aria-expanded={m.exp} onClick={m.toggle}>{m.label}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{ transform: `rotate(${m.rot}deg)` }}><path d="m6 9 6 6 6-6"></path></svg></button>
{m.on && (<>
<ul style={{ listStyle: "none", margin: "0", padding: "8px 0 16px 14px", display: "flex", flexDirection: "column" }}>
{m.links.map((l: any, _i: number) => (<Fragment key={_i}><li><a className={l.cls} href={l.href}>{l.t}</a></li></Fragment>))}
</ul>
</>)}
</div>
</Fragment>))}
<div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingTop: "20px" }}>
<a className="btn btn-primary btn-block" rel="nofollow" href="/login?email=demo%40cdp-demo.example&amp;next=%2Fdashboard">See CDP in action</a>
</div>
</div>
</>)}
</header>

    </>
  );
}
