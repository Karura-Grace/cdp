"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DIMS, QUAL_TITLES, WHYS } from "@/lib/respond-copy";
import { Invitation } from "./invite";
import { SurveyShell } from "@/components/survey-shell";
import { LinkExpired } from "@/components/link-expired";
import { RightsLink } from "@/components/rights-link";

// Respondent journey, styled 1:1 after the live site's Flow (global classes in globals.css).
// Steps: 0 intro | 1-6 NOW D1-D6 | 7-12 PREFERRED D1-D6 | 13-15 D7-D9 | 16 eOS | 17 free text | 18 review.
// Differences from the live flow, on purpose: statements carry A to D chips (not orientation names, which would reveal the
// scoring key); the "About you" step (S2-04) shows only when the organisation defined demographic attributes; the token lives in the URL hash.
// Drafts stay in this browser only; nothing reaches the server before the final submit (CLAUDE.md §2.4).

const ORIENTATIONS = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"] as const;
type Orientation = (typeof ORIENTATIONS)[number];
type Persp = "NOW" | "PREFERRED";
type Alloc = Record<Orientation, number | null>;

interface Scenario { scenario_id: string; dimension: string; sequence: number; title: string; prompt_now: string; prompt_preferred: string }
interface Statement { scenario_id: string; orientation: Orientation; text: string }
interface Item { item_id: string; block: "LIKERT" | "EOS" | "QUAL"; dimension: string | null; sequence: number; scale_type: string; title: string | null; canonical_text: string }
type Decision = "AGREE" | "DECLINE" | null;
interface ConsentText { decision: Decision; version: number; title: string; body: string }
interface AboutAttr { attr_id: string; name: string; values: string[] }
interface Instrument { about?: AboutAttr[]; prefill?: { department?: string; team?: string; grade?: string }; org?: string | null; closes?: string | null; message?: string | null; estimate?: string | null; consent: ConsentText; scenarios: Scenario[]; statements: Statement[]; items: Item[] }

interface Draft {
  step: number;
  spent: number;                                        // active seconds, becomes response.duration_seconds
  alloc: Record<Persp, Record<string, Alloc[]>>;
  likert: Record<string, (number | null)[]>;
  eos: (number | null)[];
  qual: string[];
  about?: Record<string, string>;                       // S2-04 answers by attribute id; held in this browser until the final submit
  aboutDone?: boolean;
  practiced?: boolean;
  autoSubmit?: boolean;                                 // S2.6.3-005: submit what I have if the window closes (off unless ticked)
}

const DIM_IDS = ["D1", "D2", "D3", "D4", "D5", "D6"];
const LIKERT = ["D7", "D8", "D9"];
const LAST = 18;
const LIKERT_LABELS = ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"];
const LIKERT_NAMES: Record<string, string> = { D7: "D7 - Digital Readiness", D8: "D8 - Psychological Safety", D9: "D9 - Adaptive Capacity" };

const emptyAlloc = (): Alloc => ({ ENGAGE: null, INNOVATE: null, PERFORM: null, GOVERN: null });
const blank = (): Draft => ({
  step: 0, spent: 0,
  alloc: {
    NOW: Object.fromEntries(DIM_IDS.map((d) => [d, [0, 1, 2].map(emptyAlloc)])),
    PREFERRED: Object.fromEntries(DIM_IDS.map((d) => [d, [0, 1, 2].map(emptyAlloc)])),
  },
  likert: Object.fromEntries(LIKERT.map((d) => [d, Array(12).fill(null)])),
  eos: Array(8).fill(null),
  qual: ["", "", ""],
});

// N2.2-PROG, S2.5-001: progress against the 36 scenario sets while allocating, then by block
const ALLOC_STEPS = 12;
function progressLabel(d: Draft): string {
  const sets = (["NOW", "PREFERRED"] as const).reduce((n, p) => n + DIM_IDS.reduce((m, dim) => m + d.alloc[p][dim].filter(setComplete).length, 0), 0);
  if (d.step >= 1 && d.step <= ALLOC_STEPS) return `${sets} of 36 scenario sets`;
  const block = [LIKERT_NAMES.D7, LIKERT_NAMES.D8, LIKERT_NAMES.D9, "Employee voice", "Your comments", "Review"][d.step - ALLOC_STEPS - 1];
  return block ? `36 of 36 scenario sets · ${block}` : "Before you start";
}
const total = (a: Alloc) => ORIENTATIONS.reduce((n, o) => n + (a[o] ?? 0), 0);
const setComplete = (a: Alloc) => ORIENTATIONS.every((o) => a[o] !== null) && total(a) === 100;

function stepOf(step: number): { kind: "intro" | "alloc" | "likert" | "eos" | "qual" | "review"; persp?: Persp; dim?: string } {
  if (step === 0) return { kind: "intro" };
  if (step <= 6) return { kind: "alloc", persp: "NOW", dim: DIM_IDS[step - 1] };
  if (step <= 12) return { kind: "alloc", persp: "PREFERRED", dim: DIM_IDS[step - 7] };
  if (step <= 15) return { kind: "likert", dim: LIKERT[step - 13] };
  if (step === 16) return { kind: "eos" };
  if (step === 17) return { kind: "qual" };
  return { kind: "review" };
}

function stepValid(d: Draft, step: number): boolean {
  const s = stepOf(step);
  if (s.kind === "alloc") return d.alloc[s.persp!][s.dim!].every(setComplete);
  if (s.kind === "likert") return d.likert[s.dim!].every((v) => v !== null);
  if (s.kind === "eos") return d.eos.every((v) => v !== null);
  return true;
}

function firstIncomplete(d: Draft): { step: number; why: string } | null {
  for (let i = 1; i <= 16; i++) {
    if (stepValid(d, i)) continue;
    const s = stepOf(i);
    const why = s.kind === "alloc" ? `${s.dim} ${s.persp} has a scenario that does not total 100`
      : s.kind === "likert" ? `${s.dim} has unanswered statements` : "eOS has unanswered questions";
    return { step: i, why };
  }
  return null;
}

async function draftKey(token: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("draft:" + token));
  return "cdp-draft-" + Array.from(new Uint8Array(h).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Phase = "loading" | "invalid" | "open" | "submitting" | "done";
type SetD = React.Dispatch<React.SetStateAction<Draft>>;

export default function Flow() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [inst, setInst] = useState<Instrument | null>(null);
  const [d, setD] = useState<Draft>(blank);
  const [error, setError] = useState("");
  const token = useRef("");
  const [decision, setDecision] = useState<Decision>(null);
  const [showConsent, setShowConsent] = useState(false);
  const key = useRef("");
  const ready = useRef(false);

  useEffect(() => {
    (async () => {
      token.current = window.location.hash.slice(1);
      if (!/^[0-9a-f]{32}$/.test(token.current)) return setPhase("invalid");
      const r = await fetch("/v1/survey", { headers: { "x-survey-token": token.current }, cache: "no-store" }).catch(() => null);
      if (!r || !r.ok) return setPhase("invalid");
      const j = (await r.json()) as Instrument;
      setInst(j); setDecision(j.consent.decision);
      key.current = await draftKey(token.current);
      let saved: Draft | null = null;
      try { saved = JSON.parse(localStorage.getItem(key.current) ?? "null") as Draft | null; } catch { /* a broken draft is replaced by a blank one */ }
      // no draft on this device: resume from the server copy (another device, cleared browser)
      if (!saved?.alloc && j.consent.decision === "AGREE") {
        const s = await fetch("/v1/survey/draft", { headers: { "x-survey-token": token.current }, cache: "no-store" }).catch(() => null);
        if (s?.ok) saved = ((await s.json()) as { draft: Draft | null }).draft;
      }
      if (saved?.alloc && saved.likert && saved.eos) setD(saved);
      ready.current = true;
      setPhase("open");
    })();
  }, []);

  // autosave, and count active time while the tab is in front
  useEffect(() => {
    if (phase !== "open" || !ready.current) return;
    const t = setTimeout(() => { try { localStorage.setItem(key.current, JSON.stringify(d)); } catch { /* storage full or blocked */ } }, 400);
    return () => clearTimeout(t);
  }, [d, phase]);
  // server copy on every completed screen (S2.3.1-005); a failed save is retried on the next screen
  const savedStep = useRef(-1);
  useEffect(() => {
    if (phase !== "open" || !ready.current || decision !== "AGREE" || d.step < 2 || d.step === savedStep.current) return;
    savedStep.current = d.step;
    fetch("/v1/survey/draft", { method: "PUT", headers: { "content-type": "application/json", "x-survey-token": token.current }, body: JSON.stringify(d) })
      .then((r) => { if (!r.ok) savedStep.current = -1; }).catch(() => { savedStep.current = -1; });
  }, [d, phase, decision]);
  useEffect(() => {
    if (phase !== "open") return;
    const t = setInterval(() => { if (document.visibilityState === "visible" && d.step > 0) setD((p) => ({ ...p, spent: p.spent + 5 })); }, 5000);
    return () => clearInterval(t);
  }, [phase, d.step]);

  const go = useCallback((to: number) => { setD((p) => ({ ...p, step: Math.max(0, Math.min(LAST, to)) })); window.scrollTo(0, 0); }, []);

  // S2-03: the decision is stored on the server before any item is shown. A decline stores nothing else.
  const decide = async (choice: "AGREE" | "DECLINE"): Promise<string> => {
    const r = await fetch("/v1/survey/consent", { method: "POST", headers: { "content-type": "application/json", "x-survey-token": token.current }, body: JSON.stringify({ decision: choice }) }).catch(() => null);
    if (r?.status === 410) { setPhase("invalid"); return ""; }
    if (!r?.ok) return "Your choice could not be saved. Check your connection and try again.";
    setDecision(choice); setShowConsent(false);
    if (choice === "AGREE") { setD((p) => (p.step === 0 ? { ...p, step: 1 } : p)); window.scrollTo(0, 0); }
    else { try { localStorage.removeItem(key.current); } catch { /* ignore */ } setD(blank); }
    return "";
  };

  const submit = async () => {
    setPhase("submitting"); setError("");
    const alloc = (p: Persp) => Object.fromEntries(DIM_IDS.map((dim) => [dim, d.alloc[p][dim]]));
    const body = {
      payload: { alloc: { NOW: alloc("NOW"), PREFERRED: alloc("PREFERRED") }, likert: d.likert, eos: d.eos, qual: d.qual.map((q) => q.trim()) },
      language: "en", duration: d.spent,
      ...(inst?.about?.length ? { about: Object.fromEntries(inst.about.map((a) => [a.attr_id, d.about?.[a.attr_id] ?? PREFER_NOT])) } : {}),
    };
    const r = await fetch("/v1/survey", { method: "PUT", headers: { "content-type": "application/json", "x-survey-token": token.current }, body: JSON.stringify(body) }).catch(() => null);
    if (r?.ok) { try { localStorage.removeItem(key.current); } catch { /* ignore */ } return setPhase("done"); }
    if (r?.status === 410) return setPhase("invalid");
    const p = r ? await r.json().catch(() => null) : null;
    setError(p?.title ?? "Network problem - your answers are saved on this device. Try again.");
    setPhase("open");
  };

  if (phase === "loading") return <SurveyShell><div className="card"><p className="muted">Loading…</p></div></SurveyShell>;
  if (phase === "invalid") return <LinkExpired what="survey" />;
  if (phase === "done")
    return <SurveyShell><div className="card" style={{ textAlign: "center", padding: "50px 30px" }}>
      <h2>Thank you - your response has been submitted.</h2>
      <p className="muted" style={{ marginTop: 8 }}>Your input is anonymous and will be analysed in aggregate as part of the Culture Dynamics Profile. Results will be shared by your organisation&rsquo;s leadership after the assessment window closes.</p></div></SurveyShell>;

  if (inst && decision === "DECLINE" && !showConsent)
    return <SurveyShell><div className="card" style={{ textAlign: "center", padding: "50px 30px" }}>
      <h2>You have chosen not to take part.</h2>
      <p className="muted" style={{ marginTop: 8 }}>Nothing from you has been recorded except that this link was declined. You can close this page. If you change your mind, you can review the consent text again while the survey is open.</p>
      <div className="navbtns" style={{ justifyContent: "center" }}><button className="btn ghost" onClick={() => setShowConsent(true)}>Review consent again</button></div></div></SurveyShell>;
  if (inst && decision !== "AGREE" && (showConsent || d.step > 0 || decision === "DECLINE"))
    return <SurveyShell><Consent text={inst.consent} onDecide={decide} /></SurveyShell>;

  const s = stepOf(d.step);
  if (s.kind === "intro" && inst) return <Invitation org={inst.org ?? null} closes={inst.closes ?? null} message={inst.message ?? null} estimate={inst.estimate ?? null} onStart={() => (decision === "AGREE" ? go(1) : setShowConsent(true))} />;
  // S2-04 About you: after consent, before the questions, only when the organisation defined attributes
  if (inst?.about?.length && d.step >= 1 && !d.aboutDone)
    return <SurveyShell><AboutYou attrs={inst.about} prefill={inst.prefill ?? {}} value={d.about ?? {}} onDone={(about) => { setD((p) => ({ ...p, about, aboutDone: true })); window.scrollTo(0, 0); }} /></SurveyShell>;
  // S2-05: one practice scenario before the first real one; not stored, not scored
  if (d.step === 1 && !d.practiced)
    return <SurveyShell><Practice autoSubmit={!!d.autoSubmit} onAutoSubmit={(on) => setD((p) => ({ ...p, autoSubmit: on }))} onDone={() => { setD((p) => ({ ...p, practiced: true })); window.scrollTo(0, 0); }} /></SurveyShell>;
  const pct = Math.round((d.step / LAST) * 100);
  const valid = stepValid(d, d.step);

  return (
    <SurveyShell>
      <div className="progressbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="small" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{pct}%</div>
        <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
        <div className="small muted" style={{ whiteSpace: "nowrap" }}>{progressLabel(d)}</div>
      </div>

      {s.kind === "alloc" && inst && <AllocStep inst={inst} persp={s.persp!} dim={s.dim!} d={d} setD={setD} go={go} valid={valid} />}
      {s.kind === "likert" && inst && <LikertStep inst={inst} dim={s.dim!} d={d} setD={setD} go={go} valid={valid} />}
      {s.kind === "eos" && inst && <EosStep inst={inst} d={d} setD={setD} go={go} valid={valid} />}
      {s.kind === "qual" && inst && <QualStep inst={inst} d={d} setD={setD} go={go} />}
      {s.kind === "review" && <Review d={d} go={go} error={error} busy={phase === "submitting"} onSubmit={submit} />}
    </SurveyShell>
  );
}

// ---------------------------------------------------------------- steps

function NavBtns({ go, step, canNext = true, nextLabel = "Continue" }: { go: (n: number) => void; step: number; canNext?: boolean; nextLabel?: string }) {
  return (
    <div className="navbtns">
      <button className="btn ghost" onClick={() => go(step - 1)}>Back</button>
      <button className="btn gold" disabled={!canNext} onClick={() => go(step + 1)}>{nextLabel}</button>
    </div>
  );
}

const PREFER_NOT = "Prefer not to say";

// S2-04. Closed lists only, every list ends with "Prefer not to say" and that is the starting choice, so nothing here is forced. The answers go into the invitation's
// group snapshot at submit and are never stored with a name. Grade and unit come from the invitation and cannot be changed here.
function AboutYou({ attrs, prefill, value, onDone }: { attrs: AboutAttr[]; prefill: { department?: string; team?: string; grade?: string }; value: Record<string, string>; onDone: (a: Record<string, string>) => void }) {
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(attrs.map((a) => [a.attr_id, value[a.attr_id] ?? PREFER_NOT])));
  const given = [prefill.grade ? `grade ${prefill.grade}` : "", prefill.department ? `unit ${prefill.department}` : "", prefill.team && prefill.team !== prefill.department ? `team ${prefill.team}` : ""].filter(Boolean).join(", ");
  return (
    <div className="card">
      <h2>About you</h2>
      <p className="muted" style={{ marginTop: 6 }}>These questions let your organisation see results for groups. Every question is optional: choose &ldquo;{PREFER_NOT}&rdquo; to skip it. Your answers are stored with your responses without your name, and results are only shown for groups of five or more.</p>
      {given && <p className="small" style={{ marginTop: 10 }}>From your invitation (you cannot change these): {given}.</p>}
      {attrs.map((a) => (
        <div key={a.attr_id} style={{ marginTop: 14 }}>
          <label htmlFor={`about-${a.attr_id}`} style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>{a.name}</label>
          <select id={`about-${a.attr_id}`} value={v[a.attr_id]} onChange={(e) => setV((p) => ({ ...p, [a.attr_id]: e.target.value }))}>
            {a.values.map((x) => <option key={x}>{x}</option>)}
          </select>
        </div>))}
      <div className="navbtns"><span /><button className="btn gold" onClick={() => onDone(v)}>Continue</button></div>
    </div>
  );
}

function Consent({ text, onDecide }: { text: ConsentText; onDecide: (d: "AGREE" | "DECLINE") => Promise<string> }) {
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const choose = async (c: "AGREE" | "DECLINE") => { setBusy(true); setErr(""); const e = await onDecide(c); if (e) { setErr(e); setBusy(false); } };
  return (
    <div className="card">
      <h2>{text.title}</h2>
      <p className="small muted">Consent text version {text.version}</p>
      {text.body.split(/\n{2,}/).map((para, i) => <p key={i} style={{ marginTop: 10 }}>{para}</p>)}
      <p className="small" style={{ marginTop: 10 }}>You can see what is held about you, correct it, object, or have your invitation erased at any time before you submit: <RightsLink>your data rights</RightsLink>.</p>
      <div className="note blue">
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
          <input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} style={{ marginTop: 3 }} />
          <span>I have read and understood the above. I understand that once I submit, my answers cannot be individually retrieved or deleted. I agree to take part.</span>
        </label>
      </div>
      {err && <div className="note" role="alert">{err}</div>}
      <div className="navbtns">
        <button className="btn ghost" disabled={busy} onClick={() => choose("DECLINE")}>I do not agree</button>
        <button className="btn gold" disabled={!ticked || busy} onClick={() => choose("AGREE")}>I agree</button>
      </div>
    </div>
  );
}

const PRACTICE: [typeof ORIENTATIONS[number], string][] = [
  ["ENGAGE", "We check in on how everyone is doing before we start."],
  ["INNOVATE", "We try a new way of running the meeting each time."],
  ["PERFORM", "We go straight to the numbers and the decisions due."],
  ["GOVERN", "We follow the agenda and record every decision."],
];
function Practice({ onDone, autoSubmit, onAutoSubmit }: { onDone: () => void; autoSubmit: boolean; onAutoSubmit: (on: boolean) => void }) {
  const [a, setA] = useState<Alloc>(emptyAlloc());
  const t = total(a);
  return (
    <div className="card">
      <h2>A practice scenario</h2>
      <p className="muted">This one is not saved or scored. It shows how every scenario works: share exactly <b>100 points</b> across four statements, more points to the one most like your organisation. Zero is allowed. Each statement is labelled with the orientation it describes. Use the arrow keys to step a number up or down.</p>
      <div className="scen">
        <div className="shead">Practice: a typical team meeting<span className="sq">In our team meetings&hellip;</span></div>
        {PRACTICE.map(([o, text]) => (
          <div className="orow" key={o}>
            <span className="pill n" style={{ marginTop: 2 }}>{o}</span>
            <div className="ostmt">{text}</div>
            <input inputMode="numeric" autoComplete="off" aria-label={`Practice points for ${o}`} value={a[o] ?? ""}
              onKeyDown={(e) => { if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return; e.preventDefault(); const step = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 5 : 1); setA((x) => ({ ...x, [o]: Math.max(0, Math.min(100, (x[o] ?? 0) + step)) })); }}
              onChange={(e) => { const digits = e.target.value.replace(/\D/g, "").slice(0, 3); setA((x) => ({ ...x, [o]: digits === "" ? null : Math.min(100, parseInt(digits, 10)) })); }} />
          </div>
        ))}
        <div className="totrow">
          <span className="small muted">{t === 100 ? "That is how it works." : t < 100 ? `${100 - t} points remaining` : `${t - 100} points over`}</span>
          <span>Total: <span className={`totchip${t === 100 ? " ok" : ""}`} aria-live="polite">{t}</span> / 100</span>
        </div>
      </div>
      <label className="small" style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14 }}>
        <input type="checkbox" checked={autoSubmit} onChange={(e) => onAutoSubmit(e.target.checked)} style={{ marginTop: 3 }} />
        <span>If the survey closes before I finish, submit the scenarios I have fully answered. Unfinished scenarios are left out. If you leave this unticked, nothing is submitted unless you press Submit.</span>
      </label>
      <div className="navbtns"><button className="btn ghost" onClick={onDone}>Skip the practice</button><button className="btn gold" disabled={t !== 100} onClick={onDone}>Start the survey</button></div>
    </div>
  );
}

function AllocStep({ inst, persp, dim, d, setD, go, valid }: { inst: Instrument; persp: Persp; dim: string; d: Draft; setD: SetD; go: (n: number) => void; valid: boolean }) {
  const scenarios = inst.scenarios.filter((x) => x.dimension === dim).sort((a, b) => a.sequence - b.sequence);
  const isNow = persp === "NOW";
  const di = DIM_IDS.indexOf(dim);
  const patch = (si: number, fn: (a: Alloc) => Alloc) =>
    setD((p) => ({ ...p, alloc: { ...p.alloc, [persp]: { ...p.alloc[persp], [dim]: p.alloc[persp][dim].map((a, i) => (i === si ? fn(a) : a)) } } }));
  return (
    <div className="card">
      <h2>{dim} - {DIMS[di].name} · {isNow ? "NOW" : "PREFERRED"}</h2>
      <p className="muted">{DIMS[di].sub}</p>
      <div className={`note${isNow ? " blue" : ""}`}>
        {isNow
          ? <><b>NOW - the culture we have.</b> Rate your organisation as it IS TODAY.</>
          : <><b>PREFERRED - the culture we want to build.</b> Rate your organisation as you believe it NEEDS TO BE in five years to succeed against its strategy.</>}{" "}
        For each scenario distribute exactly <b>100 points</b> across the four statements - more points to the statement most similar to your organisation.
      </div>
      {scenarios.map((sc, si) => {
        const a = d.alloc[persp][dim][si];
        const t = total(a);
        const sts = ORIENTATIONS.map((o) => inst.statements.find((x) => x.scenario_id === sc.scenario_id && x.orientation === o)!);
        return (
          <div className="scen" key={sc.scenario_id}>
            <div className="shead">Scenario {si + 1}: {sc.title}<span className="sq">{isNow ? sc.prompt_now : sc.prompt_preferred.replace(/^PREFERRED perspective:\s*/i, "")}</span></div>
            {sts.map((st) => (
              <div className="orow" key={st.orientation}>
                <span className="pill n" style={{ marginTop: 2 }}>{st.orientation}</span>
                <div className="ostmt">{st.text}</div>
                <input inputMode="numeric" autoComplete="off" aria-label={`Points for ${st.orientation}`} value={a[st.orientation] ?? ""}
                  onKeyDown={(e) => {   // stepper: arrow keys move by 1, with Shift by 5
                    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                    e.preventDefault();
                    const step = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 5 : 1);
                    patch(si, (x) => ({ ...x, [st.orientation]: Math.max(0, Math.min(100, (x[st.orientation] ?? 0) + step)) }));
                  }}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                    patch(si, (x) => ({ ...x, [st.orientation]: digits === "" ? null : Math.min(100, parseInt(digits, 10)) }));
                  }} />
              </div>
            ))}
            <div className="totrow">
              <span className="small muted">{t === 100 ? "" : t < 100 ? `${100 - t} points remaining` : `${t - 100} points over`}</span>
              <button className="btn sm ghost" onClick={() => patch(si, (x) => {
                const empty = ORIENTATIONS.filter((o) => x[o] === null);
                if (t >= 100 || !empty.length) return x;
                const rem = 100 - t, per = Math.floor(rem / empty.length), next = { ...x };
                empty.forEach((o, i) => { next[o] = i === empty.length - 1 ? rem - per * (empty.length - 1) : per; });
                return next;
              })}>Fill remainder</button>
              <span>Total: <span className={`totchip${t === 100 ? " ok" : ""}`} aria-live="polite">{t}</span> / 100</span>
            </div>
          </div>
        );
      })}
      <NavBtns go={go} step={d.step} canNext={valid} />
    </div>
  );
}

function LikertStep({ inst, dim, d, setD, go, valid }: { inst: Instrument; dim: string; d: Draft; setD: SetD; go: (n: number) => void; valid: boolean }) {
  const items = inst.items.filter((i) => i.block === "LIKERT" && i.dimension === dim).sort((a, b) => a.sequence - b.sequence);
  return (
    <div className="card">
      <h2>{LIKERT_NAMES[dim]}</h2>
      <p className="muted">PAC proprietary dimension · Rate each statement independently: 1 = Strongly Disagree · 5 = Strongly Agree</p>
      <p className="small muted">{WHYS[dim.toLowerCase() as "d7"]}</p>
      {items.map((it, i) => (
        <div className="likrow" key={it.item_id}>
          <div className="q"><b>{i + 1}.</b> {it.canonical_text}</div>
          <div className="lik" role="radiogroup" aria-label={`Statement ${i + 1}`}>
            {LIKERT_LABELS.map((lab, v) => (
              <label key={lab}>
                <input type="radio" name={it.item_id} checked={d.likert[dim][i] === v + 1}
                  onChange={() => setD((p) => ({ ...p, likert: { ...p.likert, [dim]: p.likert[dim].map((x, j) => (j === i ? v + 1 : x)) } }))} />
                {v + 1}
                <span className="small" style={{ fontSize: 10 }}>{lab}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
      <NavBtns go={go} step={d.step} canNext={valid} />
    </div>
  );
}

function EosStep({ inst, d, setD, go, valid }: { inst: Instrument; d: Draft; setD: SetD; go: (n: number) => void; valid: boolean }) {
  const items = inst.items.filter((i) => i.block === "EOS").sort((a, b) => a.sequence - b.sequence);
  return (
    <div className="card">
      <h2>Employee Orientation Survey (eOS)</h2>
      <p className="muted">Rate each question 0-10 · 0 = Not at all / completely negative · 10 = Extremely / completely positive</p>
      {items.map((it, i) => (
        <div className="likrow" key={it.item_id}>
          <div className="q"><b>{i + 1}.</b> {it.canonical_text}</div>
          <div className="lik" role="radiogroup" aria-label={`Question ${i + 1}`}>
            {Array.from({ length: 11 }, (_, v) => (
              <label key={v} style={{ minWidth: 30, padding: "6px 0" }}>
                <input type="radio" name={it.item_id} checked={d.eos[i] === v} onChange={() => setD((p) => ({ ...p, eos: p.eos.map((x, j) => (j === i ? v : x)) }))} />
                {v}
              </label>
            ))}
          </div>
        </div>
      ))}
      <NavBtns go={go} step={d.step} canNext={valid} />
    </div>
  );
}

function QualStep({ inst, d, setD, go }: { inst: Instrument; d: Draft; setD: SetD; go: (n: number) => void }) {
  const items = inst.items.filter((i) => i.block === "QUAL").sort((a, b) => a.sequence - b.sequence);
  return (
    <div className="card">
      <h2>Qualitative Reflection</h2>
      <p className="muted">
        Your written responses are completely anonymous and analysed thematically alongside the quantitative results. Be specific and
        concrete - describe actual situations and real behaviours. Please do not include names or anything that could identify you or a colleague.
      </p>
      {items.map((it, i) => (
        <div key={it.item_id}>
          <label className="f" htmlFor={it.item_id}>{QUAL_TITLES[i]}<span className="hint">{it.canonical_text}</span></label>
          <textarea id={it.item_id} maxLength={4000} value={d.qual[i]} onChange={(e) => setD((p) => ({ ...p, qual: p.qual.map((x, j) => (j === i ? e.target.value : x)) }))} />
        </div>
      ))}
      <NavBtns go={go} step={d.step} nextLabel="Review & submit" />
    </div>
  );
}

function Review({ d, go, error, busy, onSubmit }: { d: Draft; go: (n: number) => void; error: string; busy: boolean; onSubmit: () => void }) {
  const bad = useMemo(() => firstIncomplete(d), [d]);
  const rows: [string, boolean][] = [];
  (["NOW", "PREFERRED"] as const).forEach((persp) => DIM_IDS.forEach((dim, di) =>
    rows.push([`${dim} ${DIMS[di].name} - ${persp}`, d.alloc[persp][dim].every(setComplete)])));
  LIKERT.forEach((dim) => rows.push([LIKERT_NAMES[dim].replace(" - ", " "), d.likert[dim].every((v) => v !== null)]));
  rows.push(["eOS", d.eos.every((v) => v !== null)]);
  return (
    <div className="card">
      <h2>Review &amp; submit</h2>
      {bad
        ? <div className="note"><b>Incomplete:</b> {bad.why} <button className="linklike" style={{ background: "none", border: 0 }} onClick={() => go(bad.step)}>Go to it</button></div>
        : <div className="note blue"><b>All sections complete.</b> Once submitted, your response is final and cannot be edited.</div>}
      {error && <div className="note" role="alert"><b>Submission problem:</b> {error}</div>}
      <table className="tbl">
        <thead><tr><th>Section</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(([label, ok]) => (
            <tr key={label}><td>{label}</td><td>{ok ? <span className="pill ok">complete</span> : <span className="pill bad">incomplete</span>}</td></tr>
          ))}
          <tr><td>Qualitative (optional)</td><td>{d.qual.some((t) => t.trim()) ? <span className="pill ok">answered</span> : <span className="pill warn">blank</span>}</td></tr>
        </tbody>
      </table>
      <div className="navbtns">
        <button className="btn ghost" onClick={() => go(LAST - 1)}>Back</button>
        <button className="btn gold" disabled={bad !== null || busy} onClick={onSubmit}>{busy ? "Submitting…" : "Submit my response"}</button>
      </div>
    </div>
  );
}
