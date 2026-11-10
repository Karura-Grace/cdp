import { ORIENTATIONS } from "./orientations";
import { Scene } from "./fx";

// Illustrative gap per orientation: the bar starts at NOW (centre line) and points toward PREFERRED.
// Right of the line = more needed, left = less needed. Widths are the figures the site already showed.
const GAP = [["ENGAGE", "more", 17.6], ["INNOVATE", "more", 19.5], ["PERFORM", "less", 14.4], ["GOVERN", "less", 22]] as const;

export default function GapBars() {
  return (
    <Scene className="gap" role="group" aria-label="Culture gap by orientation: bars start at NOW and point toward PREFERRED">
      <div className="gap-row gap-axis" aria-hidden="true">
        <span></span>
        <span className="gap-scale"><span>◀ Less needed</span><b>NOW</b><span>More needed ▶</span></span>
        <span></span>
      </div>
      {GAP.map(([name, dir, w]) => {
        const o = ORIENTATIONS.find((x) => x.name === name)!;
        return (
          <div className="gap-row" key={name}>
            <span className="gap-name"><span className="odot" style={{ background: o.colour }}></span>{name}</span>
            <div className="gap-track"><span className={"gap-bar " + dir} style={{ width: w + "%", background: o.colour }}></span></div>
            <span className={"badge gap-badge" + (dir === "more" ? " ink" : "")}>{dir === "more" ? "More needed" : "Less needed"}</span>
          </div>
        );
      })}
      <p className="caption">Each bar starts at where you are now (NOW) and points toward where you need to be (PREFERRED).</p>
    </Scene>
  );
}
