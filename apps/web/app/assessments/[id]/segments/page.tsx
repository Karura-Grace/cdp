import { servicesOf } from "@/lib/services";
import "@/app/console.css";
import { State } from "@/components/state";
import { notFound } from "next/navigation";
import * as E from "@pac/cdp-engine";
import { StaffShell } from "@/components/staff-shell";
import { ORIENT_COLOR, ORIENT_NAME, ORIENTATIONS, dp, signed, type Orientation } from "@/lib/format";
import { AXES, AXIS_LABEL, MAX_COMPARE, MAX_FILTER, parseFilter, segmentFilter, segmentView, verdictLabel, type Axis } from "@/lib/segments";
import { staffGate } from "@/lib/session";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { serverDb } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Prof = Record<Orientation, string>;
type Metrics = { n: number; now: Prof; diff: Prof; gap: Prof | null; sdi: string; readiness: { d8: string | null }; eos_index: string | null; subculture: E.SubcultureResult };
type Cell = { value: string; n: number | null; suppressed: boolean; reason?: string; rollup_label?: string; metrics?: Metrics };

const REASON: Record<string, string> = {
  PRIMARY_FLOOR: "fewer than 5 responses",
  DIFFERENCING_PROTECTION: "a smaller group could be worked out by subtraction",
  COMBINATION_FLOOR: "too few responses in this combination",
};
// Tint a cell by how far the group sits from the whole organisation (points out of 100). Colour only adds to the number.
const tint = (d: string, o: Orientation) => {
  const v = Math.min(Math.abs(parseFloat(d)) / 12, 1);
  return v < 0.08 ? "transparent" : `color-mix(in srgb, ${ORIENT_COLOR[o]} ${Math.round(8 + v * 30)}%, white)`;
};

// Segments of the frozen score by department, grade and tenure. PAC Consultant on the engagement only (the same rule as the
// API). Every view is logged. Groups under the floor, and groups that subtraction would expose, are hidden by the engine.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const q = await searchParams;
  const db = await serverDb();
  const { user } = await staffGate(db, `/assessments/${id}/segments`);
  const { data: asm } = await db.from("assessment").select("assessment_id, engagement_id, tenant_id, frozen_at").eq("assessment_id", id).maybeSingle();
  if (!asm) notFound();
  if (!(await servicesOf(asm.tenant_id)).includes("GROUP_RESULTS")) notFound();   // a paid service (owner ruling 22 Oct 2026)
  const { data: role } = await db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  if (role !== "PAC_CONSULTANT") notFound();
  const { data: ten } = await db.from("tenant").select("name").eq("tenant_id", asm.tenant_id).maybeSingle();
  const { data: rep } = await db.from("report").select("report_id").eq("assessment_id", id).order("created_at").limit(1).maybeSingle();

  const axis: Axis = AXES.includes(q.axis as Axis) ? (q.axis as Axis) : "grade";
  const pAxis = AXES.includes(q.in as Axis) && q.in !== axis && q.v ? (q.in as Axis) : null;
  const pValue = pAxis ? q.v!.slice(0, 120) : null;
  const v = await segmentView(id, asm.engagement_id, !!asm.frozen_at, user.id, axis, pAxis, pValue);
  const cells = v.ok ? (E.toJsonable(v.cells) as Cell[]) : [];
  const shown = cells.filter((c) => !c.suppressed);
  // compare: up to four ticked groups, each one a single cut that must meet the floor on its own
  const picks = ([] as string[]).concat(q.cx ?? []).slice(0, MAX_COMPARE); // repeated ?cx= arrives as an array
  const compared = await Promise.all(picks.map(async (pk) => {
    const f = parseFilter([pk]);
    const r = f ? await segmentFilter(id, asm.engagement_id, !!asm.frozen_at, user.id, f, false) : null;
    return { key: pk, r };
  }));
  // filter builder: an AND of up to three cuts
  const fparts = [1, 2, 3].map((i) => (q[`fa${i}`] && q[`fv${i}`] ? `${q[`fa${i}`]}:${q[`fv${i}`]}` : "")).filter(Boolean);
  const filt = fparts.length ? parseFilter(fparts) : null;
  const fres = filt ? await segmentFilter(id, asm.engagement_id, !!asm.frozen_at, user.id, filt, false) : null;
  const fm = fres && fres.ok && !fres.below ? (fres.metrics as Metrics) : null;
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, asm.engagement_id, "segments")]);
  const href = (a: Axis, inA?: Axis | null, val?: string | null) => `?axis=${a}${inA && val ? `&in=${inA}&v=${encodeURIComponent(val)}` : ""}`;

  return (
    <StaffShell section={tabs} title={`Results by group · ${ten?.name ?? "Engagement"}`} subtitle="How the culture differs across groups. Small groups stay hidden to protect anonymity." nav={nav}
      email={user.email ?? ""} roleLabel={roleLabel}
      actions={<>{rep && <a className="sbtn ghost" href={`/reports/${rep.report_id}`}>Report</a>}<a className="sbtn ghost" href="/dashboard">All engagements</a></>}>
      <div className="cds">
        <div className="cds-toolbar" role="group" aria-label="Break down by">
          <div className="cds-seg">
            {AXES.map((a) => <a key={a} href={href(a, pAxis === a ? null : pAxis, pAxis === a ? null : pValue)} className={a === axis ? "on" : ""} aria-current={a === axis ? "true" : undefined}
              style={{ display: "inline-block", padding: "6px 15px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, textDecoration: "none", color: a === axis ? "var(--orange-d)" : "var(--grey)", background: a === axis ? "#fff" : "transparent" }}>{AXIS_LABEL[a]}</a>)}
          </div>
          {pAxis && <span className="stag orange">Inside {AXIS_LABEL[pAxis]}: {pValue} <a href={href(axis)} aria-label="Clear the group filter" style={{ color: "inherit", marginLeft: 4 }}>×</a></span>}
        </div>

        {!v.ok ? (
          <State tone={v.code === "BELOW_REPORTING_THRESHOLD" ? "suppressed" : "unavailable"} title={v.code === "BELOW_REPORTING_THRESHOLD" ? "This group is too small to report" : "Segments are not available yet"} action={pAxis ? <a className="sbtn ghost" href={href(axis)}>Back to whole organisation</a> : undefined}>{v.code === "BELOW_REPORTING_THRESHOLD" ? `Fewer than ${v.minimum} people answered in this group, so it is merged into the organisation result.` : v.title}</State>
        ) : (
          <>
            <div className="stf-kpis">
              <div className="stf-kpi"><div className="l">Groups</div><div className="v">{cells.length}</div><div className="n">by {AXIS_LABEL[axis].toLowerCase()}</div></div>
              <div className="stf-kpi"><div className="l">Reported</div><div className="v">{shown.length}</div><div className="n">at least {v.floor} responses each</div></div>
              <div className="stf-kpi"><div className="l">Hidden</div><div className="v">{cells.length - shown.length}</div><div className="n">to protect anonymity</div></div>
            </div>
            <section className="cds-card" aria-labelledby="hm">
              <h2 id="hm">Culture Now, by {AXIS_LABEL[axis].toLowerCase()}</h2>
              <p className="pt-help">Points out of 100 per energy. The shade shows how far a group sits from the whole organisation; the small figure is that difference.</p>
              <div className="stblwrap"><table className="stbl">
                <thead><tr><th><span className="sr-only">Compare</span></th><th>{AXIS_LABEL[axis]}</th><th style={{ textAlign: "right" }}>Responses</th>{ORIENTATIONS.map((o) => <th key={o} style={{ textAlign: "center" }}>{ORIENT_NAME[o]}</th>)}<th style={{ textAlign: "center" }}>Safety (D8)</th><th>Label</th><th /></tr></thead>
                <tbody>{cells.map((c) => c.suppressed || !c.metrics ? (
                  <tr key={c.value}><td /><td><strong>{c.value === "UNKNOWN" ? "Not recorded" : c.value}</strong></td>
                    <td colSpan={8} className="smuted ssmall">Hidden: {REASON[c.reason ?? ""] ?? "too few responses"}. {c.rollup_label ? `Counted in the ${c.rollup_label.replace(/^merged into /, "")} result.` : ""}</td></tr>
                ) : (
                  <tr key={c.value}><td><input type="checkbox" form="cmp" name="cx" value={`${axis}:${c.value}`} aria-label={`Compare ${c.value}`} /></td><td><strong>{c.value === "UNKNOWN" ? "Not recorded" : c.value}</strong></td>
                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.n}</td>
                    {ORIENTATIONS.map((o) => <td key={o} style={{ textAlign: "center", background: tint(c.metrics!.diff[o], o), fontVariantNumeric: "tabular-nums" }}>
                      <strong>{dp(c.metrics!.now[o], 0)}</strong> <span className="ssmall smuted">{signed(c.metrics!.diff[o], 0)}</span></td>)}
                    <td style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{c.metrics.readiness.d8 ? dp(c.metrics.readiness.d8, 1) : "n/a"}</td>
                    <td className="ssmall">{(() => { const l = verdictLabel(c.metrics.subculture); return l.label ? <span title={`Tests passed: ${l.tests.join(", ")}`} className={`stag ${l.label.startsWith("Sub") ? "orange" : ""}`}>{l.label}</span> : <span className="smuted">None</span>; })()}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{!pAxis && <a className="ssmall" href={href(AXES.find((a) => a !== axis)!, axis, c.value)}>Look inside</a>}</td></tr>
                ))}</tbody>
              </table></div>
              {cells.length > shown.length && <div className="cds-explain">The engine hides any group with fewer than {v.floor} responses. When one group is hidden, others may be hidden too, so the hidden one cannot be worked out by subtraction from the total. Hidden groups are still counted in the organisation result.</div>}
            </section>
            <form id="cmp" method="get" className="cds-toolbar">
              <input type="hidden" name="axis" value={axis} />
              {pAxis && <><input type="hidden" name="in" value={pAxis} /><input type="hidden" name="v" value={pValue ?? ""} /></>}
              <span className="ssmall smuted">Tick up to {MAX_COMPARE} groups, then compare them with the organisation.</span>
              <button className="sbtn" type="submit" name="go" value="1">Compare ticked</button>
              <a className="sbtn ghost" href={`/v1/assessments/${id}/segments/export`}>Download Excel</a>
            </form>
            {compared.length > 0 && (
              <section className="cds-card" aria-labelledby="cp"><h2 id="cp">Comparison</h2>
                <div className="stblwrap"><table className="stbl"><thead><tr><th>Group</th><th style={{ textAlign: "right" }}>Responses</th>{ORIENTATIONS.map((o) => <th key={o} style={{ textAlign: "center" }}>{ORIENT_NAME[o]}</th>)}<th>SDI</th><th>Label</th></tr></thead>
                  <tbody>{compared.map(({ key, r }) => r && r.ok && !r.below ? (() => { const m = r.metrics as Metrics; const l = verdictLabel(m.subculture); return (
                    <tr key={key}><td><strong>{key.slice(key.indexOf(":") + 1)}</strong></td><td style={{ textAlign: "right" }}>{m.n}</td>{ORIENTATIONS.map((o) => <td key={o} style={{ textAlign: "center" }}><strong>{dp(m.now[o], 0)}</strong> <span className="ssmall smuted">{signed(m.diff[o], 0)}</span></td>)}<td>{dp(m.sdi, 1)}</td><td className="ssmall">{l.label ?? "None"}</td></tr>); })() : (
                    <tr key={key}><td><strong>{key.slice(key.indexOf(":") + 1)}</strong></td><td colSpan={7} className="smuted ssmall">Below reporting threshold. Counted in the organisation result.</td></tr>))}</tbody></table></div>
                <div className="cds-explain">The small figure beside each score is the difference from the whole organisation.</div></section>
            )}
            <section className="cds-card" aria-labelledby="fb"><h2 id="fb">Filter</h2>
              <p className="pt-help">Combine up to {MAX_FILTER} cuts (all must match). A group with fewer than 5 responses is never shown.</p>
              <form method="get" className="cds-toolbar" style={{ flexWrap: "wrap" }}>
                <input type="hidden" name="axis" value={axis} />
                {[1, 2, 3].map((i) => <span key={i}><select name={`fa${i}`} defaultValue={q[`fa${i}`] ?? ""} aria-label={`Cut ${i}`}><option value="">Cut {i}</option>{AXES.map((a) => <option key={a} value={a}>{AXIS_LABEL[a]}</option>)}</select>{" "}
                  <input name={`fv${i}`} defaultValue={q[`fv${i}`] ?? ""} placeholder="Value" maxLength={120} aria-label={`Value ${i}`} /></span>)}
                <button className="sbtn" type="submit">Show</button>
              </form>
              {fparts.length > 0 && !filt && <div className="cds-explain">Use different cuts, each with a value.</div>}
              {fres && !fres.ok && <State tone="suppressed" title="Fewer than 5 people match">This combination is too small to report, so no results are shown. It is counted in the organisation result.</State>}
              {fm && (() => { const l = verdictLabel(fm.subculture); return (
                <div className="stblwrap"><table className="stbl"><thead><tr><th style={{ textAlign: "right" }}>Responses</th>{ORIENTATIONS.map((o) => <th key={o} style={{ textAlign: "center" }}>{ORIENT_NAME[o]}</th>)}<th>SDI</th><th>Label</th></tr></thead>
                  <tbody><tr><td style={{ textAlign: "right" }}>{fm.n}</td>{ORIENTATIONS.map((o) => <td key={o} style={{ textAlign: "center" }}><strong>{dp(fm.now[o], 0)}</strong> <span className="ssmall smuted">{signed(fm.diff[o], 0)}</span></td>)}<td>{dp(fm.sdi, 1)}</td><td className="ssmall">{l.label ?? "None"}</td></tr></tbody></table></div>); })()}
            </section>
            <p className="ssmall smuted">Score version {v.score_version} · {v.payload_hash.slice(0, 19)}… · each view of this page is recorded in the segment query log.</p>
          </>
        )}
      </div>
    </StaffShell>
  );
}
