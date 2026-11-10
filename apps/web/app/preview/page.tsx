import type { Metadata } from "next";
import { StaffShell } from "@/components/staff-shell";
import { staffNav } from "@/lib/staff-nav";
import { staffGate } from "@/lib/session";
import { serverDb } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { DIMS, QUAL_TITLES, WHYS } from "@/lib/respond-copy";
import { ORIENT_COLOR, ORIENT_NAME, ORIENTATIONS, type Orientation } from "@/lib/format";
import "../console.css";
import { ClientPreview, ConsultantPreview } from "./preview-view";

export const metadata: Metadata = { title: "Assessment preview | Culture Dynamics Profile", robots: { index: false } };
export const dynamic = "force-dynamic";

// orientation colours of spec v2.1 section 4.7, as in the new design
const SPEC_HUE: Record<Orientation, string> = { ENGAGE: "#2E86C1", INNOVATE: "#6C3483", PERFORM: "#C0392B", GOVERN: "#58A55C" };
const LIKERT = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const READY = [["D7", "Digital Readiness", "d7"], ["D8", "Psychological Safety", "d8"], ["D9", "Adaptive Capacity", "d9"]] as const;

// Read only view of the instrument exactly as respondents get it: every scenario with its four statements, the readiness items,
// the eOS questions and the open questions. For the consultant and the Client Admin before launch. Nothing here can be edited and
// no answer is stored. The statements are shown with the orientation named so the reader can see the instrument design; respondents
// see A to D instead (the survey flow hides the orientation names so they do not reveal the scoring key).
export default async function Page() {
  const db = await serverDb();
  const { user } = await staffGate(db, "/preview");
  const { nav, role, roleLabel } = await staffNav(db, null);
  const { data: ver } = await db.from("instrument_version").select("version_id, semver").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(1).maybeSingle();
  const v = ver?.version_id ?? "";
  const [{ data: scen }, { data: sts }, { data: items }] = await Promise.all([
    db.from("scenario").select("scenario_id, dimension, sequence, title, prompt_now, prompt_preferred").eq("version_id", v).order("scenario_id"),
    db.from("scenario_statement").select("scenario_id, orientation, text").eq("version_id", v),
    db.from("item").select("item_id, block, dimension, sequence, canonical_text").eq("version_id", v).order("sequence"),
  ]);
  const eos = (items ?? []).filter((i) => i.block === "EOS");
  // the new design (owner Q-D9-45) for the Client Admin and the PAC Consultant; other roles keep the staff shell below
  const ready = (items ?? []).filter((i) => i.block === "LIKERT").map((i) => ({ dim: i.dimension as string }));
  if (role === "CLIENT_ADMIN") {
    // RLS keeps the instrument (and so the scoring key) from client roles. The client view shows no statement text, only the
    // published version and how many readiness statements each dimension has, so those two facts are read with the service role.
    const { data: pv } = await admin().from("instrument_version").select("version_id, semver").eq("status", "PUBLISHED").order("published_at", { ascending: false }).limit(1).maybeSingle();
    const { data: dimRows } = pv ? await admin().from("item").select("dimension").eq("version_id", pv.version_id).eq("block", "LIKERT") : { data: [] };
    return <ClientPreview nav={nav} email={user.email ?? ""} roleLabel={roleLabel} semver={pv?.semver ?? null} items={(dimRows ?? []).map((d) => ({ dim: d.dimension as string }))} />;
  }
  if (role === "PAC_CONSULTANT") {
    const dims = DIMS.map((d, di) => ({
      code: `D${di + 1}`, name: d.name, desc: `${d.sub}.`,
      scens: (scen ?? []).filter((x) => x.dimension === `D${di + 1}`).sort((a, b) => a.sequence - b.sequence).map((sc) => ({
        title: sc.title, now: sc.prompt_now, pref: sc.prompt_preferred.replace(/^PREFERRED perspective:\s*/i, ""),
        opts: ORIENTATIONS.map((o) => ({ name: ORIENT_NAME[o], colour: SPEC_HUE[o], text: (sts ?? []).find((t) => t.scenario_id === sc.scenario_id && t.orientation === o)?.text ?? null })),
      })),
    }));
    return <ConsultantPreview nav={nav} email={user.email ?? ""} roleLabel={roleLabel} semver={ver?.semver ?? null} items={ready} dims={dims} />;
  }

  return (
    <StaffShell title="Assessment preview" subtitle="The instrument exactly as your people answer it. Read only." nav={nav} email={user.email ?? ""} roleLabel={roleLabel}
      actions={<><a className="sbtn ghost" href="/preview/360?as=self">360 self assessment</a><a className="sbtn ghost" href="/preview/360?as=rater">360 rater form</a><a className="sbtn ghost" href="/dashboard">Portfolio</a></>}>
      <div className="cds">
        <section className="scard">
          <h2>How the assessment works</h2>
          <p className="ssmall">Every person answers anonymously from two angles: the culture as it <b>is now (NOW)</b> and the culture the organisation <b>needs in five years (PREFERRED)</b>. There are no right or wrong answers.
            Part 1 is six culture dimensions, answered by sharing <b>100 points</b> across four statements. Part 2 is three readiness dimensions of twelve statements each, rated 1 to 5. Part 3 is eight employee questions rated 0 to 10. Part 4 is three optional open questions. It takes 35 to 45 minutes and every personal link works once.</p>
          <p className="ssmall smuted">Instrument version {ver?.semver ?? "not published"}. The questions are the same for every organisation so results stay comparable. Respondents see the statements marked A to D, not the orientation names shown here.</p>
        </section>

        {!ver && <section className="scard"><p className="smuted">No instrument version is published yet.</p></section>}

        {DIMS.map((d, di) => {
          const dim = `D${di + 1}`;
          const list = (scen ?? []).filter((x) => x.dimension === dim).sort((a, b) => a.sequence - b.sequence);
          return (
            <section className="scard" key={dim} aria-label={`${dim} ${d.name}`}>
              <div className="scard-head"><div><h2>{dim} · {d.name}</h2><div className="ssmall smuted">{d.sub}. Asked twice: NOW, then PREFERRED. Three scenarios each.</div></div></div>
              {list.map((sc, i) => (
                <div key={sc.scenario_id} style={{ margin: "14px 0 0" }}>
                  <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Scenario {i + 1}: {sc.title}</p>
                  <p className="ssmall smuted" style={{ margin: "0 0 2px" }}>NOW: {sc.prompt_now}</p>
                  <p className="ssmall smuted" style={{ margin: "0 0 8px" }}>PREFERRED: {sc.prompt_preferred.replace(/^PREFERRED perspective:\s*/i, "")}</p>
                  <ol className="ssmall" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
                    {ORIENTATIONS.map((o: Orientation) => {
                      const t = (sts ?? []).find((s) => s.scenario_id === sc.scenario_id && s.orientation === o);
                      return <li key={o}><span style={{ color: ORIENT_COLOR[o], fontWeight: 700 }}>{ORIENT_NAME[o]}</span> · {t?.text}</li>;
                    })}
                  </ol>
                </div>
              ))}
            </section>
          );
        })}

        {READY.map(([dim, name, key]) => {
          const list = (items ?? []).filter((i) => i.block === "LIKERT" && i.dimension === dim).sort((a, b) => a.sequence - b.sequence);
          return (
            <section className="scard" key={dim} aria-label={`${dim} ${name}`}>
              <div className="scard-head"><div><h2>{dim} · {name}</h2><div className="ssmall smuted">Twelve statements, each rated: {LIKERT.join(", ")}.</div></div></div>
              <p className="ssmall smuted">{WHYS[key]}</p>
              <ol className="ssmall" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{list.map((i) => <li key={i.item_id}>{i.canonical_text}</li>)}</ol>
            </section>
          );
        })}

        <section className="scard" aria-label="Employee Orientation Survey">
          <div className="scard-head"><div><h2>Employee Orientation Survey</h2><div className="ssmall smuted">Eight questions rated 0 to 10, from completely negative to completely positive.</div></div></div>
          <ol className="ssmall" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>{eos.map((i) => <li key={i.item_id}>{i.canonical_text}</li>)}</ol>
        </section>

        <section className="scard" aria-label="Open questions">
          <div className="scard-head"><div><h2>Open questions</h2><div className="ssmall smuted">Optional, free text, kept encrypted. Respondents are asked not to name individuals.</div></div></div>
          <ul className="ssmall" style={{ margin: 0, paddingLeft: 20 }}>{QUAL_TITLES.map((q) => <li key={q}>{q}</li>)}</ul>
        </section>
      </div>
    </StaffShell>
  );
}
