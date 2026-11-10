import { DashShell, More, Svg } from "@/components/dash-shell";
import type { StaffNav } from "@/components/staff-shell";
import { human, ORIENTATIONS, ORIENT_NAME, type Orientation } from "@/lib/format";
import { STAGES } from "@/lib/journey";
import type { Say } from "@/lib/report-copy";
import Pipeline from "./pipeline";

// The Portfolio for the Client Admin and the PAC Consultant (Claude Design export "Client admin · Portfolio dashboard", owner Q-D9-43
// to Q-D9-46, 5 Nov 2026). Every figure comes from the page's own queries (RLS); nothing here is invented. Other roles keep the
// staff shell layout until their screens are designed.

type Prof = Record<Orientation, number>;
type Next = { label: string; url?: string; href?: string; body?: unknown } | null;
export type Card = {
  e: { engagement_id: string; state: string; cycle_no: number }; name: string; reps: { report_id: string; type: string; status: string }[];
  asm?: { assessment_id: string; status: string; window_close: string | null; frozen_at: string | null }; released?: { assessment_id: string };
  myRoleHere: string | null; isConsultant: boolean; setup: boolean; next: Next; at: number; fl: { submitted: number; invited: number } | null;
  accepted: number; moving: number; rel: number; acts: unknown[]; latest: (t: string) => { report_id: string; status: string } | undefined;
  j: { step: number; of: number; stage: string; text: string };
};
type Hero = {
  tenant: string; reportId: string; now: Prof; pref: Prof; stone: Orientation | null; nowO: Orientation; prefO: Orientation; nowName: string; prefName: string; thenName: string;
  accepted: number; total: number; moving: number; rel: number; reps: number; cycle: number; j: { step: number; of: number; stage: string; text: string }; nowSay: Say; prefSay: Say;
};

const HUE: Record<Orientation, string> = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
const STEP_ICON: Record<string, string> = {
  Setup: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 21 10h.1a2 2 0 1 1 0 4z",
  Fielding: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z",
  Scoring: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  Reporting: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5",
  Debrief: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  Planning: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  Implementation: "M5 3l14 9-14 9V3z",
  "Re-assessment": "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
};
const TABS = [["", "Needs you"], ["setup", "Setup"], ["fielding", "Fielding"], ["reporting", "Reporting"], ["planning", "Planning"], ["implementation", "Implementation"]] as const;
const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const f1 = (v: number) => v.toFixed(1);

// ---------------------------------------------------------------- the culture quadrant (rings in points, Now solid, Preferred dashed)
// Quadrant order and the 45 degree direction of each: Engage top left, Innovate top right, Perform bottom right, Govern bottom left.
const DIR: Record<Orientation, [number, number]> = { ENGAGE: [-1, -1], INNOVATE: [1, -1], PERFORM: [1, 1], GOVERN: [-1, 1] };
const ARC: Record<Orientation, [[number, number], [number, number]]> = { ENGAGE: [[-1, 0], [0, -1]], INNOVATE: [[0, -1], [1, 0]], PERFORM: [[1, 0], [0, 1]], GOVERN: [[0, 1], [-1, 0]] };
const pt = (c: number, r: number, [x, y]: [number, number]) => `${f1(c + r * x)},${f1(c + r * y)}`;
const wedge = (o: Orientation, r: number, c = 260) => `M${c},${c} L${pt(c, r, ARC[o][0])} A${f1(r)},${f1(r)} 0 0 1 ${pt(c, r, ARC[o][1])} Z`;
const band = (o: Orientation, r0: number, r1: number, c = 260) => `M${pt(c, r1, ARC[o][0])} A${f1(r1)},${f1(r1)} 0 0 1 ${pt(c, r1, ARC[o][1])} L${pt(c, r0, ARC[o][1])} A${f1(r0)},${f1(r0)} 0 0 0 ${pt(c, r0, ARC[o][0])} Z`;
const R = (s: number) => Math.max(0, 4.33 * s - 10);

function Quadrant({ now, pref, stone }: { now: Prof; pref: Prof; stone: Orientation | null }) {
  const c = 260, k = Math.SQRT1_2;
  const centre = (p: Prof) => { const x = ORIENTATIONS.reduce((t, o) => t + p[o] * DIR[o][0], 0), y = ORIENTATIONS.reduce((t, o) => t + p[o] * DIR[o][1], 0); return [c + 2.2 * x, c + 2.2 * y]; };
  const [nx, ny] = centre(now), [px, py] = centre(pref);
  const label = `Culture quadrant. Now: ${ORIENTATIONS.map((o) => `${ORIENT_NAME[o]} ${Math.round(now[o])}`).join(", ")}. Preferred: ${ORIENTATIONS.map((o) => `${ORIENT_NAME[o]} ${Math.round(pref[o])}`).join(", ")}.${stone ? ` The path runs via ${ORIENT_NAME[stone]}.` : ""}`;
  return (
    <svg className="dsh-q" viewBox="0 0 520 520" width="100%" style={{ maxWidth: 560, alignSelf: "center" }} role="img" aria-label={label}>
      <defs>
        <marker id="dqa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="#B8B2A9" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></marker>
        <marker id="dqo" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#EB5733" /></marker>
      </defs>
      <g fill="none" stroke="#E6DFD4" strokeWidth="2"><rect x="44" y="44" width="214" height="214" rx="16" /><rect x="262" y="44" width="214" height="214" rx="16" /><rect x="44" y="262" width="214" height="214" rx="16" /><rect x="262" y="262" width="214" height="214" rx="16" /></g>
      <g fill="none" stroke="#B8B2A9" strokeWidth="1.4"><path d="M150,40 V22 H370 V40" markerStart="url(#dqa)" markerEnd="url(#dqa)" /><path d="M480,150 H498 V370 H480" markerStart="url(#dqa)" markerEnd="url(#dqa)" /><path d="M150,480 V498 H370 V480" markerStart="url(#dqa)" markerEnd="url(#dqa)" /><path d="M40,150 H22 V370 H40" markerStart="url(#dqa)" markerEnd="url(#dqa)" /></g>
      <g fontSize="11" fontWeight="700" letterSpacing="2.4" fill="#706F6F" textAnchor="middle">
        <rect x="212" y="12" width="96" height="20" fill="#F6F6F6" /><text x="260" y="26">ADAPTIVE</text><rect x="204" y="488" width="112" height="20" fill="#F6F6F6" /><text x="260" y="502">STRUCTURED</text>
        <g transform="rotate(90 498 260)"><rect x="456" y="250" width="84" height="20" fill="#F6F6F6" /><text x="498" y="264">OUTWARD</text></g>
        <g transform="rotate(-90 22 260)"><rect x="-16" y="250" width="76" height="20" fill="#F6F6F6" /><text x="22" y="264">INWARD</text></g>
      </g>
      <g fontSize="12.5" fontWeight="700" letterSpacing="1.8" fill="#131313">
        <rect x="62" y="62" width="11" height="11" fill={HUE.ENGAGE} /><text x="80" y="72">ENGAGE</text><rect x="342" y="62" width="11" height="11" fill={HUE.INNOVATE} /><text x="360" y="72">INNOVATE</text>
        <rect x="62" y="448" width="11" height="11" fill={HUE.GOVERN} /><text x="80" y="458">GOVERN</text><rect x="370" y="448" width="11" height="11" fill={HUE.PERFORM} /><text x="388" y="458">PERFORM</text>
      </g>
      <g fill="none" stroke="#C9C3BA" strokeWidth="1" strokeDasharray="3 4">{[10, 20, 30, 40].map((s) => <circle key={s} cx={c} cy={c} r={R(s)} />)}</g>
      <g fontSize="10" fill="#A6A29C">{[10, 20, 30, 40].map((s) => <text key={s} x={265} y={c - R(s) + 3}>{s}</text>)}</g>
      {ORIENTATIONS.map((o) => {
        const rn = R(now[o]), rp = R(pref[o]);
        return (
          <g key={o}>
            {rp > rn && <path d={wedge(o, rp)} fill="#F2B8A5" fillOpacity=".85" />}
            <path d={wedge(o, rn)} fill={HUE[o]} fillOpacity=".28" stroke={HUE[o]} strokeWidth="2" />
            {rp < rn && <path d={band(o, rp, rn)} fill="#131313" fillOpacity=".16" />}
          </g>
        );
      })}
      <g fill="none" stroke="#EB5733" strokeWidth="2.6" strokeDasharray="7 5">{ORIENTATIONS.map((o) => <path key={o} d={wedge(o, R(pref[o]))} />)}</g>
      {Math.hypot(px - nx, py - ny) > 12 && <path d={`M${f1(nx)},${f1(ny)} L${f1(px - (px - nx) * 10 / Math.hypot(px - nx, py - ny))},${f1(py - (py - ny) * 10 / Math.hypot(px - nx, py - ny))}`} fill="none" stroke="#EB5733" strokeWidth="3.2" markerEnd="url(#dqo)" />}
      <circle cx={px} cy={py} r="9" fill="#EB5733" stroke="#FFFFFF" strokeWidth="2.5" /><circle cx={nx} cy={ny} r="9" fill="#131313" stroke="#FFFFFF" strokeWidth="2.5" />
      {stone && <g><rect x={nx + 16} y={ny - 13} width="94" height="26" rx="13" fill="#FFFFFF" stroke="#E6DFD4" /><text x={nx + 63} y={ny + 5} textAnchor="middle" fontSize="12.5" fontWeight="700" fill="#131313">via {ORIENT_NAME[stone]}</text></g>}
      <g fontSize="13" fontWeight="700" textAnchor="middle">
        {ORIENTATIONS.map((o) => {
          const [dx, dy] = DIR[o], rn = R(now[o]) * k, rp = R(pref[o]) * k;
          const n0 = [c + dx * rn, c + dy * rn], p0 = [c + dx * rp, c + dy * rp];
          // Preferred pill outward of its dot, Now pill inward of its dot, so the two never sit on each other
          const pp = [p0[0] + dx * 20, p0[1] + dy * 20], nn = [n0[0] - dx * 22, n0[1] - dy * 22];
          return (
            <g key={o}>
              <circle cx={n0[0]} cy={n0[1]} r="5" fill={HUE[o]} stroke="#FFFFFF" strokeWidth="2" />
              <rect x={nn[0] - 17} y={nn[1] - 12} width="34" height="24" rx="12" fill="#FFFFFF" stroke="#E6DFD4" /><text x={nn[0]} y={nn[1] + 5} fill="#131313">{Math.round(now[o])}</text>
              <circle cx={p0[0]} cy={p0[1]} r="5" fill="#FFFFFF" stroke="#EB5733" strokeWidth="2.4" />
              <rect x={pp[0] - 18} y={pp[1] - 13} width="36" height="26" rx="13" fill="#EB5733" /><text x={pp[0]} y={pp[1] + 5} fill="#FFFFFF">{Math.round(pref[o])}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// the small glyph on the Now and Preferred culture cards: the leading quadrant in colour, and (Now) the second one smaller; (Preferred) an arrow towards it
function Glyph({ lead, then, arrow }: { lead: Orientation; then?: Orientation; arrow?: boolean }) {
  const [sx, sy] = DIR[lead], tip = [32 + sx * 12, 32 + sy * 12], tail = [32 - sx * 12, 32 - sy * 12];
  return (
    <svg width="112" height="112" viewBox="0 0 64 64">
      {ORIENTATIONS.filter((o) => o !== lead && o !== then).map((o) => <path key={o} d={wedge(o, 28, 32)} fill="#131313" fillOpacity=".08" />)}
      <path d={wedge(lead, 28, 32)} fill={HUE[lead]} />
      {then && <path d={wedge(then, 22, 32)} fill={HUE[then]} />}
      {arrow && <><path d={`M${tail[0]} ${tail[1]} L${tip[0]} ${tip[1]}`} stroke="#131313" strokeWidth="2.4" strokeLinecap="round" /><path d={`M${tip[0]} ${tip[1] - sy * 8} L${tip[0]} ${tip[1]} L${tip[0] - sx * 8} ${tip[1]}`} fill="none" stroke="#131313" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></>}
    </svg>
  );
}

function Prose({ say }: { say: Say }) {
  return <div className="dsh-prose"><b>What it means</b><span>{say.meaning}</span><b>What to do</b><span>{say.advice}</span></div>;
}

// a ring that fills to value/of; full and quiet when there is nothing to count
function Ring({ v, of, size = 96, r = 38, w = 11, colour = "#EB5733", text }: { v: number; of: number; size?: number; r?: number; w?: number; colour?: string; text: string }) {
  const C = 2 * Math.PI * r, part = of > 0 ? Math.min(1, v / of) : 0, c = size / 2;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r} fill="none" stroke="#EFEFEF" strokeWidth={w} />
      {part > 0 && <circle cx={c} cy={c} r={r} fill="none" stroke={colour} strokeWidth={w} strokeLinecap={part < 1 ? "round" : undefined} strokeDasharray={`${f1(C * part)} ${f1(C)}`} transform={`rotate(-90 ${c} ${c})`} />}
      <text x={c} y={c + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill="#131313">{text}</text>
    </svg>
  );
}

// the "where you are" ring: one segment per journey step
function StepRing({ step, of }: { step: number; of: number }) {
  const seg = (i: number) => { const gap = 6, a0 = -90 + i * 360 / of + gap / 2, a1 = -90 + (i + 1) * 360 / of - gap / 2, p = (a: number) => [48 + 38 * Math.cos(a * Math.PI / 180), 48 + 38 * Math.sin(a * Math.PI / 180)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${f1(x0)},${f1(y0)} A38,38 0 0 1 ${f1(x1)},${f1(y1)}`; };
  return <svg viewBox="0 0 96 96" aria-hidden="true">{Array.from({ length: of }, (_, i) => <path key={i} d={seg(i)} fill="none" stroke={i < step ? "#EB5733" : "#E6DFD4"} strokeWidth="11" />)}<text x="48" y="54" textAnchor="middle" fontSize="17" fontWeight="800" fill="#131313">{step}/{of}</text></svg>;
}

function Steps({ at }: { at: number }) {
  return (
    <ol className="dsh-steps" aria-label="Engagement journey">
      {STAGES.map((s, i) => <li key={s.label} className={i < at ? "is-done" : i === at ? "is-cur" : ""} aria-current={i === at ? "step" : undefined}><span className="dsh-step-ic" aria-hidden="true"><Svg d={STEP_ICON[s.label]} w={2} /></span>{s.label}</li>)}
    </ol>
  );
}

function Tile({ label, v, of }: { label: string; v: number; of: number }) {
  const C = 2 * Math.PI * 20;
  return (
    <div className="dsh-tile"><p className="dsh-eyebrow">{label}</p><span><span className="dsh-num">{v}</span><span className="dsh-of">of {of}</span></span>
      <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="20" fill="none" stroke="#E6DFD4" strokeWidth="7" />{v > 0 && <circle cx="26" cy="26" r="20" fill="none" stroke="#EB5733" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${f1(C * Math.min(1, v / Math.max(of, 1)))} ${f1(C)}`} transform="rotate(-90 26 26)" />}</svg>
    </div>
  );
}

function NextStep({ label, children }: { label: string; children?: React.ReactNode }) {
  return <div className="dsh-next"><span className="dsh-ic is-or" aria-hidden="true"><Svg size={20} w={2.2}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Svg></span><p className="dsh-eyebrow">{label}</p>{children}</div>;
}

const ILLUSTRATION = (
  <svg className="dz-ill" viewBox="0 0 360 220" aria-hidden="true">
    <ellipse cx="190" cy="206" rx="150" ry="10" fill="#131313" opacity=".06" />
    <rect x="196" y="18" width="138" height="112" rx="12" fill="#FFFFFF" stroke="#131313" strokeWidth="2.5" />
    <rect x="208" y="30" width="54" height="40" rx="6" fill="#FDF2EE" stroke="#EB5733" strokeWidth="2" /><rect x="268" y="30" width="54" height="40" rx="6" fill="#FFFFFF" stroke="#131313" strokeWidth="1.6" />
    <rect x="208" y="76" width="54" height="40" rx="6" fill="#FFFFFF" stroke="#131313" strokeWidth="1.6" /><rect x="268" y="76" width="54" height="40" rx="6" fill="#F3EEE6" stroke="#131313" strokeWidth="1.6" />
    <circle cx="230" cy="48" r="6" fill="#EB5733" /><circle cx="300" cy="96" r="6" fill="#131313" />
    <path d="M298 92 Q262 70 233 52" fill="none" stroke="#EB5733" strokeWidth="2.5" strokeDasharray="5 4" />
    <rect x="250" y="130" width="6" height="66" fill="#131313" /><rect x="226" y="194" width="54" height="6" rx="3" fill="#131313" />
    <rect x="40" y="128" width="170" height="10" rx="5" fill="#131313" /><rect x="56" y="138" width="7" height="60" fill="#131313" /><rect x="186" y="138" width="7" height="60" fill="#131313" />
    <path d="M118 96 l38 0 l-6 32 l-40 0 z" fill="#EB5733" /><rect x="104" y="126" width="62" height="5" rx="2.5" fill="#131313" />
    <circle cx="80" cy="56" r="17" fill="#6B3E26" /><path d="M63 52 q17 -22 34 0 q-4 -16 -17 -16 q-13 0 -17 16z" fill="#131313" />
    <path d="M58 132 q0 -54 24 -60 q22 -4 30 22 l14 30 l-10 6 l-14 -20 l-2 22 z" fill="#131313" />
    <path d="M112 108 l26 6" stroke="#6B3E26" strokeWidth="7" strokeLinecap="round" />
    <path d="M66 132 l-6 50 l14 0 l10 -40 l30 0 l0 44 l14 0 l2 -58 z" fill="#363432" />
    <rect x="54" y="180" width="22" height="7" rx="3.5" fill="#EB5733" /><rect x="112" y="186" width="22" height="7" rx="3.5" fill="#EB5733" />
    <circle cx="28" cy="176" r="12" fill="#58A55C" opacity=".85" /><rect x="24" y="176" width="8" height="24" rx="2" fill="#B8B2A9" /><rect x="18" y="192" width="20" height="12" rx="3" fill="#EB5733" />
    <g fill="#EB5733"><rect x="320" y="150" width="8" height="40" rx="2" /><rect x="306" y="164" width="8" height="26" rx="2" opacity=".6" /><rect x="292" y="174" width="8" height="16" rx="2" opacity=".35" /></g>
  </svg>
);

export default function DashView({ cards, nav, email, roleLabel, myRole, guide, hero, canManage, superAdmin, count, inFielding, released, drafts, sp, total, engStates, dates }: {
  cards: Card[]; nav: StaffNav[]; email: string; roleLabel: string; myRole: string; guide: string[] | null; hero: Hero | null; canManage: boolean; superAdmin: boolean;
  count: number; inFielding: number; released: number; drafts: number; sp: { q?: string; all?: string; stage?: string }; total: number; engStates: string[]; dates: { cycle: number; date: string }[];
}) {
  const consultant = myRole === "PAC_CONSULTANT";
  const stageOf = (state: string) => STAGES.find((s) => s.states.includes(state))?.label ?? "";
  const tabCount = (k: string) => (k ? engStates.filter((s) => stageOf(s).toLowerCase() === k).length : engStates.filter((s) => s !== "CLOSED").length);
  const reporting = engStates.filter((s) => stageOf(s) === "Reporting").length;
  // the right column follows the client's own engagement (hero) or, for the consultant, the first one that needs them
  const focus = hero ? { name: hero.tenant, cycle: hero.cycle, j: hero.j } : cards[0] ? { name: cards[0].name, cycle: cards[0].e.cycle_no, j: cards[0].j } : null;
  const nextCard = cards.find((c) => !c.isConsultant && c.released && c.myRoleHere !== "COACH");
  // coming dates first (soonest on top), then the most recent past ones
  const today = new Date().toISOString().slice(0, 10);
  const keyDates = [...dates.filter((d) => d.date >= today).sort((x, y) => x.date.localeCompare(y.date)), ...dates.filter((d) => d.date < today).sort((x, y) => y.date.localeCompare(x.date))].slice(0, 4);
  const who = consultant ? "a PAC Consultant" : "a client admin";
  return (
    <DashShell nav={nav} email={email} roleLabel={roleLabel}>
      <main className="dsh-body dz" id="portfolio">
        <div className="dz-grid">
          <div className="dz-left">
            <section className="dz-hero">
              <div className="dz-hero-t">
                <p className="dsh-eyebrow">{roleLabel}</p>
                <h1>Portfolio</h1>
                <p className="dz-sub">Every engagement you can see, where it is, and the next step.</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
                  <a className="dsh-pill" href="/preview"><Svg><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>Preview the survey</a>
                  {superAdmin && <a className="dsh-pill" href="/organisations">Organisations</a>}
                  {canManage && <a className="dsh-pill is-or" href="/users"><Svg><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M19 8v6" /><path d="M16 11h6" /></Svg>Manage users</a>}
                </div>
              </div>
              {ILLUSTRATION}
            </section>

            <section className="dsh-kpis" aria-label="Summary">
              <div className="dsh-card dsh-kpi">
                <span className="dsh-ic is-or" aria-hidden="true" />
                <div><p className="dsh-eyebrow">Engagements</p><div className="dsh-big" style={{ marginTop: 8 }}>{count}</div><p className="dsh-sub">{inFielding} in fielding now</p></div>
                <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="32" fill="none" stroke="#E6DFD4" strokeWidth="10" />{reporting > 0 && <circle cx="42" cy="42" r="32" fill="none" stroke="#EB5733" strokeWidth="10" strokeDasharray={`${f1(201 * reporting / Math.max(count, 1))} 201`} transform="rotate(-90 42 42)" />}<text x="42" y="40" textAnchor="middle" fontSize="11" fontWeight="700" fill="#363432">{reporting}</text><text x="42" y="53" textAnchor="middle" fontSize="8.5" fill="#706F6F">reporting</text></svg>
              </div>
              <div className="dsh-card dsh-kpi">
                <span className="dsh-ic is-or" aria-hidden="true" />
                <div><p className="dsh-eyebrow">Reports released</p><div className="dsh-big" style={{ marginTop: 8 }}>{released}</div><p className="dsh-sub">Visible to the client</p></div>
                <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true"><g fill="#FDF2EE" stroke="#EB5733" strokeWidth="2"><rect x="14" y="16" width="30" height="40" rx="4" /><rect x="40" y="28" width="30" height="40" rx="4" fill="#EB5733" /></g><path d="M48 48l5 5 9-9" fill="none" stroke="#131313" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M20 26h18M20 33h18M20 40h12" stroke="#EB5733" strokeWidth="2" strokeLinecap="round" /></svg>
              </div>
              <div className="dsh-card dsh-kpi">
                <span className="dsh-ic" aria-hidden="true" />
                <div><p className="dsh-eyebrow">Drafts</p><div className="dsh-big" style={{ marginTop: 8 }}>{drafts}</div><p className="dsh-sub">Not visible to the client</p></div>
                <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true"><rect x="22" y="14" width="40" height="54" rx="6" fill="none" stroke="#C9C3BA" strokeWidth="2" strokeDasharray="5 5" /><path d="M34 41h16" stroke="#C9C3BA" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </div>
            </section>

            {guide && (
              <section className="dsh-card" style={{ paddingBlock: 6 }}>
                <details open={!count}>
                  <summary className="dsh-more" style={{ border: 0, margin: 0, padding: "14px 0", color: "var(--ink)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}><span className="dsh-ic" style={{ width: 32, height: 32, borderRadius: 10 }} aria-hidden="true"><Svg size={16} w={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 11v6" /><path d="M12 7.5h.01" /></Svg></span>What you can do here as {who}</span>
                    <Svg size={18} w={2.4}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
                  </summary>
                  <div className="dsh-prose" style={{ paddingBottom: 16 }}>{guide.map((g) => <span key={g}>{g}</span>)}</div>
                </details>
              </section>
            )}

            {!count && <div className="dsh-card dsh-empty"><b style={{ color: "var(--ink)" }}>Nothing is shared with you yet</b><span>Engagements appear here once a PAC consultant assigns you to one. If you expected to see one, ask your PAC consultant to check your access.</span></div>}

            {hero && (
              <>
                <section className="dz-two">
                  <div className="dsh-card dz-cult">
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}><h2 style={{ margin: 0, font: "700 22px/1.2 var(--font-ui)" }}>Your culture, Now and Preferred</h2><span className="dsh-badge">{hero.tenant.toUpperCase()}</span></div>
                    <Quadrant now={hero.now} pref={hero.pref} stone={hero.stone} />
                    <div className="dsh-legend" aria-label="Legend">
                      <span><i className="dsh-sw" style={{ background: "#A9D3AC" }} />Now (solid)</span>
                      <span><i className="dsh-sw" style={{ border: "2px dashed #EB5733", boxSizing: "border-box" }} />Preferred (dashed)</span>
                      <span><i className="dsh-sw" style={{ background: "#F2B8A5" }} />More wanted than Now</span>
                      <span><i className="dsh-sw" style={{ background: "#D6D1C8" }} />Less wanted than Now</span>
                      <span><i className="dsh-chipnum">{Math.round(hero.pref[hero.prefO])}</i>the score, in points, on its ring</span>
                    </div>
                    <a className="dsh-pill is-ink" href={`/reports/${hero.reportId}`} style={{ alignSelf: "flex-start", minHeight: 52, padding: "0 26px", fontSize: 17 }}>Open the full report<Svg w={2.2}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Svg></a>
                  </div>
                  <div className="dsh-card dz-prog">
                    <div className="dz-ch"><h2>Progress</h2><span className="dsh-badge">CYCLE {hero.cycle}</span></div>
                    <div className="dz-donuts">
                      <div className="dz-d"><Ring v={hero.accepted} of={hero.total} text={`${hero.accepted}/${hero.total}`} /><b>Actions accepted</b><span>in your action plan</span></div>
                      <div className="dz-d"><StepRing step={hero.j.step} of={hero.j.of} /><b>Where you are</b><span>{hero.j.stage}</span></div>
                      <div className="dz-d"><Ring v={hero.rel} of={hero.reps} text={`${hero.rel}/${hero.reps}`} /><b>Reports released</b><span>visible to the client</span></div>
                      <div className="dz-d"><Ring v={hero.moving} of={hero.accepted} colour="#131313" text={`${hero.moving}/${hero.accepted}`} /><b>Actions under way</b><span>of accepted actions</span></div>
                    </div>
                    <div className="dz-more">
                      <p className="dsh-eyebrow">Actions accepted</p>
                      <More label="What it means and what to do"><Prose say={{ meaning: "The actions your leadership team has taken on from the proposed plan.", advice: "Review the proposed actions, rank them and accept the ones you will own." }} /></More>
                      <p className="dsh-eyebrow" style={{ marginTop: 10 }}>Where you are</p>
                      <More label="What it means and what to do"><Prose say={{ meaning: "Your place in the journey from setup to re-assessment.", advice: "Follow the next step on your engagement card below." }} /></More>
                    </div>
                  </div>
                </section>

                <section className="dz-two">
                  <article className="dsh-cul is-now">
                    <p className="dsh-eyebrow">Now culture</p>
                    <h3>{hero.nowName}</h3>
                    <p className="dsh-then" style={{ margin: 0 }}>then {hero.thenName}</p>
                    <div className="dsh-glyph" aria-hidden="true"><Glyph lead={hero.nowO} then={ORIENTATIONS.find((o) => ORIENT_NAME[o] === hero.thenName)} /></div>
                    <More label="What it means and what to do"><Prose say={hero.nowSay} /></More>
                  </article>
                  <article className="dsh-cul is-pref">
                    <p className="dsh-eyebrow">Preferred culture</p>
                    <h3>{hero.prefName}</h3>
                    <p className="dsh-then" style={{ margin: 0 }}>what people want to lead</p>
                    <div className="dsh-glyph" aria-hidden="true"><Glyph lead={hero.prefO} arrow /></div>
                    <More label="What it means and what to do"><Prose say={hero.prefSay} /></More>
                  </article>
                </section>
              </>
            )}

            {count > 0 && (
              <>
                <div className="dz-ch" style={{ marginTop: 6 }}><h2>Engagements</h2></div>
                <nav className="dsh-filters" aria-label="Filter engagements">
                  {TABS.map(([k, l]) => <a key={k} className={`dsh-tab${(sp.stage ?? "") === k ? " is-on" : ""}`} href={k ? `/dashboard?stage=${k}` : "/dashboard"} aria-current={(sp.stage ?? "") === k ? "page" : undefined} style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>{l}<i>{tabCount(k)}</i></a>)}
                </nav>
                <form className="dsh-search" action="/dashboard" role="search">
                  <label><Svg size={20} w={2}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg><span className="dsh-sr">Find an organisation</span><input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Find an organisation" /></label>
                  <button type="submit" className="dsh-pill is-ink" style={{ minHeight: 52, padding: "0 28px", fontSize: 17 }}>Search</button>
                  {(sp.q || sp.all) && <a className="dsh-pill" href="/dashboard" style={{ minHeight: 52 }}>Clear</a>}
                </form>
                {!cards.length && <div className="dsh-card dsh-empty"><Svg size={56} w={1.5}><path d="m12 3 9 5-9 5-9-5 9-5z" /><path d="m3 13 9 5 9-5" /></Svg><span>No engagements here</span></div>}
              </>
            )}

            {cards.map((c) => {
              const { e, reps, asm, released: rel0, myRoleHere, isConsultant, setup, next, at, fl, accepted, moving, rel, acts, latest, j } = c;
              return (
                <article key={e.engagement_id} className="dsh-card dsh-eng" aria-label={c.name}>
                  <div className="dsh-eng-h">
                    <span className="dsh-ic" aria-hidden="true"><Svg size={22}><path d="M3 21h18" /><path d="M5 21V7l7-4 7 4v14" /><path d="M9 21v-5h6v5" /><path d="M9 10h.01M15 10h.01" /></Svg></span>
                    <div style={{ marginRight: "auto", minWidth: 0 }}><h3>{c.name}</h3><p className="dsh-meta" style={{ marginBottom: 0 }}><Svg size={16} w={2}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>Cycle {e.cycle_no}{asm?.window_close ? ` · survey window closes ${asm.window_close.slice(0, 10)}` : ""}</p></div>
                    <span className="dsh-badge is-or">{human(e.state).toUpperCase()}</span><span className="dsh-badge">{(isConsultant ? "PAC Consultant" : human(myRoleHere ?? "Member")).toUpperCase()}</span><a className="dsh-pill" href={`/engagements/${e.engagement_id}`}>Open</a>
                  </div>
                  <Steps at={at} />
                  <p style={{ margin: 0, fontSize: 17 }}><b>Step {j.step} of {j.of}: {j.stage}.</b> {j.text}</p>
                  <div className="dsh-tiles">
                    {fl ? <Tile label="Responses" v={fl.submitted} of={fl.invited} /> : (
                      <div className="dsh-tile"><p className="dsh-eyebrow">Journey</p><span><span className="dsh-num">{j.step}</span><span className="dsh-of">of {j.of} steps</span></span><span /><div className="dsh-segs" aria-hidden="true">{Array.from({ length: j.of }, (_, i) => <span key={i} className={i < j.step ? "is-on" : ""} />)}</div></div>
                    )}
                    <Tile label="Reports released" v={rel} of={Math.max(reps.length, 1)} />
                    <Tile label="Actions accepted" v={accepted} of={Math.max(acts.length, 1)} />
                    <Tile label="Actions under way" v={moving} of={Math.max(accepted, 1)} />
                  </div>
                  {myRoleHere === "CLIENT_ADMIN" && e.state === "SETUP" && <NextStep label="Next step"><a className="dsh-pill is-or" href={`/engagements/${e.engagement_id}/org`}>Organisation and leaders</a></NextStep>}
                  {setup && <NextStep label="Next step"><a className="dsh-pill is-or" href={`/engagements/${e.engagement_id}/setup`}>{asm ? "Review setup and launch" : "Set up the assessment"}</a></NextStep>}
                  {next && (next.url ? <NextStep label="Next step"><Pipeline label={next.label} url={next.url} body={next.body} dsh /></NextStep> : next.href ? <NextStep label="Next step"><a className="dsh-pill is-or" href={next.href}>{next.label}</a></NextStep> : null)}
                  {!isConsultant && rel0 && myRoleHere !== "COACH" && <NextStep label="Your next step"><a className="dsh-pill is-or" href={`/assessments/${rel0.assessment_id}/plan`}>Review the action plan</a>{myRoleHere === "PEOPLE_LEADER" && <a className="dsh-pill" href={`/assessments/${rel0.assessment_id}/team`}>My team</a>}</NextStep>}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 18px" }} aria-label="Latest reports">
                    {(["ORGANISATIONAL", "BOARD_EXEC_SUMMARY", "SUB_CULTURE", "LEADERSHIP_TEAM"] as const).map((t) => { const r = latest(t); return r ? <a key={t} href={`/reports/${r.report_id}`} style={{ fontWeight: 700, color: "var(--ink)", textUnderlineOffset: 4 }}>{human(t)}{r.status === "RELEASED" ? "" : " (draft)"}</a> : null; })}
                    {reps.length === 0 && <span className="caption" style={{ fontSize: 14 }}>No reports are available yet.</span>}
                    {isConsultant && asm && asm.status !== "DRAFT" && <><a href={`/assessments/${asm.assessment_id}/leaders`} style={{ fontWeight: 700, color: "var(--ink)", textUnderlineOffset: 4 }}>Leadership 360</a>{asm.frozen_at && <>{[["segments", "Explore groups"], ["plan", "Action plan"]].map(([p, l]) => <a key={p} href={`/assessments/${asm.assessment_id}/${p}`} style={{ fontWeight: 700, color: "var(--ink)", textUnderlineOffset: 4 }}>{l}</a>)}<a href={`/engagements/${e.engagement_id}/measure`} style={{ fontWeight: 700, color: "var(--ink)", textUnderlineOffset: 4 }}>Measure</a></>}</>}
                  </div>
                </article>
              );
            })}
            {!sp.all && !sp.q && !sp.stage && total > cards.length && <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}><span className="caption" style={{ fontSize: 14 }}>Showing {cards.length} of {total} organisations, those that need you first.</span><a className="dsh-pill" href="/dashboard?all=1">Show all {total}</a></div>}
          </div>

          <aside className="dz-right" aria-label="Journey and key dates">
            {focus && (
              <section className="dsh-card dz-tl">
                <div className="dz-ch"><div><h2>Journey</h2><p className="dz-mini">{focus.name} · Cycle {focus.cycle}</p></div><span className="dsh-badge">{focus.j.step} OF {focus.j.of}</span></div>
                <ol className="dz-steps">
                  {STAGES.map((s, i) => {
                    const cls = i + 1 < focus.j.step ? "is-done" : i + 1 === focus.j.step ? "is-cur" : "is-future";
                    return <li key={s.label} className={cls}><span className="dz-n">{i + 1}</span><div className="dz-sc"><span className="dz-si" aria-hidden="true"><Svg d={STEP_ICON[s.label]} w={2} /></span><div><b>{s.label}</b><small>{cls === "is-done" ? "Done" : cls === "is-cur" ? focus.j.text : "Next"}</small></div></div></li>;
                  })}
                </ol>
              </section>
            )}
            {(dates.length > 0 || nextCard) && (
              <section className="dz-dates" aria-label="Key dates">
                <div className="dz-ch"><h2>Key dates</h2></div>
                {keyDates.map((d, i) => { const [, m, day] = d.date.split("-"); return <div key={i} className="dz-ev"><span className="dz-cal" aria-hidden="true"><b>{Number(day)}</b><i>{MONTH[Number(m) - 1]}</i></span><div><b>Survey window closes</b><small>Cycle {d.cycle} · {d.date}</small></div></div>; })}
                {nextCard?.released && <a className="dz-ev is-next" href={`/assessments/${nextCard.released.assessment_id}/plan`}><span className="dz-cal is-or" aria-hidden="true"><Svg size={20} w={2.4}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></Svg></span><div><b>Your next step</b><small>Review the action plan</small></div></a>}
              </section>
            )}
          </aside>
        </div>
      </main>
    </DashShell>
  );
}
