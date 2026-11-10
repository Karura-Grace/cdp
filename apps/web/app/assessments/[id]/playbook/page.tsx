import "@/app/console.css";
import { notFound } from "next/navigation";
import * as E from "@pac/cdp-engine";
import { StaffShell } from "@/components/staff-shell";
import { ORIENT_COLOR, ORIENT_NAME, ORIENTATIONS, type Orientation } from "@/lib/format";
import { staffGate } from "@/lib/session";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Lines = ({ v }: { v: string[] }) => (v.length > 1 ? <ul style={{ margin: "0 0 0 16px" }}>{v.map((x) => <li key={x}>{x}</li>)}</ul> : <>{v[0]}</>);

// The orientation playbook (spec Part B 11.7 to 11.10), a reader for the people who run the plan: what each orientation is, how to work with
// the others at each level, the measures that show it, and the actions that build it. Same access as the action plan: the consultant always,
// client roles only once a plan is released to them (the plan is read with the caller's own token, so row level security decides).
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const q = await searchParams;
  const db = await serverDb();
  const { user } = await staffGate(db, `/assessments/${id}/playbook`);
  const { data: asm } = await admin().from("assessment").select("assessment_id, engagement_id, tenant_id").eq("assessment_id", id).maybeSingle();
  if (!asm) notFound();
  const { data: role } = await db.rpc("rpc_actor_role", { p_engagement: asm.engagement_id });
  if (!role || role === "COACH") notFound();
  if (role !== "PAC_CONSULTANT") {
    const { data: plan } = await db.from("plan").select("score_version").eq("assessment_id", id).limit(1).maybeSingle();
    if (!plan) notFound();
  }
  const { data: ten } = await admin().from("tenant").select("name").eq("tenant_id", asm.tenant_id).maybeSingle();
  const o: Orientation = (ORIENTATIONS as readonly string[]).includes(q.o ?? "") ? (q.o as Orientation) : "ENGAGE";
  const pb = E.ORIENTATION_PLAYBOOK[o];
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, asm.engagement_id, "playbook")]);

  return (
    <StaffShell section={tabs} title={`Playbook · ${ten?.name ?? "Engagement"}`} subtitle="What each orientation is, how to work with the others, and the actions that build it." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>
      <div className="cds">
        <div className="cds-toolbar" role="group" aria-label="Orientation">
          {ORIENTATIONS.map((x) => <a key={x} href={`?o=${x}`} aria-current={x === o ? "true" : undefined} className={x === o ? "sbtn" : "sbtn ghost"}>{ORIENT_NAME[x]}</a>)}
        </div>
        <section className="cds-card" aria-labelledby="pb-p">
          <h2 id="pb-p" style={{ fontSize: 19, fontWeight: 700, color: ORIENT_COLOR[o] }}>{ORIENT_NAME[o]}</h2>
          <p className="cds-sub" style={{ marginTop: 2 }}>{pb.tagline}</p>
          <p style={{ margin: "8px 0" }}>{pb.intro}</p>
          <div className="stblwrap"><table className="stbl"><tbody>{pb.profile.map((r) => <tr key={r.attribute}><th scope="row" style={{ width: "26%", textAlign: "left" }}>{r.attribute}</th><td><Lines v={r.specification} /></td></tr>)}</tbody></table></div>
        </section>

        <section className="cds-card" aria-labelledby="pb-m"><h2 id="pb-m" style={{ fontSize: 17, fontWeight: 700 }}>Working with the other orientations</h2>
          <p className="cds-sub" style={{ marginTop: 2 }}>{pb.matrix.note}</p>
          <div className="stblwrap"><table className="stbl"><thead><tr><th /> {pb.matrix.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{pb.matrix.rows.map((r) => <tr key={r.label}><th scope="row" style={{ textAlign: "left" }}>{r.label}</th>{r.cells.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table></div>
        </section>

        <section className="cds-card" aria-labelledby="pb-x"><h2 id="pb-x" style={{ fontSize: 17, fontWeight: 700 }}>Measures and outcomes</h2>
          <div className="stblwrap"><table className="stbl"><thead><tr><th /> {pb.metrics.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{pb.metrics.rows.map((r) => <tr key={r.label}><th scope="row" style={{ textAlign: "left" }}>{r.label}</th>{r.values.length === 1 ? <td colSpan={pb.metrics.columns.length}><Lines v={r.values[0]} /></td> : r.values.map((v, i) => <td key={i}><Lines v={v} /></td>)}</tr>)}</tbody></table></div>
        </section>

        <section className="cds-card" aria-labelledby="pb-a"><h2 id="pb-a" style={{ fontSize: 17, fontWeight: 700 }}>Actions that build it</h2>
          <p className="cds-sub" style={{ marginTop: 2 }}>{pb.actions.when}</p>
          <div className="stblwrap"><table className="stbl"><thead><tr><th /> {pb.actions.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{pb.actions.rows.map((r) => <tr key={r.label}><th scope="row" style={{ textAlign: "left" }}>{r.label}</th>{r.values.length === 1 ? <td colSpan={pb.actions.columns.length}><Lines v={r.values[0]} /></td> : r.values.map((v, i) => <td key={i}><Lines v={v} /></td>)}</tr>)}</tbody></table></div>
        </section>
        <p className="ssmall smuted">Playbook version {E.PLAYBOOK_VERSION}. Changed only by PAC faculty through a versioned release.</p>
      </div>
    </StaffShell>
  );
}
