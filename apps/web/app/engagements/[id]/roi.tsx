"use client";

import { useState } from "react";

// Consultant tool for the debrief, from the PAC reference platform: the annual value of closing the culture gaps, from editable
// assumptions. Runs in the browser only; nothing is stored and it never appears in a report. An estimate, not a forecast.
const FIELDS = [
  ["headcount", "Headcount", ""], ["salary", "Average annual salary", "in the currency shown"], ["attrition", "Voluntary attrition (%)", ""],
  ["reduction", "Attrition reduction (%)", "share of current exits avoided; reference default 40"],
  ["productivity", "Productivity gain (%)", "output gain on payroll; reference default 15"], ["engagement", "Engagement improvement (%)", "weighted 30% to payroll; reference default 20"],
] as const;
type Key = (typeof FIELDS)[number][0];

export default function Roi({ headcount, attrition, currency = "USD" }: { headcount: number | null; attrition: number | null; currency?: string }) {
  const [v, setV] = useState<Record<Key, string>>({ headcount: String(headcount ?? 50), salary: "1200000", attrition: String(attrition ?? 15), reduction: "40", productivity: "15", engagement: "20" });
  const n = (k: Key) => Math.max(0, Number(v[k]) || 0);
  const pay = n("headcount") * n("salary");
  const exits = n("headcount") * (n("attrition") / 100) * (n("reduction") / 100) * n("salary") * 0.75;   // replacement cost: 75% of salary
  const prod = pay * (n("productivity") / 100), eng = pay * (n("engagement") / 100) * 0.3;
  const fmt = (x: number) => `${currency} ${x >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : `${Math.round(x / 1000)}K`}`;
  return (
    <details className="scard">
      <summary style={{ cursor: "pointer" }}><b>Value at stake</b> <span className="ssmall smuted">Consultant tool for the debrief. Estimate only; not stored, not in any report.</span></summary>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
        {FIELDS.map(([k, label, hint]) => (
          <label key={k} className="ssmall" style={{ fontWeight: 600 }}>{label}{hint && <span className="smuted" style={{ fontWeight: 400 }}> ({hint})</span>}
            <input type="number" min={0} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} style={{ display: "block", width: "100%", marginTop: 4, height: 38, padding: "0 10px", border: "1px solid var(--line-2)", borderRadius: 8 }} />
          </label>))}
      </div>
      <div className="stf-kpis" style={{ marginTop: 14 }}>
        <div className="stf-kpi"><div className="l">Annual value at stake</div><div className="v">{fmt(exits + prod + eng)}</div><div className="n">sum of the three below</div></div>
        <div className="stf-kpi"><div className="l">Fewer exits</div><div className="v">{fmt(exits)}</div><div className="n">replacement cost at 75% of salary</div></div>
        <div className="stf-kpi"><div className="l">Productivity</div><div className="v">{fmt(prod)}</div><div className="n">gain on payroll</div></div>
        <div className="stf-kpi"><div className="l">Engagement</div><div className="v">{fmt(eng)}</div><div className="n">30% linked to payroll</div></div>
      </div>
      <p className="ssmall smuted">Indicative planning figures from editable assumptions; check them with the client&apos;s finance team before quoting.</p>
    </details>
  );
}
