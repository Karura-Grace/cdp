"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

const post = async (url: string) => {
  const r = await api("POST", url, {});
  return r.ok ? null : ((await r.json().catch(() => null))?.title ?? "That did not work.");
};

// Run the score, then freeze it. Freeze shows what will be frozen first: the version, the hash and the pinned versions.
export default function ScoreActions({ assessmentId, version, hash, frozen, instrument, rules, canRun, canFreeze }: {
  assessmentId: string; version: number | null; hash: string | null; frozen: boolean; instrument: string; rules: string; canRun: boolean; canFreeze: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const act = async (path: string, ok: string) => {
    setBusy(true); setMsg(null);
    const e = await post(`/v1/assessments/${assessmentId}/${path}`);
    setBusy(false); setConfirm(false);
    setMsg(e ? { ok: false, text: e } : { ok: true, text: ok });
    if (!e) router.refresh();
  };
  return (
    <div className="cds-card">
      {msg && <div className="cds-explain" role={msg.ok ? "status" : "alert"}>{msg.text}</div>}
      {frozen ? <p className="cds-sub">Version {version} is frozen. A later change creates a new version, never an edit.</p> : (
        <div className="cds-toolbar" style={{ flexWrap: "wrap" }}>
          {canRun && <button className="sbtn ghost" type="button" disabled={busy} onClick={() => act("score", "Score run. Check the figures below.")}>{version ? "Run the score again" : "Run the score"}</button>}
          {canFreeze && version && !confirm && <button className="sbtn" type="button" disabled={busy} onClick={() => setConfirm(true)}>Freeze score</button>}
        </div>
      )}
      {confirm && version && hash && (
        <div className="cds-explain" role="alertdialog" aria-label="Confirm freeze">
          <p><strong>You are about to freeze this score. It cannot be undone.</strong></p>
          <p className="ssmall">Score version {version}<br />Hash <code>{hash}</code><br />Instrument version {instrument}<br />Rules version {rules}</p>
          <div className="cds-toolbar"><button className="sbtn" type="button" disabled={busy} onClick={() => act("score/freeze", `Score version ${version} frozen.`)}>Freeze version {version}</button>
            <button className="sbtn ghost" type="button" onClick={() => setConfirm(false)}>Cancel</button></div>
        </div>
      )}
    </div>
  );
}
