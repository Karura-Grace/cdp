import "@/app/console.css";
import { notFound } from "next/navigation";
import * as E from "@pac/cdp-engine";
import { StaffShell } from "@/components/staff-shell";
import { State } from "@/components/state";
import { ORIENT_NAME, ORIENTATIONS, dp, signed, type Orientation } from "@/lib/format";
import { alphaNotes } from "@/lib/score-review";
import { loadSetup } from "@/lib/scoring";
import { staffGate } from "@/lib/session";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import ScoreActions from "./score-actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Prof = Record<Orientation, string>;
type P = {
  orientation_scores: { now: Prof; preferred: Prof; gap: Prof }; classification: Record<Orientation, string>; significant: Record<Orientation, boolean>;
  dominance: { dominant: string[] }; culture_strength: string; strength_band: string;
  readiness: { d7: string | null; d8: string | null; d9: string | null; d7_band: string | null; d8_band: string | null; d9_band: string | null; tps: string | null; tps_band: string | null;
    coverage: string; provisional: boolean; alpha: Record<"D7" | "D8" | "D9", string | null> };
  eos: Record<string, string | number | null>; quality: { states: Record<string, number>; median_duration: string | null; flags: Record<string, number> };
  counts: { now: number; preferred: number };
};
type Manifest = { invited?: number; started?: number; submitted?: number; abandoned?: number; auto_submitted?: number; counts_by_state?: Record<string, number>;
  extensions?: { seq: number; working_days: number; reason: string }[] };

const FORMULA: [string, string][] = [
  ["NOW and PREFERRED", "Each orientation is the mean of its points over the valid responses, out of 100. The gap is PREFERRED minus NOW, and the class comes from the gap size (spec chapter 3)."],
  ["Readiness", "D7, D8 and D9 are the mean of the 12 statements each, 1 to 5, from responses that answered them. TPS blends them with leadership alignment."],
  ["eOS", "For each of Q1 to Q8: 100 x (advocates minus critics) divided by valid answers, rounded to a whole number. The index is the mean of the eight, to one decimal."],
  ["Routing", "A weak eOS category points to the orientation most likely to move it (spec Table 48). It is a suggestion: read it with D1 to D9."],
];

// Journey 3 S7: the consultant's check between running the score and freezing it. Everything comes from the stored score payload and the
// freeze manifest, never from the responses. PAC Consultant on the engagement only.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/assessments/${id}/score-review`);
  const { data: asm } = await db.from("assessment").select("assessment_id, engagement_id, tenant_id, frozen_at, freeze_manifest, instrument_version(semver), rules_version(semver)").eq("assessment_id", id).maybeSingle();
  if (!asm) notFound();
  const { data: role } = await db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  if (role !== "PAC_CONSULTANT") notFound();
  const sa = admin();
  const [{ data: ten }, { data: so }, { data: eng }] = await Promise.all([
    sa.from("tenant").select("name").eq("tenant_id", asm.tenant_id).maybeSingle(),
    sa.from("score_object").select("version, payload_json, payload_hash, frozen_at").eq("assessment_id", id).order("version", { ascending: false }).limit(1).maybeSingle(),
    sa.from("engagement").select("state").eq("engagement_id", asm.engagement_id).single(),
  ]);
  const p = (so?.payload_json ?? null) as P | null;
  const m = (asm.freeze_manifest ?? {}) as Manifest;
  let target: Orientation | null = null;
  try { target = (E.deriveSetup((await loadSetup(asm.engagement_id)).input).leadership_target_orientation ?? null) as Orientation | null; } catch { /* Section F tie not resolved yet: Q2 routes to the target only once it is */ }
  const instrument = (asm.instrument_version as { semver?: string } | null)?.semver ?? "n/a", rules = (asm.rules_version as { semver?: string } | null)?.semver ?? "n/a";
  const rate = m.invited ? Math.round(100 * (m.submitted ?? 0) / m.invited) : null;
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, asm.engagement_id, "score-review")]);

  return (
    <StaffShell section={tabs} title={`Score review · ${ten?.name ?? "Engagement"}`} subtitle="Check the score before it is frozen. Nothing here is visible to the client." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      <div className="cds">
        <ScoreActions assessmentId={id} version={so?.version ?? null} hash={so?.payload_hash ?? null} frozen={!!so?.frozen_at} instrument={instrument} rules={rules}
          canRun={eng?.state === "SCORING"} canFreeze={eng?.state === "SCORING"} />
        {!p || !so ? <State tone="unavailable" title="No score yet">Run the score to review it here.</State> : (<>
          <section className="cds-card" aria-labelledby="sr-o"><h2 id="sr-o" style={{ fontSize: 17, fontWeight: 700 }}>Culture now and preferred</h2>
            <p className="cds-sub" style={{ marginTop: 2 }}>Points out of 100. Dominant Now: {p.dominance.dominant.map((o) => ORIENT_NAME[o as Orientation]).join(" and ")}. Strength {dp(p.culture_strength, 1)} ({p.strength_band.toLowerCase()}).</p>
            <div className="stblwrap"><table className="stbl"><thead><tr><th>Orientation</th><th style={{ textAlign: "right" }}>Now</th><th style={{ textAlign: "right" }}>Preferred</th><th style={{ textAlign: "right" }}>Gap</th><th>Class</th></tr></thead>
              <tbody>{ORIENTATIONS.map((o) => <tr key={o}><td><strong>{ORIENT_NAME[o]}</strong></td><td style={{ textAlign: "right" }}>{dp(p.orientation_scores.now[o], 1)}</td><td style={{ textAlign: "right" }}>{dp(p.orientation_scores.preferred[o], 1)}</td>
                <td style={{ textAlign: "right" }}>{signed(p.orientation_scores.gap[o], 1)}</td><td className="ssmall">{p.classification[o].replace(/_/g, " ").toLowerCase()}{p.significant[o] ? "" : " (not significant)"}</td></tr>)}</tbody></table></div></section>

          <section className="cds-card" aria-labelledby="sr-r"><h2 id="sr-r" style={{ fontSize: 17, fontWeight: 700 }}>Readiness</h2>
            <div className="stblwrap"><table className="stbl"><thead><tr><th>Measure</th><th style={{ textAlign: "right" }}>Value</th><th>Band</th></tr></thead><tbody>
              {(["d7", "d8", "d9"] as const).map((d) => <tr key={d}><td>{d.toUpperCase()}</td><td style={{ textAlign: "right" }}>{p.readiness[d] ? dp(p.readiness[d]!, 2) : "n/a"}</td><td className="ssmall">{p.readiness[`${d}_band`] ?? "n/a"}</td></tr>)}
              <tr><td>TPS</td><td style={{ textAlign: "right" }}>{p.readiness.tps ? dp(p.readiness.tps, 2) : "n/a"}</td><td className="ssmall">{p.readiness.tps_band ?? "n/a"}{p.readiness.provisional ? " (provisional: few leaders have a valid 360)" : ""}</td></tr></tbody></table></div>
            {alphaNotes(p.readiness.alpha).map((t) => <div key={t} className="cds-explain">{t}</div>)}</section>

          <section className="cds-card" aria-labelledby="sr-e"><h2 id="sr-e" style={{ fontSize: 17, fontWeight: 700 }}>Employee voice (eOS) and routing</h2>
            <p className="cds-sub" style={{ marginTop: 2 }}>Index {p.eos.index !== null && p.eos.index !== undefined ? dp(p.eos.index as string, 1) : "n/a"}. A negative category needs listening sessions with the affected group within 30 days.</p>
            <div className="stblwrap"><table className="stbl"><thead><tr><th>Category</th><th style={{ textAlign: "right" }}>Score</th><th>Band</th><th>Points to</th></tr></thead><tbody>
              {Object.keys(p.eos).filter((k) => /^Q\d$/.test(k)).map((k) => { const v = p.eos[k] as number | null; const r = E.eosRoute(k, target); return (
                <tr key={k}><td>{k}</td><td style={{ textAlign: "right" }}>{v ?? "n/a"}</td><td className="ssmall">{v === null ? "n/a" : E.eosBand(v).toLowerCase()}</td>
                  <td className="ssmall">{v !== null && v < 0 && r ? `${r.primary ? ORIENT_NAME[r.primary] : "the leadership target (not set yet)"}, then ${r.secondary === "ALL" ? "all orientations" : ORIENT_NAME[r.secondary]} (${r.why})` : ""}</td></tr>); })}</tbody></table></div></section>

          <section className="cds-card" aria-labelledby="sr-q"><h2 id="sr-q" style={{ fontSize: 17, fontWeight: 700 }}>Response rate and data quality</h2>
            <div className="stf-kpis">
              <div className="stf-kpi"><div className="l">Invited</div><div className="v">{m.invited ?? "n/a"}</div></div>
              <div className="stf-kpi"><div className="l">Submitted</div><div className="v">{m.submitted ?? "n/a"}</div><div className="n">{rate === null ? "" : `${rate}% of invited`}</div></div>
              <div className="stf-kpi"><div className="l">Used in the score</div><div className="v">{p.counts.now}</div><div className="n">{p.counts.preferred} for preferred</div></div>
            </div>
            <div className="stblwrap"><table className="stbl"><thead><tr><th>Check</th><th>Result</th></tr></thead><tbody>
              <tr><td>Started, not submitted</td><td>{m.abandoned ?? "n/a"}</td></tr>
              <tr><td>Submitted automatically at close</td><td>{m.auto_submitted ?? 0}</td></tr>
              <tr><td>Completion states</td><td className="ssmall">{Object.entries(p.quality.states).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(", ") || "n/a"}</td></tr>
              <tr><td>Quality flags</td><td className="ssmall">{Object.entries(p.quality.flags).map(([k, v]) => `${k.replace(/_/g, " ").toLowerCase()} ${v}`).join(", ")}</td></tr>
              <tr><td>Window extensions</td><td className="ssmall">{m.extensions?.length ? m.extensions.map((x) => `${x.seq}: ${x.working_days} working days, ${x.reason}`).join("; ") : "none"}</td></tr>
            </tbody></table></div></section>

          <section className="cds-card" aria-labelledby="sr-f"><h2 id="sr-f" style={{ fontSize: 17, fontWeight: 700 }}>How each number is made</h2>
            {FORMULA.map(([h, t]) => <details key={h} style={{ marginTop: 6 }}><summary><strong>{h}</strong></summary><p className="ssmall" style={{ marginTop: 4 }}>{t}</p></details>)}
            <p className="ssmall smuted" style={{ marginTop: 10 }}>Score version {so.version} · {so.payload_hash} · instrument {instrument} · rules {rules}</p></section>
        </>)}
      </div>
    </StaffShell>
  );
}
