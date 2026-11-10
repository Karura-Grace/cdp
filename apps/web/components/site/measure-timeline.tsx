// Platform "Measure": the follow-up cycle as a vertical timeline. Wording is the section's own: pulses at 90 and 180 days,
// the full profile again at twelve months (sooner if a trigger is accepted), compared with the baseline.
const STOPS = [
  ["Baseline", "The first full profile."],
  ["90 days", "Short pulse on the items that matter for each priority."],
  ["180 days", "Short pulse on the same items."],
  ["Twelve months", "The full profile runs again and is compared with your baseline."],
] as const;

export default function MeasureTimeline() {
  return (
    <div className="card mtl">
      <div className="mtl-head"><p className="h4">The measure cycle</p><span className="badge">Illustrative</span></div>
      <ol className="mtl-list">
        {STOPS.map(([when, what], i) => (
          <li key={when} className={i === STOPS.length - 1 ? "is-last" : ""}><span className="mtl-dot" aria-hidden="true"></span><b>{when}</b><span className="small">{what}</span></li>
        ))}
      </ol>
      <p className="caption">Or sooner, if a trigger is accepted.</p>
    </div>
  );
}
