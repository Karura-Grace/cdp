import { DashShell, More, Svg } from "@/components/dash-shell";
import type { StaffNav } from "@/components/staff-shell";
import { DIMS, QUAL_TITLES, WHYS } from "@/lib/respond-copy";
import { CV_ILL, CV_STAT } from "./art";
import { DimSearch, DimTabs, Toc, type Dim } from "./instrument";

// The assessment preview for the Client Admin and the PAC Consultant (Claude Design exports "Client admin · Assessment preview" and
// "PAC consultant · Assessment preview", owner Q-D9-43 to Q-D9-46, 5 Nov 2026). The Client Admin sees how the instrument works and
// its parts; the consultant also sees every scenario with its four statements, one dimension at a time. Read only, nothing stored.

const READY: [string, string, "d7" | "d8" | "d9", string][] = [
  ["D7", "Digital Readiness", "d7", "M3 5h18v12H3zM8 21h8M12 17v4"],
  ["D8", "Psychological Safety", "d8", "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4"],
  ["D9", "Adaptive Capacity", "d9", "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"],
];
const TOC: [string, string, string][] = [["part1", "1", "Culture dimensions"], ["part2", "2", "Readiness"], ["part3", "3", "Employee survey"], ["part4", "4", "Open questions"]];
const OPEN_ICON = ["M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z", "M12 3 2 20h20zM12 10v4M12 17h.01", "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z"];
const mix = (t: number) => { const a = [0xE6, 0xDF, 0xD4], b = [0xEB, 0x57, 0x33]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`; };
const svgOf = (html: string) => <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />;

const PARTS = [["PART 1", "Culture dimensions", "6", "dimensions · 100 points each", "100 points each"], ["PART 2", "Readiness", "3", "dimensions · 12 statements, 1 to 5", "12 statements, 1 to 5"], ["PART 3", "Employee questions", "8", "questions · 0 to 10", "0 to 10"], ["PART 4", "Open questions", "3", "optional", "optional"]] as const;

function How({ semver, parts }: { semver: string | null; parts: boolean }) {
  return (
    <section className="dsh-card" style={{ display: "flex", flexDirection: "column", gap: 18 }} aria-labelledby="apv-how">
      <h2 id="apv-how" style={{ margin: 0, font: "800 22px/1.2 var(--font-ui)" }}>How the assessment works</h2>
      <div className="apv-angles">
        <div className="apv-angle is-now"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#EB5733" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg><div><b>NOW</b><span>the culture as it is now</span></div></div>
        <svg width="40" height="24" viewBox="0 0 40 24" fill="none" stroke="#131313" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12h34" /><path d="m28 4 8 8-8 8" /></svg>
        <div className="apv-angle is-pref"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#B23A17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="#B23A17" /></svg><div><b>PREFERRED</b><span>what it needs in five years</span></div></div>
      </div>
      <div className="apv-facts">
        <span className="apv-fact"><Svg size={16} w={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>35 to 45 minutes</span>
        <span className="apv-fact"><Svg size={16} w={2.2}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>Anonymous</span>
        <span className="apv-fact"><Svg size={16} w={2.2}><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Svg>Every personal link works once</span>
        <span className="apv-fact"><Svg size={16} w={2.2}><path d="M20 6 9 17l-5-5" /></Svg>No right or wrong answers</span>
      </div>
      {parts && (
        <nav className="apv-glance" aria-label="The four parts">
          {PARTS.map(([k, b, n, s], i) => <a key={k} className="apv-part" href={`#part${i + 1}`}><span className="apv-k">{k}</span><b>{b}</b><span className="apv-n"><strong>{n}</strong><span>{s}</span></span></a>)}
        </nav>
      )}
      <More label="Read the full explanation" className="apv-more">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 12 }}>
          <p className="apv-why">Every person answers anonymously from two angles: the culture as it <b>is now (NOW)</b> and the culture the organisation <b>needs in five years (PREFERRED)</b>. There are no right or wrong answers. Part 1 is six culture dimensions, answered by sharing <b>100 points</b> across four statements. Part 2 is three readiness dimensions of twelve statements each, rated 1 to 5. Part 3 is eight employee questions rated 0 to 10. Part 4 is three optional open questions. It takes 35 to 45 minutes and every personal link works once.</p>
          <p className="apv-why" style={{ color: "var(--grey)" }}>Instrument version {semver ?? "not published"}. The questions are the same for every organisation so results stay comparable. Respondents see the statements marked A to D, not the orientation names shown here.</p>
        </div>
      </More>
    </section>
  );
}

function SecHead({ n, id, title, sub }: { n: number; id: string; title: string; sub: React.ReactNode }) {
  return <div className="apv-sh"><span className="apv-badge" aria-hidden="true">{n}</span><div><h2 id={id}>{title}</h2><p style={{ display: "flex", alignItems: "center", gap: 6 }}>{sub}</p></div></div>;
}

function Alloc() {
  return <div className="apv-format"><p><b>How people answer:</b> share 100 points across four statements, marked A to D.</p><div className="apv-alloc" aria-hidden="true"><div className="apv-alloc-bar"><span>A</span><span>B</span><span>C</span><span>D</span></div><div className="apv-alloc-l">100 points to share</div></div></div>;
}

// parts 2 to 4 are the same for both roles
function Rest({ items }: { items: { dim: string }[] }) {
  return (
    <>
      <section className="apv-sec" id="part2" aria-labelledby="p2h">
        <SecHead n={2} id="p2h" title="Readiness" sub="D7 to D9 · twelve statements each" />
        <div className="apv-format"><p><b>How people answer:</b> twelve statements, each rated: Strongly disagree, Disagree, Neutral, Agree, Strongly agree.</p><div className="apv-likert" aria-hidden="true"><span><i />Strongly disagree</span><span><i />Disagree</span><span><i />Neutral</span><span><i style={{ borderColor: "#EB5733" }} />Agree</span><span><i style={{ borderColor: "#EB5733", background: "#EB5733" }} />Strongly agree</span></div></div>
        <div className="apv-ready">
          {READY.map(([code, name, key, icon]) => {
            const n = items.filter((i) => i.dim === code).length;
            return (
              <article key={code} className="apv-dim">
                <div className="apv-dim-h"><span className="apv-code" style={{ background: "var(--ink)", color: "var(--paper)" }}>{code}</span><h3>{name}</h3></div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-700)" }}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EB5733" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon} /></svg><span style={{ fontSize: 14 }}>{n ? `${n === 12 ? "Twelve" : n} statements` : "Twelve statements"} · 1 to 5</span></div>
                <More label="Why it matters" className="apv-more"><p className="apv-why" style={{ paddingTop: 10 }}>{WHYS[key]}</p></More>
              </article>
            );
          })}
        </div>
      </section>
      <section className="apv-sec" id="part3" aria-labelledby="p3h">
        <SecHead n={3} id="p3h" title="Employee Orientation Survey" sub="Eight questions rated 0 to 10, from completely negative to completely positive." />
        <div className="apv-format" style={{ gridTemplateColumns: "auto minmax(0, 1fr)" }}>
          <span className="dsh-ic is-or" style={{ width: 56, height: 56, borderRadius: 16 }} aria-hidden="true"><Svg size={26}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 13h5" /></Svg></span>
          <div aria-hidden="true" style={{ width: 440, maxWidth: "100%" }}><div className="apv-scale" style={{ width: "100%" }}>{Array.from({ length: 11 }, (_, n) => <span key={n} style={{ background: mix(n / 10), color: n > 6 ? "#131313" : "#363432" }}>{n}</span>)}</div><div className="apv-scale-l"><span>Completely negative</span><span>Completely positive</span></div></div>
        </div>
      </section>
      <section className="apv-sec" id="part4" aria-labelledby="p4h">
        <SecHead n={4} id="p4h" title="Open questions" sub={<><Svg size={15} w={2.2}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>Optional, free text, kept encrypted. Respondents are asked not to name individuals.</>} />
        <div className="apv-qs">
          {QUAL_TITLES.map((t, i) => { const [q, name] = t.split(" - "); return <div key={t} className="apv-q"><span className="apv-code" aria-hidden="true"><Svg d={OPEN_ICON[i]} size={20} w={2} /></span><div><small>{q}</small><b>{name}</b></div></div>; })}
        </div>
      </section>
    </>
  );
}

export function ClientPreview({ nav, email, roleLabel, semver, items }: { nav: StaffNav[]; email: string; roleLabel: string; semver: string | null; items: { dim: string }[] }) {
  return (
    <DashShell nav={nav} email={email} roleLabel={roleLabel}>
      <main className="dsh-body">
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><h1 style={{ margin: 0, font: "800 clamp(34px, 3.4vw, 48px)/1.05 var(--font-ui)", letterSpacing: "-.02em" }}>Assessment preview</h1><p style={{ margin: 0, fontSize: 18, color: "var(--ink-700)", display: "flex", alignItems: "center", gap: 8 }}><Svg w={2}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>The instrument exactly as your people answer it. Read only.</p></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <a className="dsh-pill" href="/preview/360?as=self"><Svg><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></Svg>360 self assessment</a>
            <a className="dsh-pill" href="/preview/360?as=rater"><Svg><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4a4 4 0 0 1 0 8" /><path d="M22 21a7 7 0 0 0-4-6.3" /></Svg>360 rater form</a>
            <a className="dsh-pill is-ink" href="/dashboard"><Svg><path d="m15 18-6-6 6-6" /></Svg>Portfolio</a>
          </div>
        </div>
        {!semver && <div className="apv-status" role="status"><span className="dsh-ic" style={{ background: "#F8E7C2", color: "#7A5300" }} aria-hidden="true"><Svg size={20} w={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 7v6" /><path d="M12 16.5h.01" /></Svg></span>No instrument version is published yet.</div>}
        <How semver={semver} parts />
        <div className="apv-layout">
          <Toc items={TOC} />
          <div>
            <section className="apv-sec" id="part1" aria-labelledby="p1h">
              <SecHead n={1} id="p1h" title="Culture dimensions" sub="D1 to D6 · asked twice: NOW, then PREFERRED · three scenarios each" />
              <Alloc />
              <div className="apv-dims">
                {DIMS.map((d, i) => <article key={d.name} className="apv-dim"><div className="apv-dim-h"><span className="apv-code">D{i + 1}</span><h3>{d.name}</h3></div><p>{d.sub}.</p><div className="apv-tags"><span className="apv-tag is-now">NOW</span><span className="apv-tag is-pref">PREFERRED</span><span className="apv-tag">Three scenarios each</span></div></article>)}
              </div>
              <p className="caption">Asked twice: NOW, then PREFERRED. Three scenarios each.</p>
            </section>
            <Rest items={items} />
          </div>
        </div>
      </main>
    </DashShell>
  );
}

export function ConsultantPreview({ nav, email, roleLabel, semver, items, dims }: { nav: StaffNav[]; email: string; roleLabel: string; semver: string | null; items: { dim: string }[]; dims: Dim[] }) {
  const initials = (email.split("@")[0].match(/[a-z]/gi) ?? ["C"]).slice(0, 2).join("").toUpperCase();
  return (
    <DashShell nav={nav} email={email} roleLabel={roleLabel} rail top={<DimSearch dims={dims} />}>
      <main className="dsh-body">
        <div className="cv-grid">
          <div className="cv-left">
            <section className="cv-hero">
              <div className="cv-hero-t">
                <span className="cv-chip"><Svg size={16} w={2.4}><path d="M20 6 9 17l-5-5" /></Svg>{semver ? `Instrument version ${semver}` : "No instrument version published"}</span>
                <h1>Assessment preview</h1>
                <p><Svg w={2}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>The instrument exactly as people answer it. Read only.</p>
                <div className="cv-btns">
                  <a className="dsh-pill cv-wpill" href="/preview/360?as=self"><Svg><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></Svg>360 self assessment</a>
                  <a className="dsh-pill cv-wpill" href="/preview/360?as=rater"><Svg><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M16 4a4 4 0 0 1 0 8" /><path d="M22 21a7 7 0 0 0-4-6.3" /></Svg>360 rater form</a>
                  <a className="dsh-pill cv-wpill is-solid" href="/dashboard"><Svg><path d="m15 18-6-6 6-6" /></Svg>Portfolio</a>
                </div>
              </div>
              {svgOf(CV_ILL)}
            </section>
            <nav className="cv-stats" aria-label="The four parts">
              {PARTS.map(([k, b, n, , tag], i) => <a key={k} className="cv-stat" href={`#part${i + 1}`}><span className="cv-k">{k}</span><div className="cv-sv">{svgOf(CV_STAT[i])}<div><strong>{n}</strong><b>{b}</b></div></div><span className="cv-tag">{tag}</span></a>)}
            </nav>
            <How semver={semver} parts={false} />
            <div className="apv-layout cv-one">
              <div>
                <section className="apv-sec" id="part1" aria-labelledby="p1h">
                  <SecHead n={1} id="p1h" title="Culture dimensions" sub="D1 to D6 · asked twice: NOW, then PREFERRED · three scenarios each" />
                  <Alloc />
                  <DimTabs dims={dims} />
                  <p className="caption">Respondents see the statements marked A to D, not the orientation names shown here.</p>
                </section>
                <Rest items={items} />
              </div>
            </div>
          </div>
          <aside className="cv-right" aria-label="Your profile and the parts">
            <section className="cv-prof">
              <div className="cv-band"><span>{roleLabel.toUpperCase()}</span><a href="/account/password" className="cv-edit" aria-label="Password"><Svg size={16} w={2.2}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg></a></div>
              <div className="cv-pid"><span className="cv-pav">{initials}</span><div><b>{email}</b><small>{roleLabel.toUpperCase()}</small></div></div>
              <div className="cv-pstats"><div><small>Dimensions</small><b>9</b></div><div><small>Scenarios each</small><b>3</b></div><div><small>Minutes</small><b>35 to 45</b></div></div>
            </section>
            <section className="cv-agenda">
              <div className="cv-band"><span>THE ASSESSMENT</span></div>
              <Toc items={TOC} className="apv-toc cv-toc" />
            </section>
          </aside>
        </div>
      </main>
    </DashShell>
  );
}
