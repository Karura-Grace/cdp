import { StaffShell } from "@/components/staff-shell";
import { State } from "@/components/state";
import { BigTile, Chip, Fig, Key, Meter } from "@/components/portal";
import { loadReport } from "@/lib/report-data";
import { headlineSay } from "@/lib/report-copy";
import { mapDrawing, type O, type Prof } from "@/lib/graphics/culture";
import { mapStone } from "@/lib/culture-route";
import { ORIENTATIONS, ORIENT_NAME } from "@/lib/format";
import { fieldingCounts } from "@/lib/fielding";
import { staffNav } from "@/lib/staff-nav";
import Pipeline from "./pipeline";
import DashView from "./dash-view";
import { human } from "@/lib/format";
import { ROLE_GUIDE, STAGES, consultantNext, journey } from "@/lib/journey";
import { loadFacts } from "@/lib/lifecycle";
import { staffGate } from "@/lib/session";
import { admin } from "@/lib/supabase/admin";
import { serverDb } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Everything on this page is read with the signed-in user's own token, so RLS decides what appears.
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; all?: string; stage?: string }> }) {
  const sp = await searchParams;
  const db = await serverDb();
  const { user } = await staffGate(db, "/dashboard");
  const { nav, role: scopeRole } = await staffNav(db, "portfolio");
  const canManage = scopeRole === "SUPER_ADMIN" || scopeRole === "CLIENT_ADMIN";

  const { data: engs } = await db.from("engagement").select("engagement_id, tenant_id, cycle_no, state").order("created_at");
  const { data: tenants } = await db.from("tenant").select("tenant_id, name");
  const { data: asms } = await db.from("assessment").select("assessment_id, engagement_id, status, window_close, frozen_at");
  const { data: scores } = await db.from("score_object").select("assessment_id, version, frozen_at").order("version");
  const { data: evals } = await db.from("evaluation").select("assessment_id, score_version");
  const { data: actionRows } = await db.from("action").select("assessment_id, status");
  const { data: reports } = await db.from("report").select("report_id, assessment_id, type, status, released_at, score_version").order("created_at");
  // one lookup per engagement; a failed call is retried once, so a hiccup never hides the next step button
  const roleOf = async (id: string) => { for (let i = 0; i < 3; i++) { const r = await db.rpc("rpc_actor_role", { p_engagement: id }); if (!r.error) return r.data as string | null; } return null; };
  const roles = await Promise.all((engs ?? []).map(async (e) => [e.engagement_id, await roleOf(e.engagement_id)] as const));
  const role = new Map(roles);
  const name = new Map((tenants ?? []).map((t) => [t.tenant_id, t.name]));

  // The reports this user may see come from RLS. Executives and People Leaders cannot read assessment rows, so the
  // engagement of each visible report is looked up with the service role (ids only).
  const repAsms = [...new Set((reports ?? []).map((r) => r.assessment_id))];
  const { data: links } = repAsms.length ? await admin().from("assessment").select("assessment_id, engagement_id").in("assessment_id", repAsms) : { data: [] };
  const engOf = new Map([...(asms ?? []), ...(links ?? [])].map((a) => [a.assessment_id, a.engagement_id]));
  const released = (reports ?? []).filter((r) => r.status === "RELEASED").length;
  const drafts = (reports ?? []).length - released;
  const roleLabel = [...role.values()].includes("PAC_CONSULTANT") ? "PAC Consultant" : [...role.values()].filter(Boolean).map((r) => human(r!))[0] ?? "Welcome";

  // after scoring the next step comes from the engine's lifecycle guards (lib/lifecycle.ts), loaded for the engagements this person consults on
  const AFTER = ["REPORTING", "DEBRIEF", "PLANNING", "IMPLEMENTATION", "PULSE", "RE_ASSESSMENT"];
  const facts = await loadFacts((engs ?? []).filter((e) => role.get(e.engagement_id) === "PAC_CONSULTANT" && AFTER.includes(e.state)).map((e) => e.engagement_id));
  const inFielding = (engs ?? []).filter((e) => e.state === "FIELDING").length;
  // what the signed in person can do here: the role they hold on the most engagements, or their scope role (Super Admin has no engagement role)
  const myRole = scopeRole === "SUPER_ADMIN" ? "SUPER_ADMIN" : [...role.values()].includes("PAC_CONSULTANT") ? "PAC_CONSULTANT" : ([...role.values()].find(Boolean) as string | undefined) ?? scopeRole ?? "";
  const guide = ROLE_GUIDE[myRole] ?? null;

  // needs attention first: a next step is waiting for this person, then the rest by name; a long portfolio shows the first 12 until asked for all
  const waiting = (e: { engagement_id: string; state: string }) => (role.get(e.engagement_id) === "PAC_CONSULTANT" && !(["CLOSED"].includes(e.state)) ? 0 : 1);
  const matches = (engs ?? []).filter((e) => !sp.q || (name.get(e.tenant_id) ?? "").toLowerCase().includes(sp.q.toLowerCase()));
  const sorted = [...matches].sort((a, b) => waiting(a) - waiting(b) || (name.get(a.tenant_id) ?? "").localeCompare(name.get(b.tenant_id) ?? ""));
  const stageOk = (e: { state: string }) => !sp.stage || (sp.stage === "needs" ? e.state !== "CLOSED" : STAGES.find((s) => s.label.toLowerCase() === sp.stage)?.states.includes(e.state));
  const filtered = sorted.filter(stageOk);
  const shown = sp.all || sp.q || sp.stage ? filtered : filtered.slice(0, 12);
  const clientRole = ["CLIENT_ADMIN", "EXECUTIVE", "PEOPLE_LEADER"].includes(myRole ?? "");
  const heroRep = clientRole ? (reports ?? []).find((r) => r.status === "RELEASED" && r.type === "ORGANISATIONAL") : undefined;
  const heroLoaded = heroRep ? await loadReport(db, heroRep.report_id) : null;
  const hero = heroLoaded ? (() => {
    const os = heroLoaded.score.orientation_scores, num = (x: string) => Number(x);
    const now = Object.fromEntries(ORIENTATIONS.map((o) => [o, num(os.now[o])])) as Prof, pref = Object.fromEntries(ORIENTATIONS.map((o) => [o, num(os.preferred[o])])) as Prof;
    const nowO = (heroLoaded.score.dominance.dominant[0] ?? "PERFORM") as (typeof ORIENTATIONS)[number], prefO = [...ORIENTATIONS].sort((a, b) => pref[b] - pref[a])[0];
    const e0 = (engs ?? []).find((e) => engOf.get(heroRep!.assessment_id) === e.engagement_id);
    const acts = (actionRows ?? []).filter((x) => x.assessment_id === heroRep!.assessment_id);
    const j0 = journey(myRole, e0?.state ?? "REPORTING");
    return { tenant: heroLoaded.tenantName ?? "", reportId: heroRep!.report_id, now, pref, stone: mapStone(os.now as never, os.preferred as never) as O | null, nowO, prefO, nowName: ORIENT_NAME[nowO], prefName: ORIENT_NAME[prefO], thenName: ORIENT_NAME[heroLoaded.score.dominance.secondary as (typeof ORIENTATIONS)[number]],
      accepted: acts.filter((x) => ["APPROVED", "PUBLISHED", "IN_PROGRESS", "UNDER_REVIEW", "CLOSED"].includes(x.status)).length, total: acts.length, step: `${j0.step} of ${j0.of}`, stage: j0.stage,
      moving: acts.filter((x) => ["IN_PROGRESS", "UNDER_REVIEW", "CLOSED"].includes(x.status)).length, j: j0, cycle: e0?.cycle_no ?? 1,
      rel: (reports ?? []).filter((r) => r.status === "RELEASED" && engOf.get(r.assessment_id) === e0?.engagement_id).length, reps: (reports ?? []).filter((r) => engOf.get(r.assessment_id) === e0?.engagement_id).length,
      nowSay: headlineSay("now", { o: nowO }), prefSay: headlineSay("preferred", { o: prefO }) };
  })() : null;
  const flMap = new Map((await Promise.all(shown.map(async (e) => { const a = (asms ?? []).find((x) => x.engagement_id === e.engagement_id); return role.get(e.engagement_id) === "PAC_CONSULTANT" && a ? ([e.engagement_id, await fieldingCounts(a.assessment_id)] as const) : null; }))).filter((x): x is readonly [string, NonNullable<Awaited<ReturnType<typeof fieldingCounts>>>] => !!x && !!x[1]));
  const cards = shown.map((e) => {
        const reps = (reports ?? []).filter((r) => engOf.get(r.assessment_id) === e.engagement_id);
        const asm = (asms ?? []).find((a) => a.engagement_id === e.engagement_id);
        // client roles cannot read assessment rows; a released report names its assessment
        const released = reps.find((r) => r.status === "RELEASED");
        const myRoleHere = role.get(e.engagement_id) ?? null;
        const isConsultant = myRoleHere === "PAC_CONSULTANT";
        const setup = isConsultant && e.state === "SETUP" && (!asm || asm.status === "DRAFT");
        const next = isConsultant && asm && !setup ? consultantNext(e, asm, scores ?? [], evals ?? [], reps, facts.get(e.engagement_id)) : null;
        const at = STAGES.findIndex((s) => s.states.includes(e.state));
        const asmId = asm?.assessment_id ?? released?.assessment_id;
        const fl = flMap.get(e.engagement_id) ?? null;
        const acts = (actionRows ?? []).filter((x) => x.assessment_id === asmId);
        const accepted = acts.filter((x) => ["APPROVED", "PUBLISHED", "IN_PROGRESS", "UNDER_REVIEW", "CLOSED"].includes(x.status)).length;
        const moving = acts.filter((x) => ["IN_PROGRESS", "UNDER_REVIEW", "CLOSED"].includes(x.status)).length;
        const rel = reps.filter((r) => r.status === "RELEASED").length;
        const latest = (type: string) => reps.filter((r) => r.type === type).sort((x, y) => String(y.released_at ?? "").localeCompare(String(x.released_at ?? "")))[0];
        const j = journey(myRoleHere, e.state);
        return { e, name: name.get(e.tenant_id) ?? "Your organisation", reps, asm, released, myRoleHere, isConsultant, setup, next, at, fl, accepted, moving, rel, acts, latest, j };
  });

  if (myRole === "CLIENT_ADMIN" || myRole === "PAC_CONSULTANT") return <DashView {...{ cards, nav, email: user.email ?? "", roleLabel, myRole, guide, hero, canManage, superAdmin: scopeRole === "SUPER_ADMIN", count: engs?.length ?? 0, inFielding, released, drafts, sp, total: filtered.length, engStates: (engs ?? []).map((x) => x.state), dates: (asms ?? []).filter((a) => a.window_close).map((a) => ({ cycle: (engs ?? []).find((x) => x.engagement_id === a.engagement_id)?.cycle_no ?? 1, date: String(a.window_close).slice(0, 10) })) }} />;

  return (
    <StaffShell title="Portfolio" subtitle="Every engagement you can see, where it is, and the next step." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}
      actions={<><a className="sbtn ghost" href="/preview">Preview the survey</a>{canManage && <>{scopeRole === "SUPER_ADMIN" && <a className="sbtn ghost" href="/organisations">Organisations</a>}<a className="sbtn orange" href="/users">Manage users</a></>}</>}>
      <div className="stf-kpis">
        <div className="stf-kpi"><div className="l">Engagements</div><div className="v">{engs?.length ?? 0}</div><div className="n">{inFielding} in fielding now</div></div>
        <div className="stf-kpi"><div className="l">Reports released</div><div className="v">{released}</div><div className="n">Visible to the client</div></div>
        <div className="stf-kpi"><div className="l">Drafts</div><div className="v">{drafts}</div><div className="n">Not visible to the client</div></div>
      </div>
      {guide && (
        <details className="stf-roleguide" open={!engs?.length}>
          <summary>What you can do here as {myRole === "PAC_CONSULTANT" ? "a PAC Consultant" : `a ${human(myRole).toLowerCase()}`}</summary>
          <ul>{guide.map((g) => <li key={g}>{g}</li>)}</ul>
        </details>
      )}
      {!engs?.length && <State tone="empty" title="Nothing is shared with you yet">Engagements appear here once a PAC consultant assigns you to one. If you expected to see one, ask your PAC consultant to check your access.</State>}
      {hero && (
        <div className="pt-hero">
          <div className="pt-chart" style={{ display: "flex", flexDirection: "column" }}>
            <div className="pt-chiprow"><b>Your culture, Now and Preferred</b><Chip>{hero.tenant}</Chip></div>
            <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "6px 0" }}><Fig id="dh" d={mapDrawing("move", hero.now, hero.pref, hero.stone, 320)} max={400} /></div>
            <Key />
            <p style={{ margin: "10px 0 0" }}><a className="sbtn" href={`/reports/${hero.reportId}`}>Open the full report</a></p>
          </div>
          <div className="pt-bigtiles">
            <BigTile label="Now culture" value={hero.nowName} word={`then ${hero.thenName}`} fill="#F4B7A6" say={headlineSay("now", { o: hero.nowO })} open sm />
            <BigTile label="Preferred culture" value={hero.prefName} word="what people want to lead" fill="#F6DE9A" say={headlineSay("preferred", { o: hero.prefO })} sm />
            <BigTile label="Actions accepted" value={`${hero.accepted} of ${hero.total}`} word="in your action plan" say={{ meaning: "The actions your leadership team has taken on from the proposed plan.", advice: "Review the proposed actions, rank them and accept the ones you will own." }} sm />
            <BigTile label="Where you are" value={hero.step} word={hero.stage} say={{ meaning: "Your place in the journey from setup to re-assessment.", advice: "Follow the next step on your engagement card below." }} sm />
          </div>
        </div>
      )}
      <div className="pt-ptabs" role="navigation" aria-label="Filter by stage">
        {[["", "Needs you"], ["setup", "Setup"], ["fielding", "Fielding"], ["reporting", "Reporting"], ["planning", "Planning"], ["implementation", "Implementation"]].map(([k, l]) => <a key={k} className="sbtn ghost" href={k ? `/dashboard?stage=${k}` : "/dashboard"} aria-current={(sp.stage ?? "") === k ? "page" : undefined} style={(sp.stage ?? "") === k ? { background: "#131313", color: "#fff" } : undefined}>{l}</a>)}
      </div>
      <form className="pt-search" action="/dashboard" role="search"><input name="q" defaultValue={sp.q ?? ""} placeholder="Find an organisation" aria-label="Find an organisation" /><button className="sbtn">Search</button>{(sp.q || sp.all) && <a className="sbtn ghost" href="/dashboard">Clear</a>}</form>
      {cards.map((c) => {
        const { e, reps, asm, released, myRoleHere, isConsultant, setup, next, at, fl, accepted, moving, rel, acts, latest, j } = c;
        return (
          <section key={e.engagement_id} className="pt-eng" aria-label={name.get(e.tenant_id) ?? "Engagement"}>
            <div className="pt-eng-top">
              <div>
                <h2><a href={`/engagements/${e.engagement_id}`} style={{ color: "inherit", textDecoration: "none" }}>{name.get(e.tenant_id) ?? "Your organisation"}</a></h2>
                <div className="sub">Cycle {e.cycle_no}{asm?.window_close ? ` · survey window closes ${asm.window_close.slice(0, 10)}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><Chip tone="orange">{human(e.state)}</Chip><Chip>{isConsultant ? "PAC Consultant" : human(myRoleHere ?? "Member")}</Chip><a className="sbtn ghost" href={`/engagements/${e.engagement_id}`}>Open</a></div>
            </div>
            <div className="pt-steps" aria-label={`Stage: ${human(e.state)}`}>
              {STAGES.map((st, i) => <div key={st.label} className={`pt-step${i < at ? " done" : i === at ? " now" : ""}`}>{st.label}</div>)}
            </div>
            <p className="ssmall" style={{ margin: "0 0 12px" }}><b>Step {j.step} of {j.of}: {j.stage}.</b> {j.text}</p>
            <div className="pt-meters">
              {fl ? <Meter label="Responses" value={fl.submitted} of={fl.invited} /> : <Meter label="Journey" value={j.step} of={j.of} suffix=" steps" />}
              <Meter label="Reports released" value={rel} of={Math.max(reps.length, 1)} />
              <Meter label="Actions accepted" value={accepted} of={Math.max(acts.length, 1)} />
              <Meter label="Actions under way" value={moving} of={Math.max(accepted, 1)} />
            </div>
            {myRoleHere === "CLIENT_ADMIN" && e.state === "SETUP" && <div className="pt-next"><span className="k">Next step</span><a className="sbtn orange" href={`/engagements/${e.engagement_id}/org`}>Organisation and leaders</a></div>}
            {setup && <div className="pt-next"><span className="k">Next step</span><a className="sbtn orange" href={`/engagements/${e.engagement_id}/setup`}>{asm ? "Review setup and launch" : "Set up the assessment"}</a></div>}
            {next && (next.url ? <Pipeline label={next.label} url={next.url} body={next.body} /> : next.href ? <div className="pt-next"><span className="k">Next step</span><a className="sbtn orange" href={next.href}>{next.label}</a></div> : null)}
            {!isConsultant && released && myRoleHere !== "COACH" && <div className="pt-next"><span className="k">Your next step</span><a className="sbtn orange" href={`/assessments/${released.assessment_id}/plan`}>Review the action plan</a>{myRoleHere === "PEOPLE_LEADER" && <a className="sbtn ghost" href={`/assessments/${released.assessment_id}/team`}>My team</a>}</div>}
            <div className="pt-links" aria-label="Latest reports">
              {(["ORGANISATIONAL", "BOARD_EXEC_SUMMARY", "SUB_CULTURE", "LEADERSHIP_TEAM"] as const).map((t) => { const r = latest(t); return r ? <a key={t} href={`/reports/${r.report_id}`}>{human(t)}{r.status === "RELEASED" ? "" : " (draft)"}</a> : null; })}
              {reps.length === 0 && <span className="ssmall smuted">No reports are available yet.</span>}
              {isConsultant && asm && asm.status !== "DRAFT" && <><a href={`/assessments/${asm.assessment_id}/leaders`}>Leadership 360</a>{asm.frozen_at && <><a href={`/assessments/${asm.assessment_id}/segments`}>Explore groups</a><a href={`/assessments/${asm.assessment_id}/plan`}>Action plan</a><a href={`/engagements/${e.engagement_id}/measure`}>Measure</a></>}</>}
            </div>
          </section>
        );
      })}
      {!sp.all && !sp.q && !sp.stage && filtered.length > shown.length && <div className="pt-more"><span className="ssmall smuted">Showing {shown.length} of {filtered.length} organisations, those that need you first.</span><a className="sbtn" href="/dashboard?all=1">Show all {filtered.length}</a></div>}
    </StaffShell>
  );
}
