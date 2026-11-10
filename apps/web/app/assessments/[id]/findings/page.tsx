import "@/app/console.css";
import { notFound } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { FINDING_TITLE } from "@/lib/report-copy";
import { State } from "@/components/state";
import { CheckTiles } from "@/components/check-tiles";
import { human } from "@/lib/format";
import { GROUPS, bySeverity, checkTiles, label, type EvalPayload, type FindingRow } from "@/lib/findings-view";
import { staffGate } from "@/lib/session";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import Annotations from "./annotations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sevTone = (s: string) => (s === "CRITICAL" ? "bad" : s === "HIGH" ? "warn" : "grey");
const show = (v: unknown): string => (v === null || v === undefined ? "n/a" : typeof v === "object" ? JSON.stringify(v) : String(v));
const facts = (f: FindingRow) => [...Object.entries(f.metrics ?? {}), ...Object.entries(f.evidence ?? {})].filter(([, v]) => v !== null && v !== undefined && v !== "").slice(0, 8);

// Journey 4 F1: the consultant's findings console. Findings grouped by check and severity with their evidence, the matched scenarios, the
// consultant's notes, the workshop contradiction flags and the leader signals. Reads only the stored evaluation and the stores scoring wrote.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/assessments/${id}/findings`);
  const { data: asm } = await db.from("assessment").select("assessment_id, engagement_id, tenant_id").eq("assessment_id", id).maybeSingle();
  if (!asm) notFound();
  const { data: role } = await db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  if (role !== "PAC_CONSULTANT") notFound();
  const sa = admin();
  const [{ data: ten }, { data: ev }, { data: hrow }] = await Promise.all([
    sa.from("tenant").select("name").eq("tenant_id", asm.tenant_id).maybeSingle(),
    sa.from("evaluation").select("score_version, payload_json, payload_hash").eq("assessment_id", id).order("score_version", { ascending: false }).limit(1).maybeSingle(),
    sa.from("setup_record").select("payload_json").eq("engagement_id", asm.engagement_id).eq("section", "H").eq("perspective", "AGREED").eq("status", "AGREED").maybeSingle(),
  ]);
  const e = (ev?.payload_json ?? null) as EvalPayload | null;
  const [{ data: notes }, { data: links }, { data: lres }] = ev ? await Promise.all([
    sa.from("finding_annotation").select("annotation_id, finding_id, body, created_at").eq("assessment_id", id).eq("score_version", ev.score_version).order("created_at"),
    sa.from("leader_link_result").select("assignment_id, payload_json").eq("assessment_id", id).eq("score_version", ev.score_version),
    sa.from("leader_result").select("assignment_id, payload_json").eq("assessment_id", id).eq("score_version", ev.score_version),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  const ids = (links ?? []).map((l) => l.assignment_id);
  const { data: la } = ids.length ? await sa.from("leader_assignment").select("assignment_id, person_id").in("assignment_id", ids) : { data: [] };
  const { data: ppl } = la?.length ? await sa.from("person_of_record").select("person_id, display_name, employee_ref").in("person_id", la.map((x) => x.person_id)) : { data: [] };
  const nameOf = (aid: string) => { const p = ppl?.find((x) => x.person_id === la?.find((y) => y.assignment_id === aid)?.person_id); return p?.display_name ?? p?.employee_ref ?? aid; };
  const flagsOf = (aid: string) => ((lres?.find((r) => r.assignment_id === aid)?.payload_json as { flags?: string[] } | undefined)?.flags ?? []);
  const contradictions = (["h1", "h3", "h4"] as const).filter((k) => (hrow?.payload_json as Record<string, unknown> | null)?.[`contradiction_${k}`] === true);
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, asm.engagement_id, "findings")]);
  const notesOf = (fid: string) => (notes ?? []).filter((n) => n.finding_id === fid);
  const flagged = (links ?? []).map((l) => ({ id: l.assignment_id, link: l.payload_json as { classification: string; fit_band: string; contribution_quadrant: string | null }, flags: flagsOf(l.assignment_id) }))
    .filter((x) => x.flags.length || ["CRITICAL_BLOCKER", "CULTURE_BLOCKER"].includes(x.link.classification));

  return (
    <StaffShell section={tabs} title={`Findings · ${ten?.name ?? "Engagement"}`} subtitle="What the rules found, with the evidence behind each one. Notes here never change a result." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      <div className="cds">
        {!e ? <State tone="unavailable" title="No findings yet">Freeze the score, then run the findings from the Overview.</State> : (<>
          <h2 className="pt-h">Alignment scorecard</h2>
          <p className="pt-help">The four checks at a glance. Each tile shows the verdict and the figure that decided it; the response under a tile is the agreed way to act on it.</p>
          <CheckTiles tiles={checkTiles(e)} />
          {checkTiles(e).filter((t) => t.response).map((t) => <div key={t.key} className="cds-explain"><strong>{t.key} response.</strong> {t.response}</div>)}

          {GROUPS.map((g) => {
            const rows = e.findings.filter((f) => g.types.includes(f.type));
            return rows.length === 0 ? null : (
              <section key={g.key} className="cds-card" aria-labelledby={`g-${g.key}`}><h2 id={`g-${g.key}`}>{g.title}</h2><p className="pt-help">{g.help}</p>
                {bySeverity(rows).map(({ severity, rows: r }) => (
                  <div key={severity} style={{ marginTop: 10 }}><span className={`tag ${sevTone(severity)}`}>{human(severity)}</span>
                    {r.map((f) => (
                      <div key={f.finding_id} className="cds-check" style={{ marginTop: 8 }}>
                        <div className="top"><div><strong>{FINDING_TITLE[f.type] ?? label(f)}</strong> <span className="ssmall smuted">{label(f)} · <span style={{ fontFamily: "monospace" }}>{f.finding_id}</span></span></div><span className="small">{human(f.verdict)}{f.blocking ? " · blocks the related priority" : ""}</span></div>
                        <ul className="small muted" style={{ margin: "4px 0 0 18px" }}>{facts(f).map(([k, v]) => <li key={k}>{human(k)}: {show(v)}</li>)}</ul>
                        {f.type === "C3_STOP_START" && contradictions.length > 0 && <p className="small" style={{ marginTop: 4 }}>Workshop flags beside this check: {contradictions.map((k) => k.toUpperCase()).join(", ")} contradict what happens in practice (evidence only, the verdict is unchanged).</p>}
                        <Annotations assessmentId={id} findingId={f.finding_id} notes={notesOf(f.finding_id)} />
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            );
          })}

          {e.scenarios.length > 0 && (
            <section className="cds-card" aria-labelledby="g-sc"><h2 id="g-sc">Patterns the findings point to</h2><p className="pt-help">Known patterns that fit these findings together. Use the questions to test each one with the client before the debrief.</p>
              {e.scenarios.map((sc) => (
                <div className="cds-check" key={sc.scenario_id} style={{ marginTop: 8 }}>
                  <div className="top"><strong>{sc.scenario_id} · {sc.name}</strong><span className={`tag ${sevTone(sc.severity)}`}>{human(sc.severity)}</span></div>
                  <p className="small" style={{ marginTop: 4 }}>{sc.diagnosis}</p>
                  {sc.risks?.length ? <ul className="small muted" style={{ margin: "4px 0 0 18px" }}>{sc.risks.map((r) => <li key={r}>Risk: {r}</li>)}</ul> : null}
                  <ul className="small muted" style={{ margin: "4px 0 0 18px" }}>{sc.hypotheses.map((h) => <li key={h}>Ask: {h}</li>)}</ul>
                </div>
              ))}
            </section>
          )}

          <section className="cds-card" aria-labelledby="g-ld"><h2 id="g-ld">Leader signals (consultant only)</h2>
            <p className="cds-sub" style={{ marginTop: 2 }}>Flags and blockers per leader, from the leader links stored at scoring. They block that leader&apos;s unit only. Never shown to the client and never exported.</p>
            {flagged.length === 0 ? <p className="small muted">No leader carries a flag or a blocker class in this score.</p> : (
              <div className="stblwrap"><table className="stbl"><thead><tr><th>Leader</th><th>Flags</th><th>Fit</th><th>Class</th></tr></thead><tbody>
                {flagged.map((x) => <tr key={x.id}><td><strong>{nameOf(x.id)}</strong></td><td className="ssmall">{x.flags.length ? x.flags.map((f) => human(f)).join(", ") : "None"}</td><td className="ssmall">{human(x.link.fit_band)}</td><td className="ssmall">{human(x.link.classification)}</td></tr>)}
              </tbody></table></div>)}
          </section>
          <p className="ssmall smuted">Score version {ev!.score_version} · evaluation {ev!.payload_hash.slice(0, 19)}…</p>
        </>)}
      </div>
    </StaffShell>
  );
}
