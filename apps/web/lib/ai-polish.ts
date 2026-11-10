// AI polish of one report chapter (owner Q-AL26, Q-AL30, Q-AL39, Q-AL41; plain chat 1 Nov 2026). The model only rewrites what the
// system already wrote for the chapter into a short reading for leaders: it gets the chapter's own text (built from the frozen score),
// never responses, names or IDs. The draft is screened by the engine guardrails (every number must already be in the score or the
// chapter, no deny listed term, no causal claim, no group below the floor) and stored as a proposal the consultant accepts or drops.
// Spend is logged per call in ai_usage and the call is refused once this month's estimate reaches the cap in config.
import Anthropic from "@anthropic-ai/sdk";
import * as E from "@pac/cdp-engine";
import { admin } from "./supabase/admin";
import type { Chapter } from "./export/full-model";

// Prompt version 2 (owner Q-D9-3, Q-D9-15, 5 Nov 2026): the template report opens every chapter with a headline finding and closes
// its first page with one "So what" (no "In short" paragraphs). The model writes those two lines from the chapter text; the
// consultant accepts them; the rule written lines stay as the fallback.
export const PROMPT_VERSION = "headline-v2";
const SYSTEM = `You write the two key lines of one chapter of an organisational culture report for the organisation's leaders.
Use only the facts and numbers in the chapter text you are given. Never add a number, a percentage, a name, a benchmark or a research claim that is not in that text.
Line 1 starts "HEADLINE: " and states the chapter's main finding in one sentence of at most 30 words, with at least one number from the text. Lead with this organisation's own result (a verdict, a score, a gap or a count), never with what the chapter measures, how a measure works, its definition or its thresholds.
Line 2 starts "SO WHAT: " and says in one or two sentences, at most 40 words in all, what the finding means for the organisation and where to start, citing at least one number from the text.
Write associations, not causes: say "goes with" or "sits alongside", never "causes", "leads to", "drives" or "because of".
House style: plain British English; no dashes and no hyphenated words; write "Now" for the current culture, never "today"; orientation names in normal case (Engage, Innovate, Perform, Govern); copy every number exactly as it is written in the text, with all its decimal places (write 10.15, never 10.2; never round); keep the minus sign of a negative number (Perform -10.15) and never restate it as a positive number; where the text gives a number with two decimals and with one, use the two decimal one.
If the text says something is not built or not yet available, do not report that as the finding; report the results that are there.
Return only the two lines.`;

/** The chapter as plain text: the words and numbers the system already put on its pages. */
export function chapterText(c: Chapter): string {
  const out: string[] = [`${c.title}. ${c.lead}`];
  for (const b of c.blocks) {
    if ("p" in b) out.push(b.p);
    else if ("h3" in b) out.push(`\n${b.h3}`);
    else if ("bullets" in b) out.push(...b.bullets.map((x) => `- ${x}`));
    else if ("callout" in b) out.push(b.callout);
    else if ("box" in b) out.push(`${b.box.label}: ${b.box.text}`);
    else if ("table" in b) out.push([b.table.head.join(" | "), ...b.table.rows.map((r) => r.join(" | "))].join("\n"));
    else if ("glance" in b) out.push(...b.glance);
    else if ("fig" in b && b.text) out.push(...b.text);
    else if ("dept" in b) out.push(`${b.dept.title}: ${b.dept.text}`);
    else if ("actions" in b) out.push(...b.actions.map((z) => `- ${z.text} (${z.owner}, ${z.when})`));
    // the result blocks: without them the model sees only definitions and invents (owner review of DRAFT9 drafts, 5 Nov 2026)
    else if ("check" in b) out.push(`${b.check.code} ${b.check.name}: ${b.check.word}. ${b.check.result.join(" ")}${b.check.risk ? ` Risk if not addressed: ${b.check.risk}` : ""} Action: ${b.check.action}`);
    else if ("pills" in b) out.push(b.pills.map((p) => `${p.name}: ${p.word}`).join("; "));
    else if ("tiles" in b) out.push(...b.tiles.map((t) => `${t.label}: ${t.value} (${t.note})`));
    else if ("cards" in b) out.push(...b.cards.map(([l, v, n]) => `${l}: ${v} ${n}`));
    else if ("big3" in b) out.push(...b.big3.map((z) => `${z.kind} ${z.title}: ${z.text} ${z.figure}`));
    else if ("gauges" in b) out.push(...b.gauges.map((g) => `${g.label}: ${g.value ?? "n/a"} out of ${g.max}, ${g.band}`));
    else if ("hbars" in b) out.push(`${b.hbars.title}: ${b.hbars.rows.map((r) => `${r.label} ${r.shown}`).join("; ")}`);
    else if ("meters" in b) out.push(...b.meters.map((z) => `${z.label}: ${z.shown}, target ${z.targetText}`));
    else if ("chips" in b) out.push(b.chips.map((c) => c.label).join("; "));
  }
  return out.join("\n");
}

/** This calendar month's estimated spend, in US dollars, as a Decimal string. */
async function monthSpend(): Promise<E.Decimal> {
  const from = new Date(); from.setUTCDate(1); from.setUTCHours(0, 0, 0, 0);
  const { data } = await admin().from("ai_usage").select("cost_usd").gte("created_at", from.toISOString());
  return (data ?? []).reduce((s, r) => s.plus(E.D(String(r.cost_usd))), E.D(0));
}

export type PolishResult =
  | { ok: true; text: string; model: string; cost_usd: string; month_usd: string }
  | { ok: false; code: "AI_BUDGET" | "AI_SCREEN" | "AI_EMPTY"; detail: string[] };

export async function polishChapter(o: { reportId: string; tenantId: string; actorId: string; chapter: Chapter; payload: unknown; smallGroups: string[]; model?: string }): Promise<PolishResult> {
  const models = E.config.get("ai.models") as Record<string, readonly [E.Decimal, E.Decimal]>;
  const model = o.model && models[o.model] ? o.model : E.config.get("ai.model");
  const cap = E.config.get("ai.monthly_cap_usd");
  const spent = await monthSpend();
  if (spent.gte(cap)) return { ok: false, code: "AI_BUDGET", detail: [`This month's AI spend (${spent.toFixed(2)} US dollars) has reached the cap of ${cap.toString()}.`] };

  const source = chapterText(o.chapter);
  const client = new Anthropic();
  const msg = await client.messages.create({
    model, max_tokens: 4000, system: SYSTEM,
    output_config: { effort: E.config.get("ai.effort") as "low" | "medium" },
    messages: [{ role: "user", content: source }],
  });
  const [pin, pout] = models[model];
  const cost = E.D(msg.usage.input_tokens).times(pin).plus(E.D(msg.usage.output_tokens).times(pout)).div(1_000_000);
  const log = await admin().from("ai_usage").insert({ report_id: o.reportId, tenant_id: o.tenantId, chapter: o.chapter.key, model, effort: E.config.get("ai.effort"),
    input_tokens: msg.usage.input_tokens, output_tokens: msg.usage.output_tokens, cost_usd: Number(cost.toFixed(6)), created_by: o.actorId });   // the column type is numeric; the client types it as number
  if (log.error) throw new Error(log.error.message);

  const text = msg.stop_reason === "refusal" ? "" : msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
  if (!text) return { ok: false, code: "AI_EMPTY", detail: [`The model returned no text (${msg.stop_reason}).`] };
  // numbers may come from the frozen score or from the chapter the system wrote from it; the chapter is the draft's one source
  const allowed = new Set([...E.payloadNumbers(o.payload), ...E.payloadNumbers(source)]);
  const cite = `chapter:${o.chapter.key}`;
  const screen = E.screenSection({ text, cites: [cite] }, { allowedNumbers: allowed, findingIds: new Set([cite]), denyList: (process.env.CDP_DENY_LIST ?? "").split("\n").filter(Boolean), smallGroupNames: o.smallGroups });
  if (!screen.ok) return { ok: false, code: "AI_SCREEN", detail: screen.blocked };
  return { ok: true, text, model, cost_usd: cost.toFixed(4), month_usd: spent.plus(cost).toFixed(2) };
}
