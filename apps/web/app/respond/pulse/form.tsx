"use client";

import { useEffect, useRef, useState } from "react";
import { SurveyShell } from "@/components/survey-shell";
import { LinkExpired } from "@/components/link-expired";

type Scenario = { scenario_id: string; dimension: string; title: string; prompt_now: string };
type Statement = { scenario_id: string; orientation: string; text: string };
type LItem = { item_id: string; dimension: string; canonical_text: string };
type EItem = { item_id: string; sequence: number; canonical_text: string };
type Pulse = { org: string | null; closes: string | null; items: string[]; scenarios: Scenario[]; statements: Statement[]; likert: LItem[]; eos: EItem[] };
type Answers = Record<string, Record<string, number | null> | number | null>;

const ORIENT = ["ENGAGE", "INNOVATE", "PERFORM", "GOVERN"] as const;
const LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const SHORT: Record<string, string[]> = { D7: ["D7-01", "D7-03", "D7-04", "D7-08"], D8: ["D8-02", "D8-03", "D8-05", "D8-11"], D9: ["D9-01", "D9-05", "D9-09", "D9-10"] };
const NAMES: Record<string, string> = { D7: "Readiness: capability and leadership", D8: "Readiness: change capacity", D9: "Readiness: execution discipline" };
const total = (a: Record<string, number | null>) => ORIENT.reduce((s, o) => s + (a[o] ?? 0), 0);

// One short page: the items the pulse asks, nothing else. Answers stay on this device until submitted. The token never leaves the page
// except in the request header.
export default function Form() {
  const token = useRef("");
  const [p, setP] = useState<Pulse | null>(null);
  const [phase, setPhase] = useState<"loading" | "invalid" | "open" | "sending" | "done">("loading");
  const [ans, setAns] = useState<Answers>({});
  const [err, setErr] = useState("");
  const key = () => `cdppulse:${token.current.slice(0, 8)}`;

  useEffect(() => {
    token.current = window.location.hash.slice(1).trim().toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(token.current)) { setPhase("invalid"); return; }
    fetch("/v1/pulse-survey", { headers: { "x-survey-token": token.current } }).then(async (r) => {
      if (!r.ok) return setPhase("invalid");
      const body: Pulse = await r.json();
      setP(body);
      try { const saved = JSON.parse(localStorage.getItem(key()) ?? "null"); if (saved && typeof saved === "object") setAns(saved); } catch { /* ignore */ }
      setPhase("open");
    }).catch(() => setPhase("invalid"));
  }, []);
  useEffect(() => { if (phase === "open") try { localStorage.setItem(key(), JSON.stringify(ans)); } catch { /* ignore */ } }, [ans, phase]);

  if (phase === "loading") return <SurveyShell><div className="card"><p className="muted">Loading…</p></div></SurveyShell>;
  if (phase === "invalid") return <LinkExpired what="survey" />;
  if (phase === "done") return <SurveyShell><div className="card" style={{ textAlign: "center", padding: "50px 30px" }}>
    <h2>Thank you. Your answers have been submitted.</h2>
    <p className="muted" style={{ marginTop: 8 }}>Your name is already separated from your answers. Results are only reported for groups of five or more, and they are indicative.</p></div></SurveyShell>;

  const set = (ref: string, sub: string | null, v: number | null) =>
    setAns((a) => ({ ...a, [ref]: sub === null ? v : { ...((a[ref] as Record<string, number | null>) ?? {}), [sub]: v } }));
  const complete = (ref: string) => {
    const a = ans[ref];
    if (/^eOS /.test(ref)) return typeof a === "number";
    if (!a || typeof a !== "object") return false;
    return /^D[7-9]$/.test(ref) ? SHORT[ref].every((i) => typeof a[i] === "number") : ORIENT.every((o) => typeof a[o] === "number") && total(a) === 100;
  };
  const all = p!.items.every(complete);

  const submit = async () => {
    setPhase("sending"); setErr("");
    const r = await fetch("/v1/pulse-survey", { method: "PUT", headers: { "content-type": "application/json", "x-survey-token": token.current }, body: JSON.stringify({ answers: ans }) }).catch(() => null);
    if (r?.ok) { try { localStorage.removeItem(key()); } catch { /* ignore */ } return setPhase("done"); }
    if (r?.status === 410) return setPhase("invalid");
    const b = r ? await r.json().catch(() => null) : null;
    setErr(b?.title ?? "Network problem. Your answers are kept on this device; try again."); setPhase("open");
  };

  const closes = p!.closes ? new Date(p!.closes).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null;
  const done = p!.items.filter(complete).length;
  return (
    <SurveyShell>
      <div className="card">
        <h2>Culture pulse{p!.org ? ` · ${p!.org}` : ""}</h2>
        <p className="muted">A short check on the culture priorities your organisation is working on. It takes about five to ten minutes{closes ? ` and is open until ${closes}` : ""}. Answer for the whole organisation, as it is today.</p>
        <p className="small muted">Your name is separated from your answers when you submit. {done} of {p!.items.length} parts answered.</p>
      </div>
      {p!.items.map((ref) => {
        if (/^eOS /.test(ref)) {
          const q = Number(ref.slice(5)), it = p!.eos[q - 1];
          return (
            <div className="card" key={ref}>
              <h2>Employee Orientation Survey, question {q}</h2>
              <p className="muted">Rate 0 to 10 · 0 = Not at all / completely negative · 10 = Extremely / completely positive</p>
              <div className="likrow">
                <div className="q">{it?.canonical_text}</div>
                <div className="lik" role="radiogroup" aria-label={`Question ${q}`}>
                  {Array.from({ length: 11 }, (_, v) => (
                    <label key={v} style={{ minWidth: 30, padding: "6px 0" }}><input type="radio" name={ref} checked={ans[ref] === v} onChange={() => set(ref, null, v)} />{v}</label>
                  ))}
                </div>
              </div>
            </div>
          );
        }
        if (/^D[7-9]$/.test(ref)) {
          return (
            <div className="card" key={ref}>
              <h2>{NAMES[ref]}</h2>
              <p className="muted">Rate each statement independently: 1 = Strongly disagree · 5 = Strongly agree</p>
              {SHORT[ref].map((id, i) => {
                const it = p!.likert.find((x) => x.item_id === id);
                const a = (ans[ref] ?? {}) as Record<string, number | null>;
                return (
                  <div className="likrow" key={id}>
                    <div className="q"><b>{i + 1}.</b> {it?.canonical_text}</div>
                    <div className="lik" role="radiogroup" aria-label={`Statement ${i + 1}`}>
                      {LABELS.map((lab, v) => (
                        <label key={lab}><input type="radio" name={id} checked={a[id] === v + 1} onChange={() => set(ref, id, v + 1)} />{v + 1}<span className="small" style={{ fontSize: 10 }}>{lab}</span></label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        }
        const [dim, setNo] = ref.split(" ");
        const sc = p!.scenarios.find((x) => x.scenario_id === `${dim}-${setNo}`);
        const a = (ans[ref] ?? {}) as Record<string, number | null>;
        const t = total(a);
        return (
          <div className="card" key={ref}>
            <h2>{dim} · NOW</h2>
            <div className="note blue"><b>NOW - the culture we have.</b> Rate your organisation as it IS TODAY. Distribute exactly <b>100 points</b> across the four statements, more to the one most like your organisation.</div>
            <div className="scen">
              <div className="shead">{sc?.title}<span className="sq">{sc?.prompt_now}</span></div>
              {ORIENT.map((o, i) => (
                <div className="orow" key={o}>
                  <span className="pill n" style={{ marginTop: 2 }}>{"ABCD"[i]}</span>
                  <div className="ostmt">{p!.statements.find((x) => x.scenario_id === `${dim}-${setNo}` && x.orientation === o)?.text}</div>
                  <input inputMode="numeric" autoComplete="off" aria-label={`Points for statement ${"ABCD"[i]}`} value={a[o] ?? ""}
                    onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 3); set(ref, o, d === "" ? null : Math.min(100, parseInt(d, 10))); }} />
                </div>
              ))}
              <div className="totrow">
                <span className="small muted">{t === 100 ? "" : t < 100 ? `${100 - t} points remaining` : `${t - 100} points over`}</span>
                <span>Total: <span className={`totchip${t === 100 ? " ok" : ""}`} aria-live="polite">{t}</span> / 100</span>
              </div>
            </div>
          </div>
        );
      })}
      {err && <div className="note" role="alert">{err}</div>}
      <div className="navbtns"><span /><button className="btn gold" disabled={!all || phase === "sending"} onClick={submit}>{phase === "sending" ? "Sending…" : "Submit"}</button></div>
    </SurveyShell>
  );
}
