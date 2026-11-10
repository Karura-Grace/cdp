"use client";

import { useId, useMemo, useState } from "react";
import { DEFAULTS, SECTIONS, SECTION_TITLES, finalise, validateSection, type Field, type Json, type Leaf } from "@/lib/setup-sections";

const human = (s: string) => s.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);
type ItemOf = Leaf | { t: "group"; fields: Field[] };

export interface SaveResult { warnings: string[]; missing: string[]; reopened: string[] }

// Renders one section from the shared schema. Only the section's own fields are sent; the server cleans and checks them again.
export interface ExecPerson { person_id: string; label: string }
const PERSON_ID = /^per_[0-9a-f]{16}$/;

export interface Facilitator { user_id: string; name: string }

export default function SectionForm({ section, initial, workshopDate, participants, facilitatorUserId, facilitators = [], execPeople = [], perspective = false, kpis, tenant, busy, onSave, onCancel }: {
  section: string; initial: Json | null; workshopDate: string | null; participants: string[]; facilitatorUserId?: string | null; facilitators?: Facilitator[]; execPeople?: ExecPerson[]; perspective?: boolean; kpis: Json[]; tenant: { name: string; sector: string | null; headcount: number | null; geographies: string[] };
  busy: boolean; onSave: (body: { payload: Json; workshop_date: string | null; participants: string[]; facilitator_user_id: string | null }) => Promise<SaveResult | null>; onCancel: () => void;
}) {
  // the tie break and the wording choices belong to the agreed record, so a perspective entry does not offer them (same list as lib/setup-compare.ts)
  const fields = SECTIONS[section].filter((f) => !perspective || !["tie_break", "tie_break_reason", "f1_overrides"].includes(f.key));
  const [v, setV] = useState<Json>(() => ({ ...(DEFAULTS[section] ?? {}), ...(initial ?? {}) }));
  const [date, setDate] = useState(workshopDate ?? "");
  const [picked, setPicked] = useState<string[]>(participants.filter((p) => PERSON_ID.test(p)));
  const [fac, setFac] = useState(facilitatorUserId ?? "");
  const [result, setResult] = useState<SaveResult | null>(null);
  const uid = useId();

  const targets = useMemo(() => (v.targets as Json[] | undefined) ?? [], [v.targets]);
  const local = useMemo(() => validateSection(section, finalise(section, v), { complete: true, ctx: { today: today(), kpis } }), [section, v, kpis]);
  const set = (key: string, val: unknown) => setV((p) => ({ ...p, [key]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const r = await onSave({ payload: v, workshop_date: date || null, participants: picked, facilitator_user_id: fac || null });
    if (r) setResult(r);
  }

  return (
    <form className="addbox" onSubmit={save} aria-label={`Section ${section}`}>
      <h3 style={{ marginBottom: 4 }}>Section {section}: {SECTION_TITLES[section]}</h3>
      {section === "A" && (
        <p className="small muted" style={{ marginBottom: 10 }}>
          A1 to A4 come from the organisation record: {tenant.name}{tenant.sector ? `, ${tenant.sector}` : ""}{tenant.headcount ? `, ${tenant.headcount} staff` : ""}{tenant.geographies.length ? `, ${tenant.geographies.join(", ")}` : ""}. The Client Admin or the Super Admin changes them on the organisation record, not here.
        </p>
      )}
      {!perspective && (
      <fieldset style={{ border: 0, padding: 0, margin: "0 0 14px" }}>
        <legend className="flab" style={{ marginBottom: 6 }}>Workshop record (needed to agree this section)</legend>
        <div className="formgrid">
          <div className="field"><label className="flab" htmlFor={`${uid}-d`}>Workshop date</label><input id={`${uid}-d`} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label className="flab" htmlFor={`${uid}-f`}>Facilitating consultant</label>
            <select id={`${uid}-f`} value={fac} onChange={(e) => setFac(e.target.value)}><option value="">Record myself</option>{facilitators.map((f) => <option key={f.user_id} value={f.user_id}>{f.name}</option>)}</select></div>
        </div>
        <div className="field" style={{ marginTop: 10 }}>
          <span className="flab">Executives present (at least two)</span>
          {execPeople.length ? (
            <div style={{ display: "grid", gap: 4, maxHeight: 180, overflow: "auto", padding: "4px 0" }}>
              {execPeople.map((p) => (
                <label key={p.person_id} style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                  <input type="checkbox" checked={picked.includes(p.person_id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.person_id] : x.filter((y) => y !== p.person_id)))} />{p.label}
                </label>))}
            </div>
          ) : <div className="small muted">No one in an executive grade is on the organisation record yet. Load the organisation and mark the executive grades first.</div>}
          <div className="small muted" style={{ marginTop: 4 }}>Only people in an executive grade count. Typed names do not count.</div>
          {participants.some((p) => !PERSON_ID.test(p)) && (
            <div className="note" role="note" style={{ marginTop: 6 }}>This record still has typed names from before ({participants.filter((p) => !PERSON_ID.test(p)).join(", ")}). They no longer count: tick the same people in the list above and save.</div>
          )}
        </div>
      </fieldset>
      )}

      {fields.map((f) => f.t === "targets" ? (
        <TargetsField key={f.key} f={f} kpis={kpis} rows={targets} onChange={(rows) => set("targets", rows)} />
      ) : (
        <FieldView key={f.key} f={f} value={v[f.key]} onChange={(x) => set(f.key, x)} id={`${uid}-${f.key}`} />
      ))}

      {section === "F" && !perspective && (
        <p className="small muted">If two orientations tie among the F1 tags, set the tie-break and write the reason above before agreeing.</p>
      )}

      {local.length > 0 && (
        <div className="note" style={{ marginTop: 12 }}>
          <b>Still needed before this section can be agreed ({local.length}):</b>
          <ul style={{ margin: "6px 0 0 18px" }}>{local.slice(0, 12).map((m) => <li key={m}>{m}</li>)}{local.length > 12 && <li>and {local.length - 12} more</li>}</ul>
        </div>
      )}
      {result?.reopened.length ? <div className="note" role="status"><b>Section {result.reopened.join(", ")} was agreed against the old KPIs and is back to Draft.</b></div> : null}
      {result?.warnings.length ? <div className="note" role="status"><b>Wording:</b><ul style={{ margin: "6px 0 0 18px" }}>{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul><span className="small">These are warnings. You can still agree the section.</span></div> : null}

      <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn gold sm" disabled={busy}>{busy ? "Saving…" : "Save draft"}</button>
        <button type="button" className="btn ghost sm" onClick={onCancel}>Close</button>
        <span className="small muted">Saving returns the section to Draft. Agree it from the table when it is complete.</span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- field renderers

function Label({ f, id }: { f: Field; id: string }) {
  return <label className="flab" htmlFor={id}>{f.label}{f.req ? <span aria-hidden="true" style={{ color: "var(--o)" }}> *</span> : null}</label>;
}

function LeafInput({ f, value, onChange, id, label }: { f: Leaf; value: unknown; onChange: (x: unknown) => void; id: string; label?: string }) {
  const aria = label ? { "aria-label": label } : {};
  switch (f.t) {
    case "text": return f.rows && f.rows > 1
      ? <><textarea id={id} rows={f.rows} maxLength={f.max} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} {...aria} /><div className="small muted" style={{ textAlign: "right" }}>{((value as string) ?? "").length} / {f.max}</div></>
      : <input id={id} maxLength={f.max} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} {...aria} />;
    case "enum": return <select id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || undefined)} {...aria}><option value="">Choose…</option>{f.options.map((o) => <option key={o} value={o}>{human(o)}</option>)}</select>;
    case "multi": {
      const cur = (value as string[] | undefined) ?? [];
      return <div role="group" aria-labelledby={id} style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {f.options.map((o) => <label key={o} style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="checkbox" checked={cur.includes(o)} onChange={(e) => onChange(e.target.checked ? [...cur, o] : cur.filter((x) => x !== o))} />{o === "en" ? "English" : human(o)}</label>)}
      </div>;
    }
    case "date": return <input id={id} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value || undefined)} {...aria} />;
    case "num": return <input id={id} type="number" inputMode="decimal" step={f.int ? 1 : "any"} min={f.min} max={f.max} value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} {...aria} />;
    case "bool": return <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}><input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} {...aria} />Yes</label>;
  }
}

function FieldView({ f, value, onChange, id }: { f: Field; value: unknown; onChange: (x: unknown) => void; id: string }) {
  if (f.t === "targets" || f.t === "group") return null;
  if (f.t === "list") return <ListField f={f} value={value as unknown[] | undefined} onChange={onChange} id={id} />;
  return (
    <div className="field" style={{ marginTop: 10 }}>
      {f.t === "multi" ? <span className="flab" id={id}>{f.label}{f.req ? <span aria-hidden="true" style={{ color: "var(--o)" }}> *</span> : null}</span> : <Label f={f} id={id} />}
      <LeafInput f={f} value={value} onChange={onChange} id={id} />
      {f.hint && <div className="small muted" style={{ marginTop: 4 }}>{f.hint}</div>}
    </div>
  );
}

const blank = (of: ItemOf) => (of.t === "group" ? {} : "");

function ListField({ f, value, onChange, id }: { f: Extract<Field, { t: "list" }>; value: unknown[] | undefined; onChange: (x: unknown) => void; id: string }) {
  // always show at least `min` rows (or one) so the section reads as a form to fill in
  const rows = value && value.length ? value : Array.from({ length: Math.max(f.min, f.max > 0 ? 1 : 0) }, () => blank(f.of));
  const put = (i: number, x: unknown) => onChange(rows.map((r, j) => (j === i ? x : r)));
  const rowsView = rows.map((r, i) => {
    const l = `${f.label} ${i + 1}`;
    return (
      <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
        <span className="small muted" style={{ width: 22, paddingTop: 11 }}>{i + 1}.</span>
        <div style={{ flex: 1 }}>
          {f.of.t === "group" ? (
            <div className="formgrid">
              {f.of.fields.map((g) => (
                <div className="field" key={g.key}>
                  <label className="flab" htmlFor={`${id}-${i}-${g.key}`}>{g.label}</label>
                  {g.t !== "group" && g.t !== "list" && g.t !== "targets" && <LeafInput f={g} value={((r as Json) ?? {})[g.key]} id={`${id}-${i}-${g.key}`} onChange={(x) => put(i, { ...(r as Json), [g.key]: x })} />}
                </div>
              ))}
            </div>
          ) : <LeafInput f={f.of} value={r} id={`${id}-${i}`} label={l} onChange={(x) => put(i, x)} />}
        </div>
        {rows.length > f.min && <button type="button" className="btn ghost sm" aria-label={`Remove ${l}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove</button>}
      </div>
    );
  });
  return (
    <div className="field" style={{ marginTop: 14 }}>
      <span className="flab">{f.label}{f.req ? <span aria-hidden="true" style={{ color: "var(--o)" }}> *</span> : null} <span className="small muted" style={{ fontWeight: 400 }}>{f.min === f.max ? `${f.max} entries` : `${f.min} to ${f.max}`}</span></span>
      {f.hint && <div className="small muted" style={{ marginBottom: 6 }}>{f.hint}</div>}
      {rowsView}
      {rows.length < f.max && <button type="button" className="btn ghost sm" onClick={() => onChange([...rows, blank(f.of)])}>{f.addLabel ?? "Add"}</button>}
    </div>
  );
}

// Section D: one row per Section C KPI, with its baseline and direction beside it.
function TargetsField({ f, kpis, rows, onChange }: { f: Field; kpis: Json[]; rows: Json[]; onChange: (r: Json[]) => void }) {
  if (!kpis.length) return <div className="note" style={{ marginTop: 10 }}><b>{f.label}</b><br />Save Section C first. Targets are set for each KPI listed there.</div>;
  const row = (id: string) => rows.find((r) => r.kpi_id === id) ?? { kpi_id: id };
  const put = (id: string, key: string, x: number | undefined) => onChange(kpis.map((k) => { const r = row(k.id as string); return k.id === id ? { ...r, [key]: x } : r; }));
  return (
    <div className="field" style={{ marginTop: 14 }}>
      <span className="flab">{f.label} <span aria-hidden="true" style={{ color: "var(--o)" }}>*</span></span>
      <div className="small muted" style={{ marginBottom: 6 }}>The 12-month target is required. A target must move from the baseline in the KPI&rsquo;s direction.</div>
      <div className="tblwrap"><table className="tbl">
        <thead><tr><th>KPI</th><th>Baseline</th><th>12-month target</th><th>3-year target</th></tr></thead>
        <tbody>{kpis.map((k) => {
          const r = row(k.id as string);
          return (
            <tr key={k.id as string}>
              <td><strong>{k.name as string}</strong><div className="small muted">{human(String(k.direction))}</div></td>
              <td>{String(k.baseline_value)}</td>
              <td><input type="number" step="any" aria-label={`12-month target for ${k.name}`} value={typeof r.target_12m === "number" ? r.target_12m : ""} onChange={(e) => put(k.id as string, "target_12m", e.target.value === "" ? undefined : Number(e.target.value))} /></td>
              <td><input type="number" step="any" aria-label={`3-year target for ${k.name}`} value={typeof r.target_3y === "number" ? r.target_3y : ""} onChange={(e) => put(k.id as string, "target_3y", e.target.value === "" ? undefined : Number(e.target.value))} /></td>
            </tr>
          );
        })}</tbody>
      </table></div>
    </div>
  );
}
