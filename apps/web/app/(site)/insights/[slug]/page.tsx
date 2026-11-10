/* eslint-disable @next/next/no-html-link-for-pages */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { pageMeta } from "@/lib/site-seo";
import { ARTICLES, bySlug, longDate, type Block } from "@/lib/insights";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import Faq from "@/components/site/faq";
import { JsonLd } from "@/components/site/json-ld";

export const dynamicParams = false;
export function generateStaticParams() { return ARTICLES.map((a) => ({ slug: a.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const a = bySlug((await params).slug);
  if (!a) return {};
  const m = pageMeta(`/insights/${a.slug}`, a.title.length <= 53 ? `${a.title} | CDP` : a.title, a.description);
  return { ...m, openGraph: { ...m.openGraph, type: "article", publishedTime: a.published, modifiedTime: a.updated } };
}

// [text](/path) inside a paragraph becomes a link with descriptive text.
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  return <>{parts.map((s, i) => { const m = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/); return m ? <a key={i} href={m[2]}>{m[1]}</a> : <Fragment key={i}>{s}</Fragment>; })}</>;
}

function Body({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map((b, i) => "h" in b ? <h2 key={i} className="h2" style={{ marginTop: "12px" }}>{b.h}</h2> : "p" in b ? <p key={i} className="body"><Inline text={b.p} /></p> : <ul key={i} className="body" style={{ paddingLeft: "22px", display: "flex", flexDirection: "column", gap: "8px" }}>{b.ul.map((x) => <li key={x}><Inline text={x} /></li>)}</ul>)}</>;
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const a = bySlug((await params).slug);
  if (!a) notFound();
  const url = `https://cdp.pac.africa/insights/${a.slug}`;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Article", headline: a.title, description: a.description, datePublished: a.published, dateModified: a.updated, mainEntityOfPage: url, inLanguage: "en",
        author: { "@type": "Organization", name: "Priority Activator Consulting Culture Practitioners", url: "https://www.pac.africa/" }, publisher: { "@id": "https://www.pac.africa/#organization" } },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://cdp.pac.africa/" },
        { "@type": "ListItem", position: 2, name: "Insights", item: "https://cdp.pac.africa/insights" },
        { "@type": "ListItem", position: 3, name: a.title, item: url },
      ] },
    ],
  };
  return (
    <div className="cdp" style={{ width: "100%", minHeight: "100vh", fontFamily: "var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313", background: "#FAF7F2" }}>
      <JsonLd data={graph} />
      <SiteNav current="insights" />
      <main>
        <article>
          <div className="enter wrap" style={{ paddingBlock: "clamp(24px, 3.4vw, 40px) 24px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "820px" }}>
            <nav aria-label="Breadcrumb" className="small"><a href="/">Home</a> / <a href="/insights">Insights</a></nav>
            <p className="eyebrow">{a.kind}</p>
            <h1 className="display-l">{a.title}</h1>
            <p className="small">By Priority Activator Consulting Culture Practitioners. Published <time dateTime={a.published}>{longDate(a.published)}</time>. Updated <time dateTime={a.updated}>{longDate(a.updated)}</time>.</p>
          </div>
          <div className="wrap" style={{ maxWidth: "820px", paddingBottom: "32px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <Body blocks={a.blocks} />
          </div>
        </article>
        <Faq items={a.faq} eyebrow="Quick answers" title="Questions on this topic" id="faq" />
      </main>
      <SiteFooter />
    </div>
  );
}
