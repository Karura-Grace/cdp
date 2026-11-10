"use client";

import { useEffect, useRef, useState } from "react";
import ITEMS from "@/lib/l360-items.json";
import { SurveyShell } from "@/components/survey-shell";
import { LinkExpired } from "@/components/link-expired";

type Status = { kind: "SELF" | "RATER"; leader: string };
const LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];
const NOT_OBSERVED = 0;   // sent as 0 (raters only): a blank is never sent, the server refuses it (owner rule 26 Oct 2026, Q-L2)
const KNOWN = [["LT1Y", "Less than a year"], ["Y1_3", "One to three years"], ["Y3P", "More than three years"]] as const;
const CONTACT = [["DAILY", "Daily"], ["WEEKLY", "Weekly"], ["MONTHLY", "Monthly"], ["RARELY", "Rarely"]] as const;

// One page per section (8). Every statement on a page needs an answer before the rater can leave it; raters may answer "Not observed" (an answer), a self form
// has no such choice. There is no Back: a finished page stays finished. Answers stay on this device
// until submitted. The token never leaves the page except in the request header.
// preview: a read only walk through for the PAC consultant (no token, nothing stored, submit disabled)
export default function Form({ preview }: { preview?: "SELF" | "RATER" } = {}) {
  const token = useRef("");
  const [st, setSt] = useState<Status | null>(null);
  const [phase, setPhase] = useState<"loading" | "invalid" | "open" | "sending" | "done">("loading");
  const [ans, setAns] = useState<(number | null)[]>(Array(60).fill(null));
  const [sec, setSec] = useState(0);
  const [err, setErr] = useState("");
  const [meta, setMeta] = useState<{ known_for: string; contact: string }>({ known_for: "", contact: "" });
  const [text, setText] = useState<string[]>([]);
  const [ack, setAck] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const key = () => `cdp360:${token.current.slice(0, 8)}`;

  useEffect(() => {
    if (preview) { setSt({ kind: preview, leader: "the leader" }); setPhase("open"); return; }
    token.current = window.location.hash.slice(1).trim().toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(token.current)) { setPhase("invalid"); return; }
    fetch("/v1/l360", { headers: { "x-survey-token": token.current } }).then(async (r) => {
      if (!r.ok) return setPhase("invalid");
      setSt(await r.json());
      try { const saved = JSON.parse(localStorage.getItem(key()) ?? "null"); if (Array.isArray(saved) && saved.length === 60) { setAns(saved); const first = ITEMS.sections.findIndex((x) => saved.slice(x.from, x.to).some((v: number | null) => v === null)); setSec(first < 0 ? ITEMS.sections.length - 1 : first); } } catch { /* ignore */ }
      setPhase("open");
    }).catch(() => setPhase("invalid"));
  }, []);
  useEffect(() => { if (phase === "open" && !preview) try { localStorage.setItem(key(), JSON.stringify(ans)); } catch { /* ignore */ } }, [ans, phase]);

  if (phase === "loading") return <SurveyShell><div className="card"><p className="muted">Loading…</p></div></SurveyShell>;
  if (phase === "invalid") return <LinkExpired what="feedback" />;
  if (phase === "done") return <SurveyShell><div className="card" style={{ textAlign: "center", padding: "50px 30px" }}>
    <h2>Thank you. Your feedback has been submitted.</h2>
    <p className="muted" style={{ marginTop: 8 }}>Your answers are combined with others in the same group. A group with fewer than three people is merged with others, so no single rater can be identified.</p></div></SurveyShell>;

  const self = st!.kind === "SELF";
  const items = self ? ITEMS.self : ITEMS.rater;
  const s = ITEMS.sections[sec];
  const range = Array.from({ length: s.to - s.from }, (_, i) => s.from + i);
  const done = (i: number) => ans[i] !== null;
  const secDone = range.every(done);
  const allDone = ans.every((v) => v !== null);
  const open = self ? ITEMS.open_self : ITEMS.open_rater;
  const pct = Math.round((ans.filter((v) => v !== null).length / 60) * 100);

  const missing = range.filter((i) => !done(i));
  const next = () => {
    if (!secDone && !preview) {
      setShowMissing(true);
      requestAnimationFrame(() => document.getElementById(`stmt-${missing[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setShowMissing(false); setSec(sec + 1); window.scrollTo(0, 0);
  };
  const submit = async () => {
    setPhase("sending"); setErr("");
    const ratings = ans;   // 0 means Not observed on a rater form; every statement has an answer by now
    const r = await fetch("/v1/l360", { method: "PUT", headers: { "content-type": "application/json", "x-survey-token": token.current }, body: JSON.stringify({ ratings, meta: self ? undefined : meta, text: Object.fromEntries(open.map((_, i) => [`${self ? "S" : "R"}-Q${i + 1}`, (text[i] ?? "").trim()]).filter(([, v]) => v)) }) }).catch(() => null);
    if (r?.ok) { try { localStorage.removeItem(key()); } catch { /* ignore */ } return setPhase("done"); }
    if (r?.status === 410) return setPhase("invalid");
    const p = r ? await r.json().catch(() => null) : null;
    setErr(p?.title ?? "Network problem. Your answers are kept on this device; try again."); setPhase("open");
  };

  return (
    <SurveyShell>
      <div className="progressbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="small" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>{pct}%</div>
        <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
        <div className="small muted" style={{ whiteSpace: "nowrap" }}>Section {sec + 1} of 8</div>
      </div>
      {preview && <div className="note" role="note">Preview of the {self ? "self assessment" : "rater form"}. Nothing you choose here is stored.</div>}
      {sec === 0 && <div className="card">
        <h2>Leadership 360{self ? ": your self assessment" : ` for ${st!.leader}`}</h2>
        <p className="muted">{self ? "Rate how often you show each behaviour now. Every statement needs an answer." : `Rate how often ${st!.leader} shows each behaviour, based on what you have seen. Choose “Not observed” when you have not seen enough to judge.`} It takes about 15 minutes. Your answers stay on this device until you submit.</p>
        <p className="small" style={{ marginTop: 8 }}>{self ? "Your self ratings are compared with how others see you, for your development." : "Ratings are combined by group, and a group of fewer than three is merged with others. Your comments are read by a PAC consultant, who removes anything that could identify you, before the leader sees them."} Results are used for development only, never for pay, promotion or discipline.</p>
        <p className="small" style={{ marginTop: 8 }}><b>Integrity.</b> {ITEMS.integrity_notice}</p>
      </div>}
      {sec === 0 && !self && <div className="card">
        <h2>About how you know {st!.leader}</h2>
        <p className="muted small">Optional. Only counts across all raters are reported, and only when three or more people rated this leader.</p>
        {([["known_for", "How long have you worked with them?", KNOWN], ["contact", "How often are you in contact?", CONTACT]] as const).map(([k, q, opts]) => (
          <div className="likrow" key={k}><div className="q">{q}</div>
            <div className="lik" role="radiogroup" aria-label={q}>{opts.map(([v, lab]) => (
              <label key={v}><input type="radio" name={k} checked={meta[k] === v} onChange={() => setMeta((m) => ({ ...m, [k]: v }))} /><span className="small" style={{ fontSize: 11 }}>{lab}</span></label>))}</div></div>))}
      </div>}
      <div className="card">
        <h2>{s.name}</h2>
        {range.map((i) => (
          <div className="likrow" key={i} id={`stmt-${i}`} style={showMissing && !done(i) ? { outline: "2px solid #c0392b", outlineOffset: 4, borderRadius: 8 } : undefined}>
            <div className="q"><b>{i + 1}.</b> {items[i]}{showMissing && !done(i) && <span role="alert" style={{ color: "#c0392b", fontWeight: 700, marginLeft: 8 }}>Please answer this</span>}</div>
            <div className="lik" role="radiogroup" aria-label={`Statement ${i + 1}`}>
              {LABELS.map((lab, v) => (
                <label key={lab}><input type="radio" name={`q${i}`} checked={ans[i] === v + 1} onChange={() => setAns((p) => p.map((x, j) => (j === i ? v + 1 : x)))} />
                  {v + 1}<span className="small" style={{ fontSize: 10 }}>{lab}</span></label>
              ))}
              {!self && <label><input type="radio" name={`q${i}`} checked={ans[i] === NOT_OBSERVED} onChange={() => setAns((p) => p.map((x, j) => (j === i ? NOT_OBSERVED : x)))} />
                –<span className="small" style={{ fontSize: 10 }}>Not observed</span></label>}
            </div>
          </div>
        ))}
      </div>
      {sec === 7 && <div className="card">
        <h2>{self ? "Reflection" : "Your comments"}</h2>
        <p className="muted small">Optional, up to 2,000 characters each. {self ? "Only you, your coach and the PAC consultant see these." : "Please do not name or describe anyone in a way that could identify them. Comments are read by a PAC consultant before the leader sees them."}</p>
        {open.map((q, i) => (
          <div key={q} style={{ marginTop: 12 }}>
            <label htmlFor={`open-${i}`} style={{ fontWeight: 600, display: "block", marginBottom: 4 }}>{q}</label>
            <textarea id={`open-${i}`} rows={3} maxLength={2000} style={{ width: "100%" }} value={text[i] ?? ""} onChange={(e) => setText((p) => { const n = [...p]; n[i] = e.target.value; return n; })} />
          </div>))}
        <div className="note blue" style={{ marginTop: 14 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} style={{ marginTop: 3 }} />
            <span>{self ? "I confirm these ratings are my honest view of my own behaviour, and I understand how the results are used, including the integrity rule above." : "I confirm I gave honest ratings from what I have seen myself, and I understand how the results are used, including the integrity rule above."}</span>
          </label>
        </div>
      </div>}
      {showMissing && !secDone && !preview && <div className="note" role="alert">{missing.length} statement{missing.length === 1 ? " needs" : "s need"} an answer before you can continue. {self ? "Every statement needs a rating from 1 to 5." : "Choose 1 to 5, or Not observed if you have not seen it."}</div>}
      {err && <div className="note" role="alert">{err}</div>}
      <div className="navbtns">
        {preview && sec > 0 ? <button className="btn ghost" onClick={() => { setSec(sec - 1); window.scrollTo(0, 0); }}>Back</button> : <span />}
        {sec < 7
          ? <button className="btn gold" onClick={next}>Continue</button>
          : <button className="btn gold" disabled={!!preview || !allDone || !ack || phase === "sending"} onClick={submit}>{phase === "sending" ? "Sending…" : "Submit"}</button>}
      </div>
    </SurveyShell>
  );
}
