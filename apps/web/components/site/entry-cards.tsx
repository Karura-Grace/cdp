"use client";

import { useState } from "react";

// The three ways in from the home page: a survey link, a Leadership 360 link, or staff sign in.
// Accepts the whole link from the email or just the code. The code goes into the URL hash, which never reaches a server.
function Entry({ title, text, label, path, button }: { title: string; text: string; label: string; path: "/respond" | "/respond360"; button: string }) {
  const [v, setV] = useState("");
  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const s = v.trim();
    if (!s) return;
    const code = s.includes("#") ? s.slice(s.indexOf("#") + 1) : s;
    const to = s.includes("/respond360") ? "/respond360" : s.includes("/respond") ? "/respond" : path;
    window.location.href = `${to}#${code}`;
  };
  return (
    <form className="card" onSubmit={go} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <p className="h3">{title}</p>
      <p className="small">{text}</p>
      <label className="small" style={{ fontWeight: 600, marginTop: "auto" }}>{label}
        <input value={v} onChange={(e) => setV(e.target.value)} autoComplete="off" spellCheck={false} placeholder="Paste the link from your email"
          style={{ display: "block", width: "100%", marginTop: "6px", height: "44px", padding: "0 12px", border: "1px solid #D9D2C6", borderRadius: "10px", font: "inherit", background: "#fff" }} />
      </label>
      <button className="btn btn-primary" type="submit" style={{ alignSelf: "flex-start" }}>{button}</button>
    </form>
  );
}

export default function EntryCards() {
  return (
    <div className="grid-3" style={{ alignItems: "stretch" }}>
      <Entry title="Take the CDP assessment" text="Use the personal link your organisation sent you. You can stop and come back to it on the same device." label="Survey link or code" path="/respond" button="Begin or resume" />
      <Entry title="Leadership 360" text="Rate a leader, or complete your own self evaluation, with the link you received." label="360 link or code" path="/respond360" button="Open the questionnaire" />
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <p className="h3">Consultants and clients</p>
        <p className="small">Set up the engagement, issue survey links, follow completion, and read the released reports and action plan.</p>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "auto" }}><a className="btn btn-secondary" href="/login">Sign in</a><a className="btn btn-secondary" rel="nofollow" href="/login?email=demo%40cdp-demo.example&next=%2Fdashboard">Explore the live demo</a></div>
      </div>
    </div>
  );
}
