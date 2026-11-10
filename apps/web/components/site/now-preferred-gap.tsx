// Methodology "Organisational DNA": what NOW, PREFERRED and GAP mean, then the two directions a gap can point.
// Concept only: no scores, so it does not repeat the illustrative bars on the home page.
const STEPS = [
  ["ink", "NOW", "How people experience the organisation now."],
  ["orange", "PREFERRED · culture you need", "The culture people believe the organisation needs to become."],
  ["", "GAP", "Where meaningful gaps exist, and where strategic tension lives."],
] as const;

const DIRS = [
  { dir: "more", label: "More needed", now: 22, pref: 78 },
  { dir: "less", label: "Less needed", now: 78, pref: 22 },
] as const;

export default function NowPreferredGap() {
  return (
    <div className="card npg">
      <ol className="npg-steps">
        {STEPS.map(([tone, label, text]) => (
          <li key={label}><span className={"badge " + tone} style={{ height: "30px" }}>{label}</span><span className="small">{text}</span></li>
        ))}
      </ol>
      <div className="rule"></div>
      <p className="h4">A gap can point either way</p>
      <div className="npg-dirs" role="group" aria-label="A gap can point either way: more needed, or less needed">
        {DIRS.map((d) => (
          <div className="npg-dir" key={d.dir}>
            <span className={"badge" + (d.dir === "more" ? " ink" : "")}>{d.label}</span>
            <div className="npg-axis">
              <span className="npg-line" style={{ left: `calc(${Math.min(d.now, d.pref)}% + 12px)`, width: `calc(${Math.abs(d.pref - d.now)}% - 24px)` }} data-dir={d.dir}><i>GAP</i></span>
              <span className="npg-pt now" style={{ left: d.now + "%" }}><b>NOW</b></span>
              <span className="npg-pt pref" style={{ left: d.pref + "%" }}><b>PREFERRED</b></span>
            </div>
          </div>
        ))}
      </div>
      <p className="caption">The arrow runs from NOW to PREFERRED.</p>
    </div>
  );
}
