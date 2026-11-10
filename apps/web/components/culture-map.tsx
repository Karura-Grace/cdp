"use client";

import { useState } from "react";
import { ORIENTATIONS, ORIENT_NAME, dp, type Orientation } from "@/lib/format";
import { MAP_LIMIT, MAP_RINGS, MAP_STEP, mapPoint, plotAt, routeVia } from "@/lib/culture-map";

// The Culture Map: the four squares of the landing page as a real plot. Nearer a corner means more of that orientation, nearer the centre
// means less. One dot per profile; Now and Preferred are joined by a line that runs along the axes only, through the stepping stone orientation when the shift is diagonal. Position comes from lib/culture-map.ts and is
// geometry only: the scores printed under the map are the frozen score's own strings, never read back from the drawing.
type Profile = Record<Orientation, string>;
const COLOUR: Record<Orientation, string> = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
const CORNER: Record<Orientation, { sx: -1 | 1; sy: -1 | 1 }> = { ENGAGE: { sx: -1, sy: -1 }, INNOVATE: { sx: 1, sy: -1 }, PERFORM: { sx: 1, sy: 1 }, GOVERN: { sx: -1, sy: 1 } };   // screen side of each square
const C = 220, HALF = 170, GAP = 3, DOT = 8;

export function CultureMap({ now, pref, title = "Culture map", stone = null }: { now: Profile; pref?: Profile | null; title?: string; stone?: Orientation | null }) {
  const [tip, setTip] = useState("Hover or focus a dot to read its four scores");
  const pts = [
    { id: "now", label: "NOW", name: "Now", scores: now, p: mapPoint(now), fill: "#131313", ink: "#FAF7F2" },
    ...(pref ? [{ id: "pref", label: "PREFERRED", name: "Preferred", scores: pref, p: mapPoint(pref), fill: "#EB5733", ink: "#131313" }] : []),
  ].map((d) => ({ ...d, xy: plotAt(d.p, C, C, HALF) }));
  const route = pts.length === 2 ? routeVia(pts[0].xy, pts[1].xy, DOT + 3, stone, C, C) : { legs: [], waypoint: null };
  const legs = route.legs;
  const read = (d: (typeof pts)[number]) =>
    `${d.name}: ${ORIENTATIONS.map((o) => `${ORIENT_NAME[o]} ${dp(d.scores[o], 0)}`).join(", ")}${d.p.offScale ? ". Beyond the edge of the map, drawn at the edge" : ""}`;
  const px = (v: number) => (v / MAP_LIMIT) * HALF;

  return (
    <figure className="cmap" aria-label={title}>
      <svg viewBox="0 0 440 440" role="img" aria-label={`${title}. ${pts.map(read).join(". ")}. Nearer a corner means more of that orientation; the centre means an even culture.`}>
        <defs>
          <marker id="cm-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1,1 L9,5 L1,9 z" fill="#EB5733" /></marker>
        </defs>
        {ORIENTATIONS.map((o) => {
          const { sx, sy } = CORNER[o];
          const x0 = sx < 0 ? C - HALF : C + GAP, y0 = sy < 0 ? C - HALF : C + GAP, w = HALF - GAP;
          const corner = { ENGAGE: "18 6 6 6", INNOVATE: "6 18 6 6", PERFORM: "6 6 18 6", GOVERN: "6 6 6 18" }[o];
          return (
            <g key={o}>
              <rect x={x0} y={y0} width={w} height={w} rx="6" fill={COLOUR[o]} fillOpacity=".07" stroke={COLOUR[o]} strokeOpacity=".35" data-corner={corner} />
              <text x={sx < 0 ? x0 + 12 : x0 + w - 12} y={sy < 0 ? y0 + 22 : y0 + w - 12} textAnchor={sx < 0 ? "start" : "end"} className="cmap-name" fill={COLOUR[o]}>{o}</text>
            </g>
          );
        })}
        {MAP_RINGS.filter((r) => r > 0 && r < MAP_LIMIT).map((r) => (
          <g key={r} className="cmap-ring">
            <rect x={C - px(r)} y={C - px(r)} width={px(r) * 2} height={px(r) * 2} fill="none" />
            <text x={C + px(r) + 2} y={C - 3} className="cmap-tick">{r}</text>
          </g>
        ))}
        <path d={`M${C - HALF},${C} H${C + HALF} M${C},${C - HALF} V${C + HALF}`} className="cmap-cross" />
        <text x={C} y="22" textAnchor="middle" className="cmap-axis">ADAPTIVE</text>
        <text x={C} y="430" textAnchor="middle" className="cmap-axis">STRUCTURED</text>
        <text x="14" y={C} textAnchor="middle" className="cmap-axis" transform={`rotate(-90 14 ${C})`}>INWARD</text>
        <text x="426" y={C} textAnchor="middle" className="cmap-axis" transform={`rotate(90 426 ${C})`}>OUTWARD</text>

        {legs.map((l, i) => <line key={i} x1={l.from[0]} y1={l.from[1]} x2={l.to[0]} y2={l.to[1]} className="cmap-arrow" markerEnd={i === legs.length - 1 ? "url(#cm-head)" : undefined} />)}
        {route.waypoint && stone && <g><circle cx={route.waypoint[0]} cy={route.waypoint[1]} r="6" fill="#fff" stroke="#EB5733" strokeWidth="2.5" /><text x={route.waypoint[0]} y={route.waypoint[1] + (route.waypoint[1] < C ? -11 : 19)} textAnchor="middle" className="cmap-chip" fill="#131313">{`via ${ORIENT_NAME[stone]}`}</text></g>}
        {pts.map((d) => {
          const other = pts.find((x) => x.id !== d.id);
          const above = other ? other.xy[1] >= d.xy[1] : d.xy[1] > C;   // put the label on the side away from the other dot
          const lw = d.label.length * 6.6 + 16, lx = Math.min(Math.max(d.xy[0], 6 + lw / 2), 434 - lw / 2), ly = d.xy[1] + (above ? -(DOT + 18) : DOT + 4);
          return (
            <g key={d.id} tabIndex={0} className="cmap-dot" role="img" aria-label={read(d)} onMouseEnter={() => setTip(read(d))} onFocus={() => setTip(read(d))}>
              <title>{read(d)}</title>
              <circle cx={d.xy[0]} cy={d.xy[1]} r={DOT} fill={d.fill} stroke="#FAF7F2" strokeWidth="2" strokeDasharray={d.p.offScale ? "3 2" : undefined} />
              <rect x={lx - lw / 2} y={ly} width={lw} height="14" rx="7" fill={d.fill} stroke="#FAF7F2" strokeWidth="1.5" />
              <text x={lx} y={ly + 10.5} textAnchor="middle" className="cmap-chip" fill={d.ink}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="cmap-cap">
        <span>Scale ±{MAP_LIMIT} points from the centre, a ring every {MAP_STEP}. The nearer a corner, the more of that orientation; the centre is an even culture.</span>
        <span className="cmap-tip" aria-live="polite">{tip}</span>
      </figcaption>
      <table className="sr">
        <caption>{title}: scores and position</caption>
        <thead><tr><th>Profile</th>{ORIENTATIONS.map((o) => <th key={o}>{ORIENT_NAME[o]}</th>)}<th>Inward to outward</th><th>Structured to adaptive</th></tr></thead>
        <tbody>{pts.map((d) => <tr key={d.id}><th>{d.name}</th>{ORIENTATIONS.map((o) => <td key={o}>{dp(d.scores[o], 0)}</td>)}<td>{dp(d.p.xPts, 0)}</td><td>{dp(d.p.yPts, 0)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
