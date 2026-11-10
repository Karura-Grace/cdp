import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { fieldingCounts, rate } from "@/lib/fielding";
import { runPreflight } from "@/lib/preflight";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import { assignedConsultants } from "@/lib/setup-workshop";
import SetupClient from "./setup-client";
import RequirementsPanel from "./requirements-panel";
import WorkbookPanel from "./workbook-panel";
import G5Notes from "./g5-notes";
import "../../../console.css";

export const metadata: Metadata = { title: "Setup and launch | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// PAC Consultants assigned to the engagement only. Reads that RLS allows go through the user's token; the consent text
// and tenant record have no client policy, so they are read with the service role after the role check below.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/setup`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, cycle_no, state").eq("engagement_id", id).maybeSingle();
  const role = eng ? (await db.rpc("rpc_actor_role", { p_engagement: id })).data : null;
  if (eng && (role === "CLIENT_ADMIN" || role === "EXECUTIVE")) redirect(`/engagements/${id}/setup/review`);
  if (!eng || role !== "PAC_CONSULTANT") redirect("/dashboard");

  const sa = admin();
  const [{ data: tenant }, { data: asm }, { data: rows }, { count: people }] = await Promise.all([
    sa.from("tenant").select("name, sector, headcount, geographies, transfer_basis_ref, transfer_basis_recorded_at").eq("tenant_id", eng.tenant_id).single(),
    db.from("assessment").select("assessment_id, status, window_open, window_close, consent_text_id").eq("engagement_id", id).neq("status", "SUPERSEDED").maybeSingle(),
    db.from("setup_record").select("section, status, payload_json, workshop_date, participants, facilitator, facilitator_user_id, locked_at").eq("engagement_id", id).eq("perspective", "AGREED").order("section"),
    sa.from("person_of_record").select("person_id", { count: "exact", head: true }).eq("tenant_id", eng.tenant_id),
  ]);
  // people in an executive grade, offered as the verified executives present at the workshop
  const { data: execGrades } = await sa.from("grade_band").select("grade_id, name").eq("tenant_id", eng.tenant_id).eq("is_executive", true);
  const execPeople = execGrades?.length
    ? ((await sa.from("person_of_record").select("person_id, display_name, email, grade_id").eq("tenant_id", eng.tenant_id).eq("employment_status", "ACTIVE").in("grade_id", execGrades.map((g) => g.grade_id)).order("employee_ref").limit(300)).data ?? [])
        .map((p) => ({ person_id: p.person_id, label: `${p.display_name || p.email} (${execGrades.find((g) => g.grade_id === p.grade_id)?.name ?? "executive"})` }))
    : [];
  const facilitators = await assignedConsultants(id);
  // Client Admin drafts of A to D (EXECUTIVE rows) and the Executives' ticks on agreed sections
  const [{ data: dr }, { data: cf }] = await Promise.all([
    db.from("setup_record").select("section, payload_json").eq("engagement_id", id).eq("perspective", "EXECUTIVE").in("section", ["A", "B", "C", "D"]),
    db.from("setup_confirmation").select("section").eq("engagement_id", id),
  ]);
  const drafts = Object.fromEntries((dr ?? []).map((r) => [r.section, r.payload_json])) as Record<string, Record<string, unknown>>;
  const confirmations: Record<string, number> = {};
  for (const c of cf ?? []) confirmations[c.section] = (confirmations[c.section] ?? 0) + 1;
  const consent = asm?.consent_text_id ? (await sa.from("consent_text").select("version, title, body, status").eq("consent_text_id", asm.consent_text_id).single()).data : null;
  const pf = asm?.status === "DRAFT" ? await runPreflight(asm.assessment_id) : null;

  const fl = asm?.status === "LAUNCHED" ? await fieldingCounts(asm.assessment_id) : null;
  const left = asm?.window_close ? Math.ceil((new Date(asm.window_close).getTime() - Date.now()) / 864e5) : null;

  // the order of the work, ticked from what is stored. The sentence on the first open step is what to do now.
  const agreedN = (rows ?? []).filter((r) => r.status === "AGREED" || r.locked_at).length;
  const launched = asm?.status === "LAUNCHED";
  const steps: { done: boolean; text: string; by: string }[] = [
    { done: (people ?? 0) > 0, text: "The client loads the organisation, people and leaders", by: "Client Admin, on Organisation and leaders (top right)" },
    { done: !!asm, text: "Create the assessment with the survey window", by: "you, under Create the assessment" },
    { done: agreedN >= 9, text: `Agree setup sections A to I (${agreedN} of 9 agreed), each with a workshop date and two executives`, by: "you, with the executives, under Setup sections" },
    { done: consent?.status === "APPROVED", text: "Approve the consent text", by: "you, under Consent text" },
    { done: !!tenant?.transfer_basis_recorded_at, text: "Record the cross border transfer basis", by: "you, under Transfer basis" },
    { done: !!pf?.pass || launched, text: "Launch checks pass", by: "shown under Launch checks; fix what blocks" },
    { done: launched, text: "Launch the assessment", by: "you, the Launch button under Launch checks" },
    { done: launched && (fl?.invited ?? 0) > 0, text: "Issue and send the survey links", by: "you, under Survey links" },
  ];
  const nextAt = steps.findIndex((x) => !x.done);

  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "setup")]);
  return (
    <StaffShell section={tabs} title={`Setup and launch · ${tenant?.name ?? "Engagement"}`} subtitle="Agree sections A to I, approve the consent text, then launch." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}
      actions={<a className="sbtn ghost" href={`/engagements/${id}/org`}>Organisation and leaders</a>}>
      {fl && (
        <section className="scard" aria-label="Fielding monitor">
          <div className="scard-head"><div><h2>Fielding monitor</h2>
            <div className="ssmall smuted">Totals only. Answers cannot be tied to people, and groups are never shown on their own here.{left !== null && (left > 0 ? ` ${left} day${left === 1 ? "" : "s"} left.` : " The window has closed.")}</div></div></div>
          <div className="stf-kpis">
            <div className="stf-kpi"><div className="l">Links issued</div><div className="v">{fl.invited}</div><div className="n">{fl.invited - fl.agreed - fl.declined} with no decision yet</div></div>
            <div className="stf-kpi"><div className="l">Submitted</div><div className="v">{fl.submitted}</div><div className="n">{rate(fl)}% of links · {Math.max(0, fl.agreed - fl.submitted)} in progress</div></div>
            <div className="stf-kpi"><div className="l">Declined</div><div className="v">{fl.declined}</div><div className="n">chose not to take part</div></div>
          </div>
        </section>
      )}
      <section className="stf-checklist" aria-label="Setup order">
        <h2>The order of the work</h2>
        <div className="ssmall smuted">{nextAt === -1 ? "Everything here is done. Survey links stay open until the window closes." : `Next: ${steps[nextAt].text}.`}</div>
        <ol>{steps.map((x, i) => (
          <li key={x.text} className={x.done ? "done" : i === nextAt ? "next" : ""}>
            <span className="tk" aria-hidden="true">{x.done ? "✓" : ""}</span>
            <span>{x.text} <span className="by">· {x.by}</span><span className="sr"> {x.done ? "(done)" : i === nextAt ? "(next)" : "(later)"}</span></span>
          </li>))}</ol>
      </section>
      <WorkbookPanel engagementId={id} locked={eng.state !== "SETUP"} />
      <RequirementsPanel engagementId={id} />
      <div>
        <SetupClient execPeople={execPeople} facilitators={facilitators} drafts={drafts} confirmations={confirmations} engagementId={id} state={eng.state} tenant={{ name: tenant?.name ?? "", sector: tenant?.sector ?? null, headcount: tenant?.headcount ?? null, geographies: tenant?.geographies ?? [] }} asm={asm ?? null} sections={rows ?? []} consent={consent ?? null}
          transfer={tenant?.transfer_basis_recorded_at ? (tenant.transfer_basis_ref ?? "recorded") : null} preflight={pf} />
      </div>
      <G5Notes engagementId={id} />
    </StaffShell>
  );
}
