import type { ReactNode } from "react";
import SiteNav from "./nav";
import SiteFooter from "./footer";

export type LegalSection = { id: string; title: string; body: ReactNode };

// One layout for Privacy, Terms, Security and Cookies: hero, jump chips, then a heading column beside a text column so the page uses its width.
export default function LegalPage({ eyebrow, title, intro, updated, sections }: { eyebrow: string; title: string; intro: string; updated: string; sections: LegalSection[] }) {
  return (
    <div className="cdp" style={{ width: "100%", minHeight: "100vh", fontFamily: "var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313", background: "#FAF7F2" }}>
      <SiteNav current="none" />
      <main>
        <section>
          <div className="enter wrap" style={{ paddingBlock: "clamp(24px, 3.4vw, 40px) 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <p className="eyebrow">{eyebrow}</p>
            <h1 className="display-l">{title}</h1>
            <p className="lead" style={{ maxWidth: "760px" }}>{intro}</p>
            <p className="caption">Last updated {updated}</p>
            <nav aria-label="On this page" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {sections.map((s) => <a key={s.id} className="chip" href={"#" + s.id}>{s.title}</a>)}
            </nav>
          </div>
        </section>
        <section style={{ background: "#FFFFFF", borderBlock: "1px solid #E6DFD4" }}>
          <div className="wrap legal">
            {sections.map((s) => (
              <article key={s.id} id={s.id} className="legal-row">
                <h2 className="h3">{s.title}</h2>
                <div className="legal-body">{s.body}</div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
