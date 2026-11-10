import { JsonLd } from "./json-ld";
import type { QA } from "@/lib/faq";

// Visible questions and answers plus FAQPage markup built from the same array, so page text and markup can never differ.
export default function Faq({ items, eyebrow = "Questions", title = "Questions people ask about the Culture Dynamics Profile (CDP)", id = "faq" }: { items: QA[]; eyebrow?: string; title?: string; id?: string }) {
  const data = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })) };
  return (
    <section className="section" id={id}>
      <JsonLd data={data} />
      <div className="wrap" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "760px" }}><p className="eyebrow">{eyebrow}</p><h2 className="h1">{title}</h2></div>
        <div className="grid-2" style={{ alignItems: "start" }}>
          {items.map((x) => (
            <div key={x.q} className="card" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h3 className="h4">{x.q}</h3>
              <p className="small">{x.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
