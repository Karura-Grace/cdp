"use client";
import { useState } from "react";
import { useCall } from "@/lib/use-call";



export type Field = { name: string; label: string; type?: "text" | "area" | "date" | "select" | "multi" | "check" | "lines"; options?: [string, string][]; required?: boolean; max?: number; wide?: boolean };

/** A small form that posts one record. "lines" turns one choice per line into a list; "multi" is a multiple choice list. */
export function RecordForm({ url, method = "POST", fields, button, done }: { url: string; method?: string; fields: Field[]; button: string; done: string }) {
  const { busy, run, note } = useCall();
  const [v, setV] = useState<Record<string, string | boolean | string[]>>({});
  const set = (k: string, x: string | boolean | string[]) => setV((o) => ({ ...o, [k]: x }));
  return (
    <form onSubmit={async (e) => {
      e.preventDefault();
      const body: Record<string, unknown> = {};
      for (const f of fields) { const x = v[f.name]; body[f.name] = f.type === "lines" ? String(x ?? "").split("\n").map((s) => s.trim()).filter(Boolean) : f.type === "check" ? x === true : (x ?? (f.type === "multi" ? [] : "")); }
      if (await run(url, method, body, done)) setV({});
    }} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap", marginTop: 10 }}>
      {fields.map((f) => (
        <label key={f.name} className="ssmall" style={{ flex: f.wide ? "1 1 100%" : "1 1 200px" }}>{f.label}<br />
          {f.type === "area" || f.type === "lines" ? <textarea rows={3} maxLength={f.max} required={f.required !== false} value={String(v[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} style={{ width: "100%" }} />
            : f.type === "select" ? <select required={f.required !== false} value={String(v[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} style={{ width: "100%" }}><option value="">Choose</option>{f.options!.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
            : f.type === "multi" ? <select multiple size={6} value={(v[f.name] as string[]) ?? []} onChange={(e) => set(f.name, [...e.target.selectedOptions].map((o) => o.value))} style={{ width: "100%" }}>{f.options!.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
            : f.type === "check" ? <input type="checkbox" checked={v[f.name] === true} onChange={(e) => set(f.name, e.target.checked)} />
            : <input type={f.type === "date" ? "date" : "text"} maxLength={f.max} required={f.required !== false} value={String(v[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} style={{ width: "100%" }} />}
        </label>))}
      <button className="sbtn orange" disabled={busy}>{button}</button>{note}
    </form>
  );
}

/** One button that calls the API, with an optional confirmation. */
export function Act({ url, method = "POST", body, label, done, confirmText, ghost = true }: { url: string; method?: string; body?: unknown; label: string; done: string; confirmText?: string; ghost?: boolean }) {
  const { busy, run, note } = useCall();
  return <span><button className={`sbtn ${ghost ? "ghost" : "orange"}`} disabled={busy} onClick={() => { if (!confirmText || confirm(confirmText)) void run(url, method, body ?? {}, done); }}>{label}</button> {note}</span>;
}

/** Close a data subject request as done or refused, with the required note. */
export function CloseRequest({ url }: { url: string }) {
  const { busy, run, note } = useCall();
  const [n, setN] = useState("");
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input aria-label="Closing note" placeholder="Closing note" value={n} maxLength={2000} onChange={(e) => setN(e.target.value)} style={{ width: 200 }} />
      <button className="sbtn orange" disabled={busy || !n.trim()} onClick={() => run(url, "PATCH", { status: "DONE", note: n }, "Closed.")}>Done</button>
      <button className="sbtn ghost" disabled={busy || !n.trim()} onClick={() => run(url, "PATCH", { status: "REFUSED", note: n }, "Closed.")}>Refuse</button>{note}
    </span>
  );
}
