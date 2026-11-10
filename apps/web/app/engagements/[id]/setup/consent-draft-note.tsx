import { WITHDRAW_DRAFT_NOTE, WITHDRAW_HEADING } from "@/lib/consent-template.mjs";

/** Staff only. Shown beside the consent text while it carries the right to withdraw paragraph, which is draft wording awaiting PAC legal review. */
export default function ConsentDraftNote({ body }: { body: string }) {
  if (!body.includes(WITHDRAW_HEADING)) return null;
  return <div className="note" role="note" style={{ marginBottom: 8 }}><b>DRAFT for legal review.</b> {WITHDRAW_DRAFT_NOTE}</div>;
}
