// Half-circle gauge for a 1 to 5 readiness score, in the console's .cds-gauge layout. Server-rendered SVG.
export function Gauge({ value, label, band, why, color = "#eb5733" }: { value: string | null; label: string; band?: string; why: string; color?: string }) {
  const v = value === null ? 0 : Math.max(0, Math.min(5, parseFloat(value)));   // geometry only; the printed number is the engine string
  const R = 80, C = Math.PI * R;
  return (
    <div className="cds-gauge">
      <div className="cds-gwrap">
        <svg viewBox="0 0 200 110" style={{ width: "100%", height: "100%" }} role="img" aria-label={`${label}: ${value ?? "n/a"} out of 5`}>
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#eef0f2" strokeWidth="16" strokeLinecap="round" />
          <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(v / 5) * C} ${C}`} />
        </svg>
        <div className="cds-gval">{value ?? "n/a"}</div>
      </div>
      <div className="cds-glabel">{label}</div>
      {band && <div className="small muted">{band}</div>}
      <p className="tiny muted" style={{ marginTop: 4 }}>{why}</p>
    </div>
  );
}
