// The four orientations live in ./orientation-data (one definition, no import cycle with the client components); this file draws the cards.
import { ORIENTATIONS } from "./orientation-data";
export { ORIENTATIONS };
import { Symbol } from "./fingerprint-demo";
import { TiltGrid } from "./fx";


// The four orientations as cards in the same 2 x 2 positions as the diagram. DOM order stays ENGAGE, INNOVATE, PERFORM, GOVERN.

export function OrientationGrid({ href }: { href?: string }) {
  return (
    <TiltGrid className="ogrid">
      {ORIENTATIONS.map((o) => {
        const body = (<><span className="ocard-k" style={{ background: o.colour }}></span><span className="ocard-b"><b className="ocard-n"><Symbol o={o.name} size={26} draw />{o.name}</b><span>{o.desc}</span><span className="ocard-p">{o.axes}</span></span></>);
        return href ? <a key={o.name} className="ocard hcard" style={{ ["--hue" as string]: o.colour }} href={href}>{body}</a> : <div key={o.name} className="ocard" style={{ ["--hue" as string]: o.colour }}>{body}</div>;
      })}
    </TiltGrid>
  );
}
