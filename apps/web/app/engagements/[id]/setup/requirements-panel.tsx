import { requirements } from "@/lib/setup-output";
import { ORIENT_NAME, human, type Orientation } from "@/lib/format";

type Req = { requirement_id?: string; goal_type?: string; type: string; orientations: Orientation[]; thresholds: Record<string, string>; source_refs?: string[]; model?: string; model_transition?: boolean };
const names = (r: Req) => r.orientations.map((o) => `${ORIENT_NAME[o]} ${r.thresholds[o] ?? ""}`.trim()).join(", ");

// S1-08: what the rules derive from the agreed sections. The derivation is the engine's (lib/setup-output.ts); this only lays it out.
export default async function RequirementsPanel({ engagementId }: { engagementId: string }) {
  const r = await requirements(engagementId);
  const waiting = (["B", "C", "D"] as const).filter((s) => r.sections[s] !== "AGREED");
  const c1 = (r.c1 ?? []) as Req[], c4 = r.c4 as Req | null;
  return (
    <section className="scard" aria-label="Requirements derived from setup">
      <div className="scard-head"><div><h2>What the rules derive from setup</h2>
        <div className="ssmall smuted">Worked out by the rules engine from the agreed sections. Nothing here is typed in.</div></div></div>
      {!r.ready ? (
        <p className="ssmall">Agree Section{waiting.length > 1 ? "s" : ""} {waiting.join(", ")} first. The culture requirements for the strategy and the business model appear here once B, C and D are agreed.</p>
      ) : (
        <div className="tblwrap"><table className="tbl"><tbody>
          {c1.map((q, i) => (
            <tr key={q.requirement_id ?? i}><td style={{ width: 180 }}><strong>C1 requirement {i + 1}</strong></td>
              <td>{q.goal_type ? human(q.goal_type) : ""}: {human(q.type)} requirement, {names(q)} <span className="muted">(from {q.source_refs?.join(", ")})</span></td></tr>))}
          {c4 && <tr><td><strong>C4 business model</strong></td>
            <td>{c4.model ? human(c4.model) : ""}{c4.model_transition ? " (moving to another model, so balanced)" : ""}: {human(c4.type)} requirement, {names(c4)}</td></tr>}
          <tr><td><strong>Leadership target</strong></td>
            <td>{r.leadership_target_orientation ? <>{ORIENT_NAME[r.leadership_target_orientation as Orientation]} {r.leadership_target_basis === "AGREED" ? "" : <span className="tag warn">From the draft of Section F</span>}</>
              : r.tie.tied ? <span className="tag bad">Tie among the F1 tags</span> : <span className="muted">Needs the F1 behaviour tags in Section F.</span>}</td></tr>
          {r.tie.tied && <tr><td><strong>Tie break</strong></td>
            <td>The consultant chooses one of {r.tie.options.map((o) => ORIENT_NAME[o as Orientation]).join(", ")} and records the reason in Section F.</td></tr>}
          {!r.tie.tied && r.tie.tie_break && <tr><td><strong>Tie break</strong></td><td>{ORIENT_NAME[r.tie.tie_break]}{r.tie.reason ? `: ${r.tie.reason}` : ""}</td></tr>}
        </tbody></table></div>
      )}
    </section>
  );
}
