"use client";
import { useRef, useState } from "react";
import { ORIENTATIONS } from "./orientations";

// A working preview of the survey screen. Same words as the old picture; single choice because the site holds no statement text.
export default function PhoneDemo() {
  const [pick, setPick] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + ORIENTATIONS.length) % ORIENTATIONS.length;
    setPick(n); rows.current[n]?.focus();
  };
  const reset = () => { setPick(null); setSaved(false); };
  return (
    <div className="phone" role="group" aria-label="Survey preview">
      <div className="phone-bar" aria-hidden="true"><span>9:41</span><i></i><span>●●●</span></div>
      <div className="phone-body">
        <div className="phone-top caption"><b>Section 1 · Cultural DNA</b><span>Now</span></div>
        <div className="progress" aria-hidden="true"><span style={{ width: saved ? "100%" : pick === null ? "18%" : "55%", transition: "width .3s" }}></span></div>
        <p className="phone-q" id="phone-q">What do new employees notice in their first few weeks?</p>
        <div role="radiogroup" aria-labelledby="phone-q" className="phone-opts">
          {ORIENTATIONS.map((o, i) => (
            <button key={o.name} ref={(el) => { rows.current[i] = el; }} type="button" role="radio" aria-checked={pick === i} tabIndex={pick === i || (pick === null && i === 0) ? 0 : -1} disabled={saved}
              className={"phone-opt" + (pick === i ? " is-on" : "")} onClick={() => setPick(i)} onKeyDown={(e) => move(e, i)}>
              <span><span className="odot" style={{ background: o.colour }}></span>{o.name}</span><em>Statement</em>
            </button>
          ))}
        </div>
        {saved ? (
          <div className="phone-next is-saved"><span>Answer saved</span><button type="button" onClick={reset}>Start again</button></div>
        ) : (
          <button type="button" className="phone-next" disabled={pick === null} onClick={() => setSaved(true)}><span>{pick === null ? "" : "Answer saved"}</span><b>Next</b></button>
        )}
      </div>
    </div>
  );
}
