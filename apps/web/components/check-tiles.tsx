import type { Tile } from "@/lib/findings-view";
import { human } from "@/lib/format";

const tone = (v: string) => (v === "HIT" ? "ok" : v === "MISS" || v === "SYSTEMIC_MISS" ? "bad" : "warn");

// The alignment scorecard: C1 to C4 as four tiles, each with the verdict word, the percentage or rank, and the decisive override in plain words.
export function CheckTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="cds-card"><div className="cds-gauges" role="list">
      {tiles.map((t) => (
        <div key={t.key} role="listitem" style={{ flex: "1 1 220px", minWidth: 200 }}>
          <div className="small muted">{t.key} · {t.name}</div>
          <div style={{ margin: "4px 0" }}><span className={`tag ${tone(t.verdict)}`}>{human(t.verdict)}</span></div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t.figure}</div>
          {t.why && <p className="small" style={{ marginTop: 4 }}>{t.why}</p>}
        </div>
      ))}
    </div></div>
  );
}
