"use client";

import { useEffect, useState } from "react";

// The interactive parts of the assessment preview (Claude Design export, owner Q-D9-43 to Q-D9-46): the contents list that follows
// the scroll, the consultant's dimension tabs with their scenarios, and the top bar search that jumps to a dimension.

export type Scen = { title: string; now: string; pref: string; opts: { name: string; colour: string; text: string | null }[] };
export type Dim = { code: string; name: string; desc: string; scens: Scen[] };

const go = (id: string) => {
  const el = document.getElementById(id); if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: reduce ? "auto" : "smooth" });
};

export function Toc({ items, className = "apv-toc" }: { items: [string, string, string][]; className?: string }) {
  const [cur, setCur] = useState(items[0][0]);
  useEffect(() => {
    let raf = 0;
    const spy = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        let c = items[0][0];
        for (const [id] of items) { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) c = id; }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) c = items[items.length - 1][0];
        setCur(c);
      });
    };
    window.addEventListener("scroll", spy, { passive: true }); spy();
    return () => window.removeEventListener("scroll", spy);
  }, [items]);
  return (
    <nav className={className} aria-label="Parts of the assessment">
      {items.map(([id, n, label]) => <a key={id} className={cur === id ? "is-on" : ""} href={`#${id}`} aria-current={cur === id ? "location" : undefined} onClick={(e) => { e.preventDefault(); setCur(id); go(id); }}><i>{n}</i>{label}</a>)}
    </nav>
  );
}

export function DimSearch({ dims }: { dims: { code: string; name: string }[] }) {
  const [q, setQ] = useState("");
  return (
    <label className="cv-search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <span className="sr">Find a dimension</span>
      <input type="search" placeholder="Find a dimension, e.g. Leadership" value={q} onChange={(e) => {
        setQ(e.target.value);
        const t = e.target.value.trim().toLowerCase(), hit = t ? dims.find((d) => `${d.code} ${d.name}`.toLowerCase().includes(t)) : null;
        if (hit) { window.dispatchEvent(new CustomEvent("cdp-dim", { detail: hit.code })); go("part1"); }
      }} />
    </label>
  );
}

export function DimTabs({ dims }: { dims: Dim[] }) {
  const [code, setCode] = useState(dims[0]?.code ?? "D1");
  useEffect(() => { const f = (e: Event) => setCode((e as CustomEvent<string>).detail); window.addEventListener("cdp-dim", f); return () => window.removeEventListener("cdp-dim", f); }, []);
  const cur = dims.find((d) => d.code === code) ?? dims[0];
  if (!cur) return null;
  return (
    <>
      <div className="apv-dtabs" role="tablist" aria-label="Culture dimensions">
        {dims.map((d) => <button key={d.code} type="button" role="tab" className={d.code === code ? "is-on" : ""} aria-selected={d.code === code} onClick={() => setCode(d.code)}><b>{d.code}</b><span>{d.name}</span></button>)}
      </div>
      <div className="apv-dhead"><span className="apv-code">{cur.code}</span><div><h3>{cur.name}</h3><p>{cur.desc}</p></div><div className="apv-tags" style={{ margin: 0, padding: 0 }}><span className="apv-tag is-now">NOW</span><span className="apv-tag is-pref">PREFERRED</span><span className="apv-tag">Three scenarios each</span></div></div>
      {cur.scens.map((sc, i) => (
        <article key={i} className="apv-scen">
          <div className="apv-scen-h"><span className="apv-snum">{i + 1}</span><h4>Scenario {i + 1}: {sc.title}</h4></div>
          <div className="apv-qs2"><p className="apv-qnow"><b>NOW</b>{sc.now}</p><p className="apv-qpref"><b>PREFERRED</b>{sc.pref}</p></div>
          <div className="apv-opts">
            {sc.opts.map((o) => <div key={o.name} className="apv-opt" style={o.text === null ? { opacity: 0.6 } : undefined}><span className="apv-oname" style={{ color: o.colour }}><i style={{ background: o.colour }} />{o.name}</span><p>{o.text ?? "Statement not in the published version."}</p></div>)}
          </div>
        </article>
      ))}
      {!cur.scens.length && <div className="apv-scen apv-empty">No scenarios for {cur.code} in the published version.</div>}
    </>
  );
}
