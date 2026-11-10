"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-html-link-for-pages */
// Generated from the Claude Design file Insights.dc.html (Desktop/cdp-v3/new-cdp-design). Edit freely; it is plain React now.
import { Fragment } from "react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { ARTICLES } from "@/lib/insights";
import { useEffect, useState } from "react";

const BY_HASH: Record<string, string> = { articles: "Article", research: "Research", concepts: "Culture concepts", library: "All" };

export default function InsightsPage() {
  const ARTS = [
    ["Article", "Current and Preferred: two pictures of one organisation", "What it means when the culture people live and the culture they want pull apart."],
    ["Culture concepts", "The release side of the trade-off", "When less of an orientation is exactly what the strategy needs."],
    ["Article", "Psychological safety as a gate, not a goal", "Why some priorities cannot start until people can speak up."],
    ["Research", "Shadow cultures: when executives and staff see different organisations", "What a large perception gap tells a board, and what it does not."],
    ["Article", "The visible signal", "Changing one recognition ritual in 30 days, and why it matters more than a programme launch."],
    ["Culture concepts", "Reading a Culture Fingerprint", "What the shape of your culture says about how your organisation really works."],
  ];
  const [f, setF] = useState("All");
  useEffect(() => {
    const h = () => { const x = BY_HASH[(location.hash || "").slice(1)]; if (x) setF(x); };
    h(); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h);
  }, []);
  const filters = ["All", "Article", "Research", "Culture concepts"].map((l) => ({ label: l, sel: f === l ? "true" : "false", cls: f === l ? "chip is-on" : "chip", pick: () => setF(l) }));
  const items = ARTS.filter((x) => f === "All" || x[0] === f).map((x) => ({ cat: x[0], title: x[1], dek: x[2], href: "#" + ({ Article: "articles", Research: "research", "Culture concepts": "concepts" } as Record<string, string>)[x[0]] }));
  const count = items.length + (items.length === 1 ? " item" : " items");
  return (
    <>


<div className="cdp" style={{ width: "100%", minHeight: "100vh", fontFamily: "var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313", background: "#FAF7F2" }}>
<SiteNav current="insights" />
<main>
<section>
<div className="enter wrap" style={{ paddingBlock: "clamp(24px, 3.4vw, 40px) 32px", display: "flex", flexDirection: "column", gap: "18px" }}>
<p className="eyebrow">Insights</p>
<h1 className="display-l ins-h">Thinking on culture, strategy and change</h1>
<p className="lead ins-lead" style={{ maxWidth: "720px" }}>Articles, research and plain-language explainers from PAC’s culture practice.</p>
</div>
</section>

<section id="published">
<div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "24px" }}>
<p className="eyebrow">Latest</p>
<div className="grid-3">
{ARTICLES.map((a) => (
<a key={a.slug} href={`/insights/${a.slug}`} className="card hcard" style={{ display: "flex", flexDirection: "column", gap: "12px", textDecoration: "none" }}>
<span className="eyebrow mute">{a.kind}</span>
<span style={{ font: "700 22px/1.25 var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313" }}>{a.title}</span>
<span className="small">{a.dek}</span>
<span className="hc-go">Read the article</span>
</a>
))}
</div>
</div>
</section>

<section id="featured">
<div className="wrap">
<a href="#library" className="hcard ink" style={{ "--hc-inset": "32px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", background: "#131313", color: "#FAF7F2", borderRadius: "20px", overflow: "hidden", textDecoration: "none" } as any}>
<div style={{ padding: "clamp(24px, 4vw, 48px)", display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px" }}>
<span className="badge orange" style={{ alignSelf: "flex-start" }}>Featured · Article</span>
<p className="h1">Why a healthy headline can hide a warning sign</p>
<p className="body" style={{ color: "#B8B2A9" }}>A positive overall picture can hide pockets of real concern in how people feel. CDP brings those signals to the surface, so leaders listen before they act.</p>
<span className="hc-go">Coming soon<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>
</div>
</a>
</div>
</section>

<section className="section" id="articles" style={{ position: "relative" }}>
<span id="library" style={{ position: "absolute", top: "0" }}></span><span id="research" style={{ position: "absolute", top: "0" }}></span><span id="concepts" style={{ position: "absolute", top: "0" }}></span>
<div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
<div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
<div role="tablist" aria-label="Filter" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
{filters.map((f: any, _i: number) => (<Fragment key={_i}><button type="button" role="tab" aria-selected={f.sel} className={f.cls} onClick={f.pick} style={{ cursor: "pointer", fontFamily: "inherit" }}>{f.label}</button></Fragment>))}
</div>
<span className="small">{count}</span>
</div>
<div className="grid-3">
{items.map((a: any, _i: number) => (<Fragment key={_i}>
<a href={a.href} className="card hcard" style={{ display: "flex", flexDirection: "column", gap: "14px", textDecoration: "none", minHeight: "240px" }}>
<span className="eyebrow mute">{a.cat}</span>
<span style={{ font: "700 22px/1.25 var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313" }}>{a.title}</span>
<span className="small">{a.dek}</span>
<span className="hc-go">Coming soon<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg></span>
</a>
</Fragment>))}
</div>
</div>
</section>
</main>
<SiteFooter />
</div>

    </>
  );
}
