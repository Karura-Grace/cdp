import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { State } from "@/components/state";
import { staffNav } from "@/lib/staff-nav";
import { engagementTabs } from "@/lib/engagement-tabs";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";
import { emailConfigured } from "@/lib/email";
import { human } from "@/lib/format";
import { Act, CloseRequest, RecordForm } from "./privacy-client";
import DemoValueForm from "./demo-value";
import "../../../console.css";

export const metadata: Metadata = { title: "Privacy and data protection | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

const day = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–");

// Data protection for one engagement and its organisation (spec 1.4.5). The consultant sees and edits everything; the Client Admin sees the records
// and can log data subject requests and define demographics. Reads go through the caller's own client, so RLS decides what comes back.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await serverDb();
  const { user } = await staffGate(db, `/engagements/${id}/privacy`);
  const { data: eng } = await db.from("engagement").select("engagement_id, tenant_id, purpose").eq("engagement_id", id).maybeSingle();
  const role = eng ? (await db.rpc("rpc_actor_role", { p_engagement: id })).data as string | null : null;
  if (!eng || !role || !["PAC_CONSULTANT", "CLIENT_ADMIN"].includes(role)) redirect("/dashboard");
  const consultant = role === "PAC_CONSULTANT", t = eng.tenant_id, base = `/v1/engagements/${id}/privacy`;

  const [{ data: dpia }, { data: reg }, { data: subs }, { data: brc }, { data: dsr }, { data: attrs }, { data: coach }, { data: ret }, { data: certs }, { data: ppl }, { data: ten }, { data: asm }, staff] = await Promise.all([
    db.from("dpia_record").select("*").eq("tenant_id", t).order("recorded_at", { ascending: false }),
    db.from("processing_register").select("*").eq("tenant_id", t).order("recorded_at"),
    db.from("sub_processor").select("*").order("name"),
    db.from("breach_incident").select("*").eq("tenant_id", t).order("opened_at", { ascending: false }),
    db.from("data_subject_request").select("*").eq("tenant_id", t).order("opened_at", { ascending: false }),
    db.from("demographic_attribute").select("*").eq("tenant_id", t).order("name"),
    db.from("coach_assignment").select("*").eq("tenant_id", t).order("from_date", { ascending: false }),
    db.from("retention_schedule").select("*").eq("engagement_id", id).maybeSingle(),
    db.from("destruction_certificate").select("*").eq("engagement_id", id),
    db.from("person_of_record").select("person_id, employee_ref, display_name").eq("tenant_id", t).order("employee_ref").limit(2000),
    admin().from("tenant").select("name, dpia_recorded_at, odpc_registration_ref, odpc_confirmed_on").eq("tenant_id", t).single(),
    db.from("assessment").select("status, window_close").eq("engagement_id", id).neq("status", "SUPERSEDED").maybeSingle(),
    consultant ? admin().rpc("rpc_tenant_staff", { p_tenant: t }) : Promise.resolve({ data: [] }),
  ]);
  const [{ data: tasks }, { data: bc }] = await Promise.all([
    consultant ? db.from("consultant_task").select("*").eq("tenant_id", t).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as { task_id: string; title: string; detail: string | null; status: string; created_at: string }[] }),
    admin().from("platform_setting").select("value").eq("key", "breach_contact").maybeSingle(),   // platform settings are not readable from a user token
  ]);
  const objections = (tasks ?? []).filter((x) => (x as { kind?: string }).kind === "OBJECTION") as { status: string; created_at: string }[];
  const objByMonth = Object.entries(objections.reduce<Record<string, number>>((m, x) => ({ ...m, [x.created_at.slice(0, 7)]: (m[x.created_at.slice(0, 7)] ?? 0) + 1 }), {})).sort(([x], [y]) => (x < y ? -1 : 1));
  const breachContact = bc?.value as { name?: string; email?: string } | null;
  const coaches = ((staff.data ?? []) as { user_id: string; email: string; role: string }[]).filter((u) => u.role === "COACH");
  const who = new Map(ppl?.map((p) => [p.person_id, p.display_name ?? p.employee_ref]));
  const personOpts: [string, string][] = (ppl ?? []).map((p) => [p.person_id, `${p.display_name ?? p.employee_ref} (${p.employee_ref})`]);
  const valueOpts: [string, string][] = (attrs ?? []).flatMap((a) => a.values_list.map((v): [string, string] => [`${a.attr_id}|${v}`, `${a.name}: ${v}`]));
  const launched = !!asm && asm.status !== "DRAFT";
  const [{ nav, roleLabel }, tabs] = await Promise.all([staffNav(db, null), engagementTabs(db, id, "privacy")]);
  const empty = (n: string) => <State tone="empty" title={`No ${n} yet`}>{consultant ? "Add one with the form above." : "Your PAC consultant keeps this record."}</State>;

  return (
    <StaffShell section={tabs} title={`Privacy and data protection · ${ten?.name ?? "Engagement"}`} subtitle="Records the data protection law asks for, and the rules for the people the survey asks about." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}>

      <section className="scard" aria-label="Purpose">
        <div className="scard-head"><div><h2>Purpose of the assessment</h2><div className="ssmall smuted">Stored here and copied into the consent text that people read before they take part. It cannot change once the assessment has launched.</div></div></div>
        <p>{eng.purpose ?? <span className="smuted">Not set. The consent text uses its standard wording.</span>}</p>
        {consultant && !launched && <RecordForm url={`${base}/purpose`} method="PUT" fields={[{ name: "purpose", label: "Purpose, in plain words (up to 1000 characters)", type: "area", max: 1000, wide: true }]} button="Save purpose" done="Saved. A draft consent text with the old purpose line was updated; an approved one needs a new version." />}
      </section>

      <section className="scard" aria-label="Impact assessment">
        <div className="scard-head"><div><h2>Data protection impact assessment</h2><div className="ssmall smuted">Launch is blocked until one is recorded for the organisation.</div></div>
          <span className={`stag ${ten?.dpia_recorded_at ? "" : "orange"}`}>{ten?.dpia_recorded_at ? `Recorded ${day(ten.dpia_recorded_at)}` : "Not recorded"}</span></div>
        {consultant && <RecordForm url={`${base}/dpia`} fields={[{ name: "reference", label: "Where the assessment is kept (reference)", max: 200 }, { name: "transfer_basis", label: "Cross border transfer basis", max: 500 }]} button="Record assessment" done="Recorded." />}
        {(dpia ?? []).length === 0 ? empty("assessment") : <div className="stblwrap"><table className="stbl" aria-label="Impact assessments"><thead><tr><th>Recorded</th><th>Reference</th><th>Transfer basis</th></tr></thead>
          <tbody>{dpia!.map((r) => <tr key={r.dpia_id}><td>{day(r.recorded_at)}</td><td>{r.reference}</td><td>{r.transfer_basis}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="scard" aria-label="Processing register">
        <div className="scard-head"><div><h2>Processing register</h2><div className="ssmall smuted">What is processed for this organisation, why, on what basis and for how long. The client is the controller and PAC the processor.</div></div></div>
        <p className="ssmall" style={{ marginBottom: 8 }}><b>ODPC registration:</b> {ten?.odpc_registration_ref ? <>{ten.odpc_registration_ref}, confirmed {day(ten.odpc_confirmed_on)}</> : <span className="smuted">Not recorded yet.</span>}</p>
        {consultant && <RecordForm url={`${base}/odpc`} method="PUT" fields={[{ name: "odpc_registration_ref", label: "ODPC registration reference", max: 100 }, { name: "odpc_confirmed_on", label: "Date PAC confirmed the registration", type: "date" }]} button={ten?.odpc_registration_ref ? "Update ODPC registration" : "Record ODPC registration"} done="Saved." />}
        {consultant && <RecordForm url={`${base}/register`} fields={[{ name: "activity", label: "Activity", max: 200 }, { name: "purpose", label: "Purpose", max: 500 }, { name: "data_categories", label: "Data categories", max: 500 }, { name: "legal_basis", label: "Legal basis", max: 200 }, { name: "retention", label: "Retention", max: 200 }]} button="Add entry" done="Added." />}
        {(reg ?? []).length === 0 ? empty("entries") : <div className="stblwrap"><table className="stbl" aria-label="Processing register"><thead><tr><th>Activity</th><th>Purpose</th><th>Data</th><th>Basis</th><th>Retention</th></tr></thead>
          <tbody>{reg!.map((r) => <tr key={r.entry_id}><td>{r.activity}</td><td>{r.purpose}</td><td>{r.data_categories}</td><td>{r.legal_basis}</td><td>{r.retention}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="scard" aria-label="Sub processors">
        <div className="scard-head"><div><h2>Sub processors</h2><div className="ssmall smuted">PAC wide. Only a Super Admin adds to this list (POST /v1/sub-processors).</div></div></div>
        {(subs ?? []).length === 0 ? <State tone="empty" title="No sub processors listed yet">A Super Admin keeps this list.</State> : <div className="stblwrap"><table className="stbl" aria-label="Sub processors"><thead><tr><th>Name</th><th>Purpose</th><th>Region</th><th>Transfer basis</th></tr></thead>
          <tbody>{subs!.map((r) => <tr key={r.processor_id}><td>{r.name}</td><td>{r.purpose}</td><td>{r.region}</td><td>{r.transfer_basis}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="scard" aria-label="Breach incidents">
        <div className="scard-head"><div><h2>Breach incidents</h2><div className="ssmall smuted">Opening one starts the 72 hour clock for telling the controller and the regulator.</div></div></div>
        <p className="ssmall" style={{ marginBottom: 8 }}><b>Breach contact:</b> {breachContact?.name ?? "not set"}{breachContact?.email ? <>, <a href={`mailto:${breachContact.email}`}>{breachContact.email}</a></> : null}. <span className="smuted">Tell this contact first when an incident is opened.</span></p>
        {consultant && <RecordForm url={`${base}/breaches`} fields={[{ name: "summary", label: "What happened (up to 2000 characters)", type: "area", max: 2000, wide: true }]} button="Open incident" done="Opened. Notify by date set to 72 hours from now." />}
        {(brc ?? []).length === 0 ? empty("incidents") : <div className="stblwrap"><table className="stbl" aria-label="Breach incidents"><thead><tr><th>Opened</th><th>Notify by</th><th>Summary</th><th>Notified</th></tr></thead>
          <tbody>{brc!.map((r) => <tr key={r.incident_id}><td>{day(r.opened_at)}</td><td>{new Date(r.notify_by).toLocaleString("en-GB")}</td><td>{r.summary}</td>
            <td>{r.notified_at ? `${day(r.notified_at)}${r.regulator_ref ? ` · ${r.regulator_ref}` : ""}` : consultant ? <Act url={`${base}/breaches/${r.incident_id}`} method="PATCH" body={{}} label="Record notification" done="Recorded." /> : <span className="stag orange">Not yet</span>}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="scard" aria-label="Data subject requests">
        <div className="scard-head"><div><h2>Data subject requests</h2><div className="ssmall smuted">Access, correction, objection and erasure of the invitation record. People can also raise these themselves from their survey link. An answer is due 30 days after a request is opened; you can change the date.</div></div></div>
        <RecordForm url={`${base}/requests`} fields={[{ name: "kind", label: "Kind", type: "select", options: [["ACCESS", "Access"], ["RECTIFY", "Correction"], ["OBJECT", "Objection"], ["ERASE", "Erase the invitation record"]] }, { name: "subject_ref", label: "Employee reference", max: 120 }, { name: "due_on", label: "Answer due on (leave empty for 30 days from today)", type: "date", required: false }, { name: "detail", label: "Detail (optional)", type: "area", max: 2000, required: false, wide: true }]} button="Log request" done="Logged." />
        {(dsr ?? []).length === 0 ? empty("requests") : <div className="stblwrap"><table className="stbl" aria-label="Data subject requests"><thead><tr><th>Opened</th><th>Kind</th><th>Person</th><th>Due</th><th>Status</th></tr></thead>
          <tbody>{dsr!.map((r) => <tr key={r.request_id}><td>{day(r.opened_at)}</td><td>{human(r.kind)}</td><td>{r.subject_ref}{r.detail ? <div className="ssmall smuted">{r.detail}</div> : null}</td>
            <td>{r.due_on ? day(r.due_on) : "–"}{r.status === "OPEN" && <RecordForm url={`${base}/requests/${r.request_id}`} method="PATCH" fields={[{ name: "due_on", label: "Change due date", type: "date" }]} button="Change" done="Changed." />}</td>
            <td>{r.status === "OPEN" ? <CloseRequest url={`${base}/requests/${r.request_id}`} /> : <span><span className="stag">{human(r.status)}</span> <span className="ssmall smuted">{r.closed_note}</span></span>}</td></tr>)}</tbody></table></div>}
      </section>

      {consultant && (
        <section className="scard" aria-label="Objections report">
          <div className="scard-head"><div><h2>Objections report</h2><div className="ssmall smuted">Counts only, for you and the Super Admin. No names and no detail: nobody who objected can be identified from this, and the client cannot read it.</div></div></div>
          <div className="stf-kpis">
            <div className="stf-kpi"><div className="l">Objections</div><div className="v">{objections.length}</div></div>
            <div className="stf-kpi"><div className="l">Open</div><div className="v">{objections.filter((x) => x.status === "OPEN").length}</div></div>
            <div className="stf-kpi"><div className="l">Done</div><div className="v">{objections.filter((x) => x.status === "DONE").length}</div></div>
          </div>
          {objByMonth.length > 0 && <p className="ssmall smuted" style={{ marginTop: 6 }}>By month: {objByMonth.map(([m, n]) => `${m} ${n}`).join(" · ")}</p>}
        </section>
      )}

      {consultant && (
        <section className="scard" aria-label="Tasks">
          <div className="scard-head"><div><h2>Tasks</h2><div className="ssmall smuted">Follow ups that need a consultant. An objection from a person stops further survey links to them and appears here.</div></div></div>
          {(tasks ?? []).length === 0 ? empty("tasks") : <div className="stblwrap"><table className="stbl" aria-label="Tasks"><thead><tr><th>Opened</th><th>Task</th><th>Status</th></tr></thead>
            <tbody>{tasks!.map((k) => <tr key={k.task_id}><td>{day(k.created_at)}</td><td>{k.title}{k.detail ? <div className="ssmall smuted">{k.detail}</div> : null}</td>
              <td>{k.status === "OPEN" ? <Act url={`${base}/tasks/${k.task_id}`} method="PATCH" label="Mark done" done="Done." /> : <span className="stag">Done</span>}</td></tr>)}</tbody></table></div>}
        </section>)}

      <section className="scard" aria-label="Retention and destruction">
        <div className="scard-head"><div><h2>Retention and destruction</h2><div className="ssmall smuted">Response level data is destroyed 24 months after the survey window closes. You send the notices and run the destruction yourself; nothing runs on a timer. Notices go to the Client Admins and hello@pac.africa at 90 and 30 days. Scores, reports and plans stay.</div></div></div>
        {!ret ? (
          <State tone="empty" title="No retention schedule yet">{asm?.window_close ? (consultant ? "Write it from the survey window close date." : "Your PAC consultant sets it once the assessment exists.") : "Create the assessment with a survey window first."}
            {consultant && asm?.window_close && <div style={{ marginTop: 8 }}><Act url={`${base}/retention/schedule`} label="Write the schedule" done="Scheduled." ghost={false} /></div>}</State>
        ) : (
          <>
            <div className="stf-kpis">
              <div className="stf-kpi"><div className="l">Window closed</div><div className="v">{day(ret.close_date)}</div></div>
              <div className="stf-kpi"><div className="l">Destroy on</div><div className="v">{day(ret.destroy_on)}</div><div className="n">{ret.destroyed_at ? `Destroyed ${day(ret.destroyed_at)}` : "Not yet destroyed"}</div></div>
              <div className="stf-kpi"><div className="l">90 day notice</div><div className="v">{day(ret.notice_90_on)}</div><div className="n">{ret.notice_90_sent_at ? `Sent ${day(ret.notice_90_sent_at)}` : "Not sent"}</div></div>
              <div className="stf-kpi"><div className="l">30 day notice</div><div className="v">{day(ret.notice_30_on)}</div><div className="n">{ret.notice_30_sent_at ? `Sent ${day(ret.notice_30_sent_at)}` : "Not sent"}</div></div>
            </div>
            {consultant && !ret.destroyed_at && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <Act url={`${base}/retention/notices`} label="Send notices that are due" done="Done. Notices already sent are not sent again." />
                {!emailConfigured() && <span className="ssmall smuted">Email is not configured here, so notices cannot be sent.</span>}
                <Act url={`${base}/retention/destroy`} label="Destroy responses now" done="Destroyed. The certificate is below." confirmText="Permanently destroy all response level data for this engagement? This cannot be undone. It is refused before the retention date." />
              </div>)}
          </>
        )}
        {(certs ?? []).map((c) => <p key={c.cert_id} className="ssmall" style={{ marginTop: 12 }}><b>Destruction certificate {c.cert_id}</b> · {day(c.destroyed_at)} · removed {Object.entries(c.row_counts as Record<string, number>).map(([k, n]) => `${n} ${k.replace(/_/g, " ")}`).join(", ")} · fingerprint {c.cert_hash.slice(0, 16)}…</p>)}
      </section>

      <section className="scard" aria-label="Demographics">
        <div className="scard-head"><div><h2>Demographic attributes</h2><div className="ssmall smuted">Only attributes named here, each with a stated purpose, can be collected. Values come from a closed list, never free text. A sensitive attribute always offers &ldquo;Prefer not to say&rdquo;, which is optional to answer.</div></div></div>
        <RecordForm url={`${base}/demographics`} fields={[{ name: "name", label: "Attribute name", max: 60 }, { name: "analytical_purpose", label: "Analytical purpose (why it is needed)", max: 500 }, { name: "values", label: "Allowed values, one per line (2 to 30)", type: "lines", wide: true }, { name: "is_sensitive", label: "Sensitive (for example gender, age band, disability, health, ethnicity)", type: "check", required: false }]} button="Add attribute" done="Added." />
        {(attrs ?? []).length === 0 ? empty("attributes") : <div className="stblwrap"><table className="stbl" aria-label="Demographic attributes"><thead><tr><th>Attribute</th><th>Values</th><th>Purpose</th><th>Sensitive</th></tr></thead>
          <tbody>{attrs!.map((a) => <tr key={a.attr_id}><td>{a.name}</td><td>{a.values_list.join(", ")}</td><td>{a.analytical_purpose}</td><td>{a.is_sensitive ? "Yes" : "No"}</td></tr>)}</tbody></table></div>}
        {(attrs ?? []).length > 0 && <DemoValueForm url={`${base}/values`} persons={personOpts} values={valueOpts} />}
        <p className="ssmall smuted" style={{ marginTop: 8 }}>People answer these attributes on the About you screen of their survey link, and may choose &ldquo;Prefer not to say&rdquo; for each. The answers are stored with their response without their name.</p>
      </section>

      {consultant && (
        <section className="scard" aria-label="Coach assignments">
          <div className="scard-head"><div><h2>Coach assignments</h2><div className="ssmall smuted">A Coach sees the 360 results and development plans of assigned leaders only, and only between the dates. Ending an assignment stops access at once.</div></div></div>
          {coaches.length === 0 ? <State tone="empty" title="No Coach in this organisation">Ask the Client Admin or a Super Admin to create a user with the Coach role first.</State> :
            <RecordForm url={`${base}/coach-assignments`} fields={[{ name: "coach_user_id", label: "Coach", type: "select", options: coaches.map((c) => [c.user_id, c.email]) }, { name: "leader_person_ids", label: "Leaders (hold Ctrl or Cmd to pick several)", type: "multi", options: personOpts }, { name: "from_date", label: "From", type: "date" }, { name: "to_date", label: "To", type: "date" }]} button="Assign coach" done="Assigned." />}
          {(coach ?? []).length === 0 ? empty("assignments") : <div className="stblwrap"><table className="stbl" aria-label="Coach assignments"><thead><tr><th>Coach</th><th>Leaders</th><th>Dates</th><th></th></tr></thead>
            <tbody>{coach!.map((c) => <tr key={c.coach_assignment_id}><td>{coaches.find((u) => u.user_id === c.coach_user_id)?.email ?? c.coach_user_id}</td><td>{c.leader_person_ids.map((p) => who.get(p) ?? p).join(", ")}</td><td>{day(c.from_date)} to {day(c.to_date)}</td>
              <td><Act url={`${base}/coach-assignments/${c.coach_assignment_id}`} method="PATCH" label="End now" done="Ended." confirmText="End this assignment now?" /></td></tr>)}</tbody></table></div>}
        </section>)}
    </StaffShell>
  );
}

