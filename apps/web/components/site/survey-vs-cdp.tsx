"use client";
// What CDP is: a typical culture survey next to CDP, racing on view. Ported from the pac.africa /cdp page.
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";

const ORANGE = "#C8401F";
const EASE = [0.2, 0, 0, 1] as const;

type Pt = { x: number; y: number };
type Geo = { w: number; h: number; line: string; loop: string; orbit: string };

// The CDP column runs top to bottom: the line joins the five badges, and the loop runs back up the left side from 05 to 01.
// Drawn from the badges' layout positions, so the loop always lands on 01 at any width.
function cycleGeometry(w: number, h: number, a: Pt, e: Pt, r: number): Geo {
  const xl = a.x - r - 20;
  const k = 14;
  const back = `H${xl + k} Q${xl},${e.y} ${xl},${e.y - k} V${a.y + k} Q${xl},${a.y} ${xl + k},${a.y}`;
  return { w, h, line: `M${a.x},${a.y} V${e.y}`, loop: `M${e.x - r - 4},${e.y} ${back} H${a.x - r - 7}`, orbit: `M${a.x},${a.y} V${e.y} ${back} Z` };
}

// Line icons for the five CDP steps.
const STEP_ICONS = [
  ["M8,4.5 H16 Q18,4.5 18,6.5 V19 Q18,21 16,21 H8 Q6,21 6,19 V6.5 Q6,4.5 8,4.5 Z", "M9,9.5 L10.5,11 L13,8.5", "M9,14.5 H15", "M9,17.5 H13"],
  ["M8,18 V12 A4,4 0 0 1 16,12 V15", "M5,16 V12 A7,7 0 0 1 19,12 V17", "M12,19 V12"],
  ["M12,4 A8,8 0 1 1 11.99,4 Z", "M12,7.5 A4.5,4.5 0 1 1 11.99,7.5 Z", "M12,11 A1,1 0 1 1 11.99,11 Z"],
  ["M5,7 L6.5,8.5 L9,6", "M12,7.5 H19", "M5,13 L6.5,14.5 L9,12", "M12,13.5 H19", "M5,19 H9", "M12,19 H19"],
  ["M3,13 H7 L9,8 L12,18 L15,10 L17,13 H21"],
];
const SURVEY = [
  { name: "Ask people", body: "One questionnaire, once.", missing: false },
  { name: "A chart", body: "A chart of how people feel.", missing: false },
  { name: "No verdict", body: "Nobody says what it means for strategy.", missing: true },
  { name: "No owners", body: "Nobody is named to act.", missing: true },
  { name: "No proof", body: "Nobody checks whether anything changed.", missing: true },
];

// What CDP is: a typical culture survey next to CDP. When the section comes into view both start at the first step. The
// survey reaches its chart and stops; CDP carries on through all five steps, then the loop draws back to the start and a
// dot keeps travelling round the cycle while it is on screen.
export default function SurveyVsCdp({ steps }: { steps: { name: string; body: string }[] }) {
  const track = useRef<HTMLDivElement>(null);
  const badges = useRef<(HTMLSpanElement | null)[]>([]);
  const reduce = useReducedMotion();
  const inView = useInView(track, { amount: 0.2 });
  const seen = useInView(track, { once: true, amount: 0.4 });
  const [geo, setGeo] = useState<Geo | null>(null);
  const [survey, setSurvey] = useState(0); // 0 nothing, 1 asked, 2 chart, 3 stopped
  const [lit, setLit] = useState(0);
  const [done, setDone] = useState(false);
  const line = useMotionValue(0);
  const loop = useMotionValue(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const centre = (b: HTMLElement) => {
      let x = b.offsetWidth / 2;
      let y = b.offsetHeight / 2;
      for (let n: HTMLElement | null = b; n && n !== el; n = n.offsetParent as HTMLElement | null) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      return { x, y };
    };
    const measure = () => {
      const first = badges.current[0];
      const last = badges.current[steps.length - 1];
      if (first && last) setGeo(cycleGeometry(el.offsetWidth, el.offsetHeight, centre(first), centre(last), first.offsetHeight / 2));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [steps.length]);

  useEffect(() => {
    if (!seen || reduce) return;
    const timers = [350, 1000, 1700].map((ms, i) => window.setTimeout(() => setSurvey(i + 1), ms));
    const fill = animate(line, 1, { duration: 2.6, delay: 0.35, ease: [0.45, 0, 0.25, 1] });
    const back = animate(loop, 1, { duration: 1, delay: 3.05, ease: EASE, onComplete: () => setDone(true) });
    return () => (timers.forEach(window.clearTimeout), fill.stop(), back.stop());
  }, [seen, reduce, line, loop]);

  useMotionValueEvent(line, "change", (v) => setLit(v <= 0.005 ? 0 : Math.min(steps.length, Math.floor(v * (steps.length - 1) + 1e-6) + 1)));
  const surveyAt = reduce ? 3 : survey;
  const litAt = reduce ? steps.length : lit;

  return (
    <div className="cdp-vs">
      <div className="cdp-vs-survey" data-stage={surveyAt}>
        <p className="cdp-vs-label">A typical culture survey</p>
        <ol className="cdp-vs-list">
          {SURVEY.map((s, i) => (
            <li key={s.name} data-missing={s.missing ? "true" : undefined} data-on={(s.missing ? surveyAt >= 3 : surveyAt > i) ? "true" : "false"} style={s.missing ? ({ "--d": `${(i - 2) * 220}ms` } as React.CSSProperties) : undefined}>
              <span className="cdp-vs-dot" />
              <h3>{s.name}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="cdp-vs-stop" data-on={surveyAt >= 3 ? "true" : "false"}>
          <b>Then it stops.</b> The chart is where a survey ends.
        </p>
      </div>

      <div className="cdp-vs-cdp">
        <p className="cdp-vs-label cdp-vs-label--cdp">CDP</p>
        <div ref={track} className="cdp-vs-track">
          {geo && (
            <svg className="cdp-cycle-svg" width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
              <defs>
                <marker id="cdp-cycle-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M1,1 L9,5 L1,9" fill="none" stroke={ORANGE} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </marker>
              </defs>
              <path d={geo.line} fill="none" stroke="rgba(19,19,19,0.1)" strokeWidth={2} />
              <motion.path d={geo.line} fill="none" stroke={ORANGE} strokeWidth={2} style={{ pathLength: reduce ? 1 : line }} />
              <path d={geo.loop} fill="none" stroke="rgba(19,19,19,0.1)" strokeWidth={1.6} strokeDasharray="3 5" />
              <motion.path
                d={geo.loop}
                fill="none"
                stroke={ORANGE}
                strokeWidth={1.6}
                strokeLinecap="round"
                markerEnd={reduce || done ? "url(#cdp-cycle-head)" : undefined}
                style={{ pathLength: reduce ? 1 : loop }}
              />
            </svg>
          )}
          {geo && !reduce && <span className="cdp-cycle-orbit" data-run={done && inView ? "true" : "false"} style={{ offsetPath: `path("${geo.orbit}")` }} aria-hidden="true" />}
          <ol className="cdp-vs-steps">
            {steps.map((s, i) => (
              <li key={s.name} data-on={i < litAt ? "true" : "false"}>
                <span ref={(el) => void (badges.current[i] = el)} className="cdp-cycle-no">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <svg className="cdp-step-icon" width={28} height={28} viewBox="0 0 24 24" aria-hidden="true">
                  {STEP_ICONS[i].map((d) => (
                    <path key={d} d={d} pathLength={1} />
                  ))}
                </svg>
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <p className="cdp-cycle-again" data-on={reduce || done ? "true" : "false"}>
          Then it starts again, measured against the last cycle.
        </p>
      </div>
    </div>
  );
}

