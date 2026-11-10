// Pieces of the client facing pages (report and portfolio): a section with its "How to read this" and "What to do" strip, headline tiles with a short paragraph beside
// them, chips, meters and the shared drawings. Server components. Owner picks Q-WD5 to Q-WD20.
import { SECTION_SAY, type Say } from "@/lib/report-copy";
import { toSvg, type Drawing } from "@/lib/graphics/culture";

export const Chip = ({ tone = "", children }: { tone?: "ok" | "warn" | "bad" | "orange" | ""; children: React.ReactNode }) => <span className={`pt-chip ${tone}`}>{children}</span>;

/** The strip that opens every section: how to read it, and what to do about it. */
export function Strip({ k }: { k: keyof typeof SECTION_SAY }) {
  const s = SECTION_SAY[k];
  return <div className="pt-strip"><div><b>How to read this</b>{s.read}</div><div><b>What to do</b>{s.todo}</div></div>;
}

export function Sec({ id, title, pill, sub, k, pane, children }: { id: string; title: string; pill?: React.ReactNode; sub?: string; k?: keyof typeof SECTION_SAY; pane?: string; children: React.ReactNode }) {
  return (
    <section id={id} data-pane={`${pane ?? ""} all`.trim()}>
      <h2 className="pt-h">{title}{pill}</h2>
      {sub && <p className="pt-sub">{sub}</p>}
      {k && <Strip k={k} />}
      {children}
    </section>
  );
}


export const Fig = ({ d, id, max = 430 }: { d: Drawing; id: string; max?: number }) => <div className="pt-fig" style={{ maxWidth: max }} dangerouslySetInnerHTML={{ __html: toSvg(d, id) }} />;

export function Meter({ label, value, of, suffix }: { label: string; value: number; of: number; suffix?: string }) {
  const pct = of > 0 ? Math.max(0, Math.min(100, Math.round((value / of) * 100))) : 0;
  return <div className="pt-meter-box"><div className="l">{label}</div><div className="v">{value}<span>of {of}{suffix ?? ""}</span></div><div className="pt-meter"><div style={{ width: `${pct}%` }} /></div></div>;
}

/** The key for the culture graphics: what solid, dashed and the two shadings mean. */
export const Key = () => (
  <div className="pt-key" aria-label="Key"><span><i style={{ background: "#58A55C", opacity: 0.55 }} />Now (solid)</span><span><i style={{ border: "2px dashed #EB5733" }} />Preferred (dashed)</span><span><i style={{ background: "#EB5733", opacity: 0.5 }} />More wanted than Now</span><span><i style={{ background: "#727070", opacity: 0.4 }} />Less wanted than Now</span><span><b>34</b>the score, in points, on its ring</span></div>
);

// ---------------------------------------------------------------- option C pieces (owner pick Q-RD2-5, 27 Oct 2026)
export const Expander = ({ say, open = false }: { say: Say; open?: boolean }) => (
  <details className="pt-exp" open={open}><summary>What it means and what to do</summary><p><b>What it means</b>{say.meaning}</p>{say.advice && <p><b>What to do</b>{say.advice}</p>}</details>
);

/** A big coloured number tile (Solo Ledger style): the figure large, its word, and the expander. */
export function BigTile({ label, value, word, fill, say, open, sm }: { label: string; value: string; word?: string; fill?: string; say: Say; open?: boolean; sm?: boolean }) {
  return (
    <div className={`pt-big${fill ? " fill" : ""}`} style={fill ? { background: fill } : undefined}>
      <div className="lab">{label}</div><div className={`num${sm ? " sm" : ""}`}>{value}</div>{word && <div className="word">{word}</div>}
      <Expander say={say} open={open} />
    </div>
  );
}

/** A flat tile with a status chip and a meter (Cadre style). */
export function MeterTile({ label, value, word, tone = "", pct, say }: { label: string; value: string; word: string; tone?: "ok" | "warn" | "bad" | "orange" | ""; pct: number; say: Say }) {
  return (
    <div className="pt-big">
      <div className="pt-chiprow"><span className="lab">{label}</span><Chip tone={tone}>{word}</Chip></div>
      <div className="num sm" style={{ margin: "8px 0" }}>{value}</div>
      <div className="pt-meter"><div style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
      <Expander say={say} />
    </div>
  );
}

/** A chart card: a title and chip, one chart, and the expander. */
export function ChartCard({ title, chip, say, children, id }: { title: string; chip?: string; say: Say; children: React.ReactNode; id?: string }) {
  return (
    <div className="pt-chart" id={id}>
      <div className="pt-chiprow"><b>{title}</b>{chip && <Chip tone="orange">{chip}</Chip>}</div>
      {children}
      <Expander say={say} />
    </div>
  );
}

export const Insight = ({ label, title, text, fill }: { label: string; title: string; text: string; fill: string }) => (
  <div className="pt-insight" style={{ background: fill }}><div className="lab">{label}</div><b>{title}</b><p>{text}</p></div>
);
