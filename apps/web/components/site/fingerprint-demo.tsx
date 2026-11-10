"use client";
// The hero's animated Culture Fingerprint grid, hover and tilt, plus the hero motion pieces and the living stats row.
// Ported from the pac.africa /cdp page so both sites show the same graphic. Orientation names, colours and wording come from
// ./orientations (the one definition); only the grid position is added here.
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { ORIENTATIONS as LIST } from "./orientation-data";

type O = (typeof LIST)[number]["name"];
const POS: Record<O, { col: number; row: number }> = { ENGAGE: { col: 0, row: 0 }, INNOVATE: { col: 1, row: 0 }, GOVERN: { col: 0, row: 1 }, PERFORM: { col: 1, row: 1 } };
const ORIENTATIONS = Object.fromEntries(LIST.map((o) => [o.name, { desc: o.desc, hue: o.colour, ...POS[o.name] }])) as Record<O, { desc: string; hue: string; col: number; row: number }>;
const GRID_ORDER: O[] = ["ENGAGE", "INNOVATE", "GOVERN", "PERFORM"];
const CARD_ORDER: O[] = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"];

// Example moves for the hero demo. A move never cuts across a diagonal: it steps through the neighbouring orientation.
const MOVES: { now: O; via: O; pref: O; caption: string }[] = [
  { now: "GOVERN", via: "PERFORM", pref: "INNOVATE", caption: "A bank run on rules and procedure needs to innovate. Its path runs Govern, then Perform, then Innovate." },
  { now: "PERFORM", via: "INNOVATE", pref: "ENGAGE", caption: "A results driven company is burning out its people. Its path runs Perform, then Innovate, then Engage." },
  { now: "ENGAGE", via: "GOVERN", pref: "PERFORM", caption: "A close knit team must now deliver at scale. Its path runs Engage, then Govern, then Perform." },
];
const HOLD_MS = 5600;
const RESUME_MS = 2000;
const DRAW_DELAY = 0.6; // seconds after a move starts before the route draws
const DRAW = 1.5; // seconds the route takes, the spark runs with it
const ORANGE = "#C8401F";
const EASE = [0.2, 0, 0, 1] as const;

// Where the NOW and PREFERRED pills sit in each quadrant, in percent of the grid (towards the centre, clear of the label).
const spot = (o: O) => ({ x: ORIENTATIONS[o].col ? 70 : 30, y: ORIENTATIONS[o].row ? 70 : 30 });

// The orientation symbols from the CDP reports: Engage two linked rings, Innovate a spark, Perform a target, Govern a shield.
// The class names let the orientation cards animate each symbol on hover (globals.css, .cdp-sym-*).
export function Symbol({ o, size, draw }: { o: O; size: number; draw: boolean }) {
  const hue = ORIENTATIONS[o].hue;
  const reduce = useReducedMotion();
  const line = {
    fill: "none",
    stroke: hue,
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    initial: reduce ? false : { pathLength: 0 },
    animate: { pathLength: draw || reduce ? 1 : 0 },
    transition: { duration: 0.9, ease: EASE },
  } as const;
  const star = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i - Math.PI / 8;
    const r = i % 2 ? 3.15 : 7;
    return `${(12 + r * Math.cos(a)).toFixed(2)},${(12 + r * Math.sin(a)).toFixed(2)}`;
  });
  return (
    <svg className={`cdp-sym cdp-sym--${o.toLowerCase()}`} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, color: hue }}>
      <circle cx={12} cy={12} r={12} fill={hue} fillOpacity={0.14} />
      {o === "ENGAGE" && (
        <>
          <motion.circle className="cdp-sym-a" cx={9.34} cy={12} r={4.34} {...line} />
          <motion.circle className="cdp-sym-b" cx={14.66} cy={12} r={4.34} {...line} />
        </>
      )}
      {o === "INNOVATE" && <motion.path className="cdp-sym-spin" d={`M${star.join(" L")} Z`} {...line} />}
      {o === "PERFORM" && (
        <>
          <motion.circle className="cdp-sym-ring" cx={12} cy={12} r={7} {...line} />
          <motion.circle className="cdp-sym-ring cdp-sym-ring--in" cx={12} cy={12} r={4.06} {...line} />
          <circle cx={12} cy={12} r={1.3} fill={hue} />
        </>
      )}
      {o === "GOVERN" && <motion.path className="cdp-sym-shield" d="M12,5 L17.95,8.5 L17.95,13.05 Q17.95,17.25 12,19 Q6.05,17.25 6.05,13.05 L6.05,8.5 Z" {...line} />}
    </svg>
  );
}

// A soft ring that ripples out once from a point on the grid (percent coordinates).
function Ripple({ at, hue, delay }: { at: { x: number; y: number }; hue: string; delay: number }) {
  return (
    <div className="cdp-fp-layer" style={{ transform: `translate(${at.x}%, ${at.y}%)` }}>
      <motion.span
        className="cdp-fp-ripple"
        style={{ borderColor: hue }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 2.3], opacity: [0, 0.75, 0] }}
        transition={{ duration: 0.95, delay, ease: "easeOut", opacity: { duration: 0.95, delay, times: [0, 0.15, 1] } }}
      />
    </div>
  );
}

// The fingerprint from the original CDP map: orange corner brackets round a detailed print. It fades in once and stays still.
// Coordinates are the original drawing's (viewBox 232 232 136 136), so it is the same print the CDP site has always shown.
const PRINT = [
  "M289.5,318.9 L290.0,316.4 L290.6,314.0 L291.2,311.6 L291.7,309.1 L292.3,306.7 L292.8,304.2 L293.4,301.8 L293.9,299.4 L294.6,297.0 L295.9,294.8 L297.1,292.7 L298.4,290.5 L299.6,288.3 L301.4,286.9 L303.9,286.4 L305.9,286.9 L307.3,288.9 L308.7,291.0 L309.4,293.3 L309.4,295.8 L309.4,298.3 L309.4,300.8 L309.4,303.3 L309.4,305.8 L308.8,308.3 L308.3,310.7 L307.7,313.1 L307.2,315.6 L306.6,318.0 L306.1,320.5 L305.6,322.9 L305.7,325.4 L307.3,327.2 L309.7,327.5 L311.8,326.2 L312.7,323.9 L313.2,321.5 L313.8,319.1 L314.3,316.6 L314.9,314.2 L315.4,311.7 L316.0,309.3 L316.5,306.8 L316.6,304.4 L316.6,301.9 L316.6,299.4 L316.6,296.9 L316.6,294.3 L316.6,291.8 L316.2,289.4 L314.9,287.3 L313.5,285.2 L312.1,283.1 L310.7,281.1 L309.2,279.1 L306.8,278.4 L304.4,278.9 L301.9,279.4 L299.5,280.0 L297.0,280.5 L295.0,281.9 L293.8,284.1 L292.5,286.3 L291.3,288.4 L290.0,290.6 L288.7,292.7 L287.6,294.9 L287.0,297.4 L286.4,299.8 L285.9,302.3 L285.3,304.7 L284.8,307.1 L284.2,309.6 L283.7,312.0 L283.1,314.4 L282.6,316.9 L282.0,319.3 L281.4,321.7 L280.7,324.2 L280.1,326.6 L279.5,329.0 L278.9,331.4 L278.3,333.9 L277.7,336.3 L277.1,338.7 L276.5,341.2 L275.9,343.6 L275.3,346.0 L274.7,348.4 L274.5,350.9 L275.9,352.9 L278.2,353.6 L280.5,352.6 L281.6,350.4 L282.2,348.0 L282.8,345.6 L283.4,343.1 L284.0,340.7 L284.6,338.3 L285.2,335.9 L285.9,333.4 L286.5,331.0 L287.1,328.6 L287.7,326.2 L288.3,323.7 L288.9,321.3 L289.5,318.9",
  "M296.7,320.7 L297.2,318.2 L297.8,315.7 L298.4,313.3 L298.9,310.8 L299.5,308.4 L300.0,305.9 L300.6,303.4 L301.2,301.0 L302.0,299.3 L302.0,301.8 L302.0,304.4 L301.5,306.8 L301.0,309.3 L300.5,311.8 L299.9,314.2 L299.4,316.7 L298.8,319.2 L298.3,321.6 L298.0,324.1 L298.3,326.6 L299.2,329.0 L300.6,331.1 L302.4,332.8 L304.6,334.1 L307.0,334.8 L309.5,335.0 L312.0,334.6 L314.4,333.6 L316.4,332.1 L318.1,330.2 L319.2,328.0 L319.9,325.6 L320.5,323.1 L321.0,320.7 L321.6,318.2 L322.1,315.7 L322.7,313.3 L323.2,310.8 L323.7,308.3 L324.0,305.8 L324.0,303.3 L324.0,300.8 L324.0,298.2 L324.0,295.7 L324.0,293.2 L324.0,290.7 L323.6,288.2 L322.7,285.8 L321.4,283.7 L320.0,281.6 L318.6,279.5 L317.2,277.4 L315.7,275.3 L314.0,273.5 L311.9,272.1 L309.5,271.3 L307.0,271.0 L304.5,271.3 L302.0,271.8 L299.5,272.4 L297.1,272.9 L294.6,273.5 L292.3,274.6 L290.3,276.1 L288.7,278.1 L287.5,280.2 L286.2,282.4 L284.9,284.6 L283.6,286.8 L282.4,289.0 L281.1,291.2 L280.3,293.5 L279.7,296.0 L279.2,298.5 L278.6,300.9 L278.0,303.4 L277.5,305.8 L276.9,308.3 L276.4,310.8 L275.8,313.2 L275.2,315.7 L274.6,318.1 L274.0,320.6 L273.4,323.0 L272.8,325.5 L272.2,327.9 L271.6,330.4 L270.9,332.8 L270.3,335.3 L269.7,337.7 L269.1,340.2 L268.5,342.6 L267.9,345.1",
  "M284.5,358.9 L286.3,357.2 L287.7,355.1 L288.7,352.7 L289.3,350.3 L289.9,347.8 L290.5,345.3 L291.1,342.9 L291.7,340.4 L292.4,337.9 L293.0,335.5 L293.6,333.0 L294.2,330.5 L294.8,328.1 L295.4,325.6 L296.1,323.1 L296.7,320.7",
  "M299.5,339.8 L301.8,340.9 L304.2,341.8 L306.6,342.2 L309.2,342.4 L311.7,342.2 L314.2,341.7 L316.5,340.8 L318.8,339.6 L320.8,338.1 L322.6,336.4 L324.2,334.4 L325.5,332.2 L326.4,329.9 L327.1,327.4 L327.6,324.9 L328.2,322.5 L328.7,320.0 L329.3,317.5 L329.8,315.1 L330.4,312.6 L330.9,310.1 L331.3,307.6 L331.4,305.1 L331.4,302.6 L331.4,300.0 L331.4,297.5 L331.4,295.0 L331.4,292.5 L331.4,289.9 L331.0,287.4 L330.4,285.0 L329.4,282.7 L328.1,280.5 L326.7,278.4 L325.3,276.3 L323.9,274.2 L322.5,272.1 L321.0,270.0 L319.2,268.2 L317.2,266.7 L315.0,265.4 L312.7,264.5 L310.2,263.9 L307.7,263.6 L305.2,263.7 L302.7,264.1 L300.2,264.7 L297.7,265.2 L295.3,265.8 L292.8,266.4 L290.4,267.2 L288.2,268.4 L286.2,269.9 L284.3,271.7 L282.8,273.7 L281.5,275.8 L280.2,278.0",
  "M275.9,285.3 L274.7,287.5 L273.7,289.8 L273.0,292.3 L272.4,294.8 L271.8,297.3 L271.3,299.8 L270.7,302.3 L270.1,304.8 L269.6,307.3 L269.0,309.7 L268.4,312.2 L267.9,314.7 L267.2,317.2 L266.6,319.7 L266.0,322.2 L265.4,324.6 L264.8,327.1 L264.1,329.6 L263.5,332.1 L262.9,334.6 L262.3,337.0",
  "M291.9,362.0 L294.0,359.2 L295.4,356.0",
  "M297.5,347.9 L298.2,345.2 L298.8,342.5 L299.5,339.8",
  "M304.7,349.4 L307.2,349.7 L309.8,349.8 L312.3,349.6 L314.8,349.1 L317.2,348.5 L319.6,347.5 L321.8,346.4 L323.9,345.0 L325.9,343.5 L327.7,341.7 L329.4,339.8 L330.8,337.7 L332.1,335.5 L333.1,333.2 L333.9,330.8 L334.5,328.4 L335.0,325.9 L335.6,323.4 L336.1,321.0 L336.7,318.5 L337.2,316.0 L337.7,313.6 L338.3,311.1 L338.7,308.6 L338.8,306.1 L338.8,303.5 L338.8,301.0 L338.8,298.5 L338.8,296.0 L338.8,293.4 L338.8,290.9 L338.7,288.4 L338.3,285.9 L337.7,283.4 L336.8,281.1 L335.7,278.8 L334.4,276.6 L333.0,274.5 L331.6,272.4 L330.2,270.3 L328.8,268.2 L327.4,266.1 L325.7,264.2 L323.9,262.5 L321.9,260.9 L319.8,259.6 L317.5,258.4 L315.1,257.5 L312.7,256.8 L310.2,256.4 L307.7,256.2 L305.2,256.3 L302.7,256.6 L300.2,257.1 L297.7,257.6 L295.3,258.2 L292.8,258.7 L290.4,259.4 L288.0,260.2 L285.7,261.3 L283.5,262.6 L281.5,264.1 L279.7,265.9 L278.0,267.7 L276.5,269.8 L275.2,271.9 L273.9,274.1 L272.6,276.3 L271.4,278.5 L270.1,280.7 L268.8,282.8 L267.6,285.1 L266.7,287.4 L265.9,289.8 L265.4,292.3 L264.8,294.8 L264.3,297.2 L263.7,299.7 L263.1,302.2 L262.6,304.6 L262.0,307.1 L261.5,309.6 L260.9,312.0 L260.3,314.5 L259.7,316.9 L259.1,319.4 L258.4,321.8 L257.8,324.3 L257.2,326.7",
  "M299.9,363.6 L301.1,361.4 L302.1,359.1 L302.9,356.7 L303.5,354.3 L304.1,351.9 L304.7,349.4",
  "M310.4,357.2 L313.1,356.9 L315.7,356.5 L318.3,355.9 L320.8,355.0 L323.3,354.0 L325.6,352.7 L327.9,351.3 L330.0,349.7 L332.0,347.9",
  "M336.4,342.8 L337.8,340.5 L339.1,338.1 L340.1,335.6",
  "M342.0,328.4 L342.6,325.8 L343.2,323.3 L343.7,320.8 L344.3,318.3 L344.8,315.7 L345.4,313.2 L345.9,310.7 L346.1,308.1 L346.2,305.5 L346.2,302.9 L346.2,300.3 L346.2,297.7 L346.2,295.1 L346.2,292.5 L346.2,289.9 L346.0,287.4",
  "M341.0,273.2 L339.6,271.1 L338.2,269.0 L336.8,266.9 L335.4,264.8 L334.0,262.7 L332.4,260.7 L330.8,258.8 L328.9,257.1 L327.0,255.5 L324.9,254.0 L322.7,252.7 L320.4,251.6 L318.1,250.7 L315.7,250.0 L313.2,249.4 L310.7,249.0 L308.2,248.8 L305.6,248.8 L303.1,249.0 L300.6,249.4 L298.1,250.0 L295.7,250.5 L293.2,251.1 L290.7,251.6 L288.3,252.3 L285.9,253.1 L283.6,254.1 L281.4,255.3 L279.2,256.6 L277.2,258.1 L275.3,259.8 L273.5,261.6 L271.9,263.5 L270.4,265.6 L269.1,267.7 L267.8,269.9 L266.5,272.1 L265.2,274.3 L264.0,276.5 L262.7,278.7 L261.5,280.9 L260.4,283.2 L259.5,285.5 L258.8,288.0 L258.2,290.4 L257.7,292.9 L257.1,295.4 L256.5,297.8 L256.0,300.3 L255.4,302.8 L254.9,305.2 L254.3,307.7 L253.7,310.2 L253.1,312.6",
  "M308.4,363.4 L309.5,360.3 L310.4,357.2",
  "M306.0,241.4 L303.2,241.6 L300.4,241.9 L297.7,242.5 L295.0,243.1",
  "M286.3,245.1 L283.9,245.9 L281.5,246.9 L279.1,248.1 L276.8,249.3 L274.7,250.8 L272.6,252.3 L270.6,254.0 L268.7,255.9 L267.0,257.8",
  "M262.6,264.2 L261.3,266.4 L260.0,268.6 L258.7,270.8 L257.4,273.0 L256.2,275.2 L254.9,277.4 L253.8,279.7",
];
const BRACKETS = [
  "M246,268 V252 Q246,246 252,246 H268",
  "M332,246 H348 Q354,246 354,252 V268",
  "M354,332 V348 Q354,354 348,354 H332",
  "M268,354 H252 Q246,354 246,348 V332",
];

function FingerprintMark({ draw }: { draw: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="cdp-fp-mark"
      aria-hidden="true"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: draw || reduce ? 1 : 0 }}
      transition={{ duration: 0.9, delay: reduce ? 0 : 0.25, ease: EASE }}
    >
      <svg viewBox="232 232 136 136">
        {BRACKETS.map((d) => (
          <path key={d} d={d} fill="none" stroke={ORANGE} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        <g transform="translate(300 302) scale(0.78) translate(-300 -302)" fill="none" stroke="#131313" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round">
          {PRINT.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
      </svg>
    </motion.div>
  );
}

// Hero: the culture fingerprint grid playing example NOW to PREFERRED moves. Plays while on screen, pauses while a visitor
// explores a quadrant and picks up again two seconds after they leave. Tilts up to 4 degrees towards the cursor on desktop.
export function FingerprintDemo() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [active, setActive] = useState<O | null>(null);
  const [hold, setHold] = useState(false);
  const holdTimer = useRef<number | undefined>(undefined);
  const rx = useSpring(0, { stiffness: 150, damping: 18 });
  const ry = useSpring(0, { stiffness: 150, damping: 18 });

  useEffect(() => {
    if (!inView || reduce || active || hold) return;
    const t = window.setInterval(() => setStep((s) => (s + 1) % MOVES.length), HOLD_MS);
    return () => window.clearInterval(t);
  }, [inView, reduce, active, hold]);
  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const leave = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    setActive(null);
    setHold(true);
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => setHold(false), RESUME_MS);
  };
  const tilt = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  const untilt = () => {
    rx.set(0);
    ry.set(0);
  };

  const move = MOVES[step];
  const [a, b, c] = [spot(move.now), spot(move.via), spot(move.pref)];
  // The route stops short of the PREFERRED pill (wide, so further when arriving sideways) so the arrowhead stays visible.
  const ux = Math.sign(c.x - b.x);
  const uy = Math.sign(c.y - b.y);
  const gap = ux ? 15 : 6;
  const end = { x: c.x - ux * gap, y: c.y - uy * gap };
  const route = `M${a.x},${a.y} L${b.x},${b.y} L${end.x},${end.y}`;
  const head = `M${end.x + ux * 2.6},${end.y + uy * 2.6} L${end.x - uy * 2},${end.y + ux * 2} L${end.x + uy * 2},${end.y - ux * 2} Z`;
  const leg1 = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  const bend = leg1 / (leg1 + Math.abs(end.x - b.x) + Math.abs(end.y - b.y)); // share of the route before the stepping stone
  const spring = reduce ? { duration: 0 } : ({ type: "spring", stiffness: 170, damping: 22 } as const);
  const drawn = inView || !!reduce;
  const caption = active ? `${active[0]}${active.slice(1).toLowerCase()}: ${ORIENTATIONS[active].desc}` : move.caption;

  return (
    <figure ref={ref} className="cdp-fp" aria-label="Culture Fingerprint: the four culture orientations, with example moves from the culture an organisation has now to the one it prefers">
      <motion.div className="cdp-fp-frame" style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }} onPointerMove={tilt} onPointerLeave={untilt}>
        <span className="cdp-fp-axis cdp-fp-axis--top">Adaptive</span>
        <span className="cdp-fp-axis cdp-fp-axis--bottom">Structured</span>
        <span className="cdp-fp-axis cdp-fp-axis--left">Inward</span>
        <span className="cdp-fp-axis cdp-fp-axis--right">Outward</span>
        <div className="cdp-fp-grid" data-active={active ? "true" : "false"} onPointerLeave={leave}>
          {GRID_ORDER.map((o) => (
            <button
              key={o}
              type="button"
              className={"cdp-fp-q" + (o === move.pref ? " is-pref" : "")}
              style={{ ["--hue" as string]: ORIENTATIONS[o].hue }}
              aria-pressed={active === o}
              onPointerEnter={(e) => e.pointerType === "mouse" && setActive(o)}
              onFocus={() => setActive(o)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((cur) => (cur === o ? null : o))}
            >
              <span className="cdp-fp-name">
                <Symbol o={o} size={26} draw={drawn} />
                {o}
              </span>
              <span className="cdp-fp-desc">{ORIENTATIONS[o].desc}</span>
            </button>
          ))}
          <FingerprintMark draw={drawn} />
          <svg className="cdp-fp-route" viewBox="0 0 100 100" aria-hidden="true">
            <motion.path
              key={`r${step}`}
              d={route}
              fill="none"
              stroke={ORANGE}
              strokeWidth={0.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: drawn ? 1 : 0 }}
              transition={{ duration: DRAW, delay: reduce ? 0 : DRAW_DELAY, ease: "linear" }}
            />
            <motion.path
              key={`h${step}`}
              d={head}
              fill={ORANGE}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: drawn ? 1 : 0 }}
              transition={{ duration: 0.2, delay: reduce ? 0 : DRAW_DELAY + DRAW - 0.1 }}
            />
          </svg>
          {drawn && !reduce && (
            <div key={`fx${step}`} aria-hidden="true">
              <Ripple at={a} hue={ORIENTATIONS[move.now].hue} delay={0.3} />
              <Ripple at={b} hue={ORANGE} delay={DRAW_DELAY + bend * DRAW} />
              <Ripple at={c} hue={ORIENTATIONS[move.pref].hue} delay={DRAW_DELAY + DRAW} />
              <motion.div
                className="cdp-fp-layer"
                initial={{ x: `${a.x}%`, y: `${a.y}%`, opacity: 0 }}
                animate={{ x: [`${a.x}%`, `${b.x}%`, `${end.x}%`], y: [`${a.y}%`, `${b.y}%`, `${end.y}%`], opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: DRAW,
                  delay: DRAW_DELAY,
                  ease: "linear",
                  times: [0, bend, 1],
                  opacity: { duration: DRAW + 0.25, delay: DRAW_DELAY, times: [0, 0.08, 0.85, 1] },
                }}
              >
                <span className="cdp-fp-spark" />
              </motion.div>
            </div>
          )}
          <motion.div className="cdp-fp-layer" initial={false} animate={{ x: `${a.x - 30}%`, y: `${a.y - 30}%` }} transition={spring}>
            <span className="cdp-fp-pill cdp-fp-pill--now">NOW</span>
          </motion.div>
          <motion.div className="cdp-fp-layer" initial={false} animate={{ x: `${c.x - 30}%`, y: `${c.y - 30}%` }} transition={{ ...spring, delay: reduce ? 0 : 0.08 }}>
            <span className="cdp-fp-pill cdp-fp-pill--pref">PREFERRED</span>
          </motion.div>
        </div>
      </motion.div>
      <figcaption className="cdp-fp-cap">
        <span className="cdp-fp-dots" aria-hidden="true">
          {MOVES.map((_, i) => (
            <span key={i} className={i === step ? "is-on" : ""} />
          ))}
        </span>
        <span className="cdp-fp-caption" aria-live="polite">
          {caption}
        </span>
      </figcaption>
    </figure>
  );
}

// The hero's dot grid drifts a little slower than the page as it scrolls.
export function ParallaxDots() {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 44]);
  return <motion.div className="dot-grid-bg" style={{ position: "absolute", inset: -48, opacity: 0.45, pointerEvents: "none", y: reduce ? 0 : y }} />;
}

// Wraps a button so it leans a few pixels towards the cursor and springs back when the cursor leaves (desktop only).
export function Magnetic({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const x = useSpring(0, { stiffness: 220, damping: 16 });
  const y = useSpring(0, { stiffness: 220, damping: 16 });
  const pull = (e: PointerEvent<HTMLSpanElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * 12);
    y.set(((e.clientY - r.top) / r.height - 0.5) * 12);
  };
  return (
    <motion.span style={{ display: "inline-flex", x, y }} onPointerMove={pull} onPointerLeave={() => (x.set(0), y.set(0))}>
      {children}
    </motion.span>
  );
}
// A number that counts up from zero once it is shown. The server HTML carries the real number.
export function useCount(value: number, on: boolean, delay = 0) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(value);
  useEffect(() => {
    if (!on || reduce) return;
    const c = animate(0, value, { duration: 1.1, delay, ease: EASE, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [on, reduce, value, delay]);
  return n;
}

// The small picture under each stat, built while the number counts: checks, the four symbols, the nine dimensions
// (six of culture, three of readiness), the two perspectives, and a small bar chart for the data points.
function StatArt({ i, on }: { i: number; on: boolean }) {
  const reduce = useReducedMotion();
  if (i === 0)
    return (
      <span className="cdp-art">
        {[0, 1, 2, 3].map((k) => (
          <svg key={k} width={18} height={18} viewBox="0 0 18 18">
            <circle cx={9} cy={9} r={8} fill="rgba(200,64,31,0.1)" />
            <motion.path
              d="M5.2,9.4 L7.8,12 L12.8,6.6"
              fill="none"
              stroke={ORANGE}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: on ? 1 : 0 }}
              transition={{ duration: 0.4, delay: 0.15 + k * 0.18, ease: EASE }}
            />
          </svg>
        ))}
      </span>
    );
  if (i === 1)
    return (
      <span className="cdp-art">
        {CARD_ORDER.map((o) => (
          <Symbol key={o} o={o} size={20} draw={on} />
        ))}
      </span>
    );
  if (i === 2)
    return (
      <span className="cdp-art cdp-art--dims">
        {Array.from({ length: 9 }, (_, k) => (
          <span key={k} className={k < 6 ? "cdp-dim" : "cdp-dim cdp-dim--ready"} style={{ transitionDelay: `${k * 70}ms` }} />
        ))}
      </span>
    );
  if (i === 3)
    return (
      <span className="cdp-art cdp-art--persp">
        <span className="cdp-mini cdp-mini--now">NOW</span>
        <span className="cdp-mini cdp-mini--pref">PREFERRED</span>
      </span>
    );
  return (
    <span className="cdp-art cdp-art--bars">
      {[9, 14, 11, 18, 13, 20, 15, 10, 17, 12].map((h, k) => (
        <span key={k} style={{ height: h, transitionDelay: `${k * 60}ms` }} />
      ))}
    </span>
  );
}

function StatNumber({ value, on }: { value: number; on: boolean }) {
  return <span className="cdp-stat-n">{useCount(value, on, 0.1)}</span>;
}

// The stat row: each number counts up while its small picture builds, once, when the row comes into view.
export function LivingStats({ stats }: { stats: { value: number; label: string }[] }) {
  const ref = useRef<HTMLDListElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  const on = inView || !!reduce;
  return (
    <dl ref={ref} className="cdp-stats" data-on={on ? "true" : "false"}>
      {stats.map((s, i) => (
        <div key={s.label}>
          <dt>{s.label}</dt>
          <dd>
            <StatArt i={i} on={on} />
            <StatNumber value={s.value} on={on} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
