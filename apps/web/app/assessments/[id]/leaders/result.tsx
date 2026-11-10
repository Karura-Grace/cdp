import { ORIENT_COLOR, ORIENT_NAME, dp, human, signed, type Orientation } from "@/lib/format";
import ITEMS from "@/lib/l360-items.json";
import type { LeaderExtra } from "@/lib/leader-extras";

// One leader's 360 result: self against others per section, and what it says. Shared by the consultant's page and the People
// Leader's own view.
export type Sec = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";
export type LeaderResultView = {
  valid: boolean; rater_count: number; invalid_reason?: string; groups_published?: string[];
  self_avg?: Record<Sec, string | null>; other_avg?: Record<Sec, string | null>; lri?: string; lri_band?: string; growth?: Orientation; default?: Orientation[];
  flags?: string[]; self_other?: Partial<Record<Sec, { gap: string; tier: string }>>;
};
const TIER: Record<string, string> = { ALIGNED: "ok", WATCH: "warn", BLIND_SPOT: "orange" };
const GROUP: Record<string, string> = { SUPERIOR: "Manager", PEER: "Peer", DIRECT_REPORT: "Direct report", OTHER: "Other" };
const KNOWN: Record<string, string> = { LT1Y: "under a year", Y1_3: "one to three years", Y3P: "over three years", NONE: "not given" };
const CONTACT: Record<string, string> = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", RARELY: "rarely", NONE: "not given" };
export function Result({ r, x }: { r: LeaderResultView; x?: LeaderExtra }) {
  const secs = ITEMS.sections as { key: Sec; name: string }[];
  const orient: Partial<Record<Sec, Orientation>> = { A: "ENGAGE", B: "INNOVATE", C: "PERFORM", D: "GOVERN" };
  return (
    <div className="cds-two" style={{ marginTop: 4 }}>
      <div>
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>Self versus others (1 to 5)</h3>
        {secs.map((s) => {
          const self = r.self_avg![s.key], other = r.other_avg![s.key], so = r.self_other?.[s.key];
          const color = orient[s.key] ? ORIENT_COLOR[orient[s.key]!] : "var(--grey)";
          return (
            <div className="cds-gaprow" key={s.key} style={{ gridTemplateColumns: "150px 1fr 70px" }}>
              <div className="ssmall"><strong>{s.name}</strong></div>
              <div>
                <div className="cds-track" title="Others"><div style={{ width: `${other ? (parseFloat(other) / 5) * 100 : 0}%`, background: color }} /></div>
                <div className="cds-track" title="Self" style={{ marginTop: 3, height: 6 }}><div style={{ width: `${self ? (parseFloat(self) / 5) * 100 : 0}%`, height: 6, background: color, opacity: 0.4 }} /></div>
                <span className="ssmall smuted">Others {other ? dp(other, 2) : "n/a"} · Self {self ? dp(self, 2) : "n/a"}</span>
              </div>
              <div style={{ textAlign: "right" }}>{so && <span className={`stag ${TIER[so.tier] ?? ""}`} title={`Self minus others ${signed(so.gap, 2)}`}>{human(so.tier)}</span>}</div>
            </div>
          );
        })}
      </div>
      <div>
        <h3 style={{ fontSize: 14, marginBottom: 6 }}>What it says</h3>
        <ul className="ssmall" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          {r.default && <li>Default style: <strong>{r.default.map((o) => ORIENT_NAME[o]).join(" and ")}</strong>.</li>}
          {r.growth && <li>Growth area: <strong>{ORIENT_NAME[r.growth]}</strong>.</li>}
          <li>Leadership readiness: <strong>{dp(r.lri!, 2)}</strong> ({human(r.lri_band ?? "")}).</li>
          {r.flags?.length ? <li>Flags: {r.flags.map(human).join(", ")}.</li> : <li>No flags.</li>}
          <li>{r.rater_count} raters; groups shown: {(r.groups_published ?? []).map((g) => GROUP[g] ?? human(g)).join(", ") || "merged"}.</li>
        </ul>
        <div className="cds-explain">A blind spot means the leader rates themselves well above how others see them. These results are for development only, never for pay, promotion or discipline decisions.</div>
      </div>
      {x && <Highlights x={x} />}
      <Reflection r={r} />
    </div>
  );
}

// The five strongest and weakest behaviours as raters see them, with the leader's own rating beside each.
function Highlights({ x }: { x: LeaderExtra }) {
  const items = ITEMS.rater as string[];
  const list = (title: string, rows: LeaderExtra["top"]) => (
    <div><h3 style={{ fontSize: 14, marginBottom: 6 }}>{title}</h3>
      <table className="tbl"><thead><tr><th>Behaviour</th><th>Others</th><th>Self</th></tr></thead><tbody>
        {rows.map((h) => <tr key={h.item}><td className="ssmall">{items[h.item - 1]}</td><td><b>{dp(h.others, 2)}</b></td><td>{h.self ?? "n/a"}</td></tr>)}
      </tbody></table></div>);
  const band = (m: Record<string, number>, names: Record<string, string>) => Object.entries(m).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${names[k] ?? k}`).join(", ");
  return (
    <>
      {list("Five strongest behaviours", x.top)}
      {list("Five behaviours to develop", x.bottom)}
      {x.meta && <p className="ssmall smuted" style={{ gridColumn: "1 / -1" }}>How the {x.meta.raters} raters know this leader: worked together {band(x.meta.known_for, KNOWN)}; in contact {band(x.meta.contact, CONTACT)}.</p>}
    </>
  );
}

// Questions for the leader to reflect on, from the self against others tiers in the frozen result.
function Reflection({ r }: { r: LeaderResultView }) {
  const secs = ITEMS.sections as { key: Sec; name: string }[];
  const so = r.self_other ?? {};
  const blind = secs.filter((s) => so[s.key]?.tier === "BLIND_SPOT" && parseFloat(so[s.key]!.gap) > 0);
  const hidden = secs.filter((s) => so[s.key] && so[s.key]!.tier !== "ALIGNED" && parseFloat(so[s.key]!.gap) < 0);
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      <h3 style={{ fontSize: 14, marginBottom: 6 }}>For your own reflection</h3>
      <ul className="ssmall" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
        {blind.map((s) => <li key={s.key}>You rate yourself higher than others do on <b>{s.name}</b>. What might others see that you do not?</li>)}
        {hidden.map((s) => <li key={s.key}>Others rate you higher than you rate yourself on <b>{s.name}</b>. How could you use this strength more deliberately?</li>)}
        <li>Which one behaviour, if you changed it in the next 30 days, would your team notice first?</li>
        <li>Who could you ask for honest feedback on that change, and when?</li>
      </ul>
    </div>
  );
}

