"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
// Generated from the Claude Design file Contact.dc.html (Desktop/cdp-v3/new-cdp-design). Edit freely; it is plain React now.
import { Fragment } from "react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { useState } from "react";

export default function ContactPage() {
  const NEEDS = ["Align culture to strategy", "Leadership behaviour gap", "Systems and rituals", "Business-model change", "Readiness for transformation", "Sub-cultures or integration"];
  const [sent, setSent] = useState(false);
  const [email, setEmailV] = useState("");
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  const emailErr = tried && !ok, emailInvalid = emailErr ? "true" : "false", emailCls = emailErr ? "input is-error" : "input", notSent = !sent;
  const setEmail = (e: any) => setEmailV(e.target.value);
  const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value?.trim() ?? "";
  // The form posts to /api/contact, which emails the CDP team (cdp@pac.africa) and sends the visitor a confirmation.
  const submit = async (e: any) => {
    e.preventDefault();
    setErr("");
    if (!ok) return setTried(true);
    const consent = (document.getElementById("c-consent") as HTMLInputElement | null)?.checked === true;
    if (!consent) return setErr("Please tick the box so we may contact you.");
    setSending(true);
    try {
      const r = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: val("c-name"), role: val("c-role"), email, org: val("c-org"), size: val("c-size"), needs: NEEDS.filter((n) => picked[n]), message: val("c-msg"), consent, website: val("c-web") }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(j.error || "We could not send your request. Please write to cdp@pac.africa.");
      setSent(true);
    } catch {
      setErr("We could not reach the server. Please check your connection or write to cdp@pac.africa.");
    } finally {
      setSending(false);
    }
  };
  const reset = () => { setErr(""); setSent(false); setEmailV(""); setTried(false); setPicked({}); };
  const needs = NEEDS.map((l) => { const on = !!picked[l]; return { label: l, on: on ? "true" : "false", cls: on ? "chip is-on" : "chip", toggle: () => setPicked({ ...picked, [l]: !on }) }; });
  return (
    <>


<div className="cdp" style={{ width: "100%", minHeight: "100vh", fontFamily: "var(--font-inter), 'Roboto', 'Open Sans', sans-serif", color: "#131313", background: "#FAF7F2" }}>
<SiteNav current="contact" />
<main>
<section>
<div className="wrap grid-2" style={{ paddingBlock: "clamp(24px, 3.4vw, 40px)", alignItems: "start" }}>
<div className="enter" style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
<p className="eyebrow">Talk to us</p>
<h1 className="display-l">Begin with a conversation</h1>
<p className="lead">Every CDP engagement starts with a PAC consultant. Tell us about your organisation and what prompted the question. A consultant will reply to arrange a briefing.</p>
<ol style={{ listStyle: "none", margin: "8px 0 0", padding: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
<li style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "12px" }}><span style={{ width: "32px", height: "32px", borderRadius: "99px", background: "#131313", color: "#FAF7F2", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px" }}>1</span><div><b>A 15-minute briefing</b><p className="small" style={{ marginTop: "2px" }}>What CDP measures, what you receive and how long it takes.</p></div></li>
<li style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "12px" }}><span style={{ width: "32px", height: "32px", borderRadius: "99px", background: "#131313", color: "#FAF7F2", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px" }}>2</span><div><b>An engagement proposal</b><p className="small" style={{ marginTop: "2px" }}>Scope, cohorts, Leadership 360 coverage and timing.</p></div></li>
<li style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: "12px" }}><span style={{ width: "32px", height: "32px", borderRadius: "99px", background: "#EB5733", color: "#131313", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px" }}>3</span><div><b>The executive workshop</b><p className="small" style={{ marginTop: "2px" }}>Where your strategy becomes the standard the culture is judged against.</p></div></li>
</ol>
<div className="alert info" style={{ marginTop: "8px" }}><svg className="ic" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#131313" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg><div><b>Invited to take a survey?</b> Use the personal link in your invitation email. You do not need an account, and this form is not part of the survey.</div></div>
</div>

<div className="panel" style={{ padding: "clamp(20px, 3vw, 36px)" }}>
{sent && (<>
<div role="status" style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "24px 0" }}>
<span style={{ width: "48px", height: "48px", borderRadius: "99px", background: "#EB5733", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#131313" strokeWidth="2.6" strokeLinecap="round"><path d="M20 6 9 17l-5-5"></path></svg></span>
<p className="h1" style={{ fontSize: "30px" }}>Thank you. Your request is with us.</p>
<p className="body">A PAC consultant will reply to arrange a briefing. We have also sent a confirmation to your email. If you do not see it, check your spam folder or write to cdp@pac.africa.</p>
<button type="button" className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={reset}>Send another enquiry</button>
</div>
</>)}
{notSent && (<>
<form style={{ display: "flex", flexDirection: "column", gap: "18px", margin: "0" }} onSubmit={submit} noValidate>
<p className="h3">Tell us about your organisation</p>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "16px" }}>
<div className="field"><label className="label" htmlFor="c-name">Full name</label><div className="input"><input id="c-name" autoComplete="name" /></div></div>
<div className="field"><label className="label" htmlFor="c-role">Role</label><div className="input"><input id="c-role" autoComplete="organization-title" placeholder="e.g. CHRO" /></div></div>
</div>
<div className="field"><label className="label" htmlFor="c-email">Work email</label><div className={emailCls}><input id="c-email" type="email" autoComplete="email" value={email} onChange={setEmail} aria-invalid={emailInvalid} aria-describedby="c-email-err" /></div>{emailErr && (<><span className="err" id="c-email-err">Enter a work email address, for example name@company.com</span></>)}</div>
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: "16px" }}>
<div className="field"><label className="label" htmlFor="c-org">Organisation</label><div className="input"><input id="c-org" autoComplete="organization" /></div></div>
<div className="field"><label className="label" htmlFor="c-size">Headcount</label><div className="input"><select id="c-size"><option>Under 250</option><option>250 to 1,000</option><option>1,000 to 5,000</option><option>Over 5,000</option></select><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"></path></svg></div></div>
</div>
<fieldset style={{ border: "0", margin: "0", padding: "0", display: "flex", flexDirection: "column", gap: "10px" }}>
<legend className="label" style={{ marginBottom: "10px" }}>What prompted the question?</legend>
<div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
{needs.map((n: any, _i: number) => (<Fragment key={_i}><button type="button" className={n.cls} aria-pressed={n.on} onClick={n.toggle} style={{ cursor: "pointer", fontFamily: "inherit" }}>{n.label}</button></Fragment>))}
</div>
</fieldset>
<div className="field"><label className="label" htmlFor="c-msg">Anything else <span className="help">(optional)</span></label><textarea id="c-msg" rows={4} style={{ border: "1px solid #CFC6B9", borderRadius: "8px", padding: "12px 14px", font: "400 16px var(--font-inter), 'Roboto', 'Open Sans', sans-serif", resize: "vertical", background: "#fff" }}></textarea></div>
<label className="check"><input id="c-consent" type="checkbox" />I agree that PAC may contact me about this enquiry.</label>
<div aria-hidden="true" style={{ position: "absolute", left: "-9999px", height: "0", overflow: "hidden" }}><label htmlFor="c-web">Leave this empty</label><input id="c-web" tabIndex={-1} autoComplete="off" /></div>
{err && <p role="alert" className="small" style={{ color: "#B3261E", margin: "0", fontWeight: "600" }}>{err}</p>}
<button type="submit" className="btn btn-primary btn-lg btn-block" disabled={sending}>{sending ? "Sending..." : "Request a briefing"}</button>
<p className="caption">We use these details only to respond to your enquiry. See our <a href="/privacy">Privacy Policy</a>.</p>
</form>
</>)}
</div>
</div>
</section>
</main>
<SiteFooter />
</div>

    </>
  );
}
