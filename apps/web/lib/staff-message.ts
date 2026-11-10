// Staff message templates (spec 1.4.4 I5) and the launch switch. Pure TypeScript with no imports, so the browser and the server share it.
//
// DRAFT WORDING. These two texts are drafted for the owner to review. Launch is blocked while a setup uses a template text and the owner
// has not approved it (a Super Admin sets the approval, see /v1/platform/staff-templates). Changing any wording below means changing
// STAFF_TEMPLATE_VERSION, which withdraws the approval until it is given again.

export const STAFF_TEMPLATE_VERSION = "draft-2";   // expanded wording, owner rounds Q-SM1 to Q-SM7 (23 and 24 Oct 2026)

/** Launch stays with the consultant for now (owner decision, October 2026). Set to true to require that a consultant approves
 *  the launch first (engagement.launch_approved_by and _at). The Client Admin launch step is not built; see the report. */
export const LAUNCH_NEEDS_SEPARATE_APPROVAL = false;

export type Anonymity = "FULL" | "CONFIDENTIAL_AGGREGATE";
/** sender: the CEO or MD who signs it; help: the client's contact. Both come from Setup Section A and are optional, with a safe fallback. */
export interface TemplateContext { org: string; purpose?: string | null; sender?: { name?: string | null; role?: string | null } | null; help?: { name?: string | null; email?: string | null } | null }

/** The PAC mailbox every message names beside the client's own contact (owner ruling 24 Oct 2026). */
export const PAC_HELP_EMAIL = "cdp@pac.africa";

const purposeLine = (purpose?: string | null) => purpose
  ? `The purpose of this survey is: ${purpose.trim().replace(/[.\s]+$/, "")}.`
  : "The purpose of this survey is to understand how things are done here today and how they need to be done in future.";

const COMMITMENT: Record<Anonymity, (org: string) => string> = {
  FULL: (org) =>
    `Your answers are anonymous. Your name and email address are never stored with your answers. The moment you submit, the link between you and your answers is destroyed and cannot be put back. Nobody at ${org} and nobody at Priority Activator Consulting can see what any one person answered. Results are shown only for groups of five or more people, so no one can be picked out of a small group.`,
  CONFIDENTIAL_AGGREGATE: (org) =>
    `Your answers are confidential. They are used only to produce combined results for groups, and individual answers are never shown to anyone at ${org}. When you submit, your personal link is separated from your answers. Results are shown only for groups of five or more people.`,
};

const helpLine = (h?: TemplateContext["help"]) => {
  const own = h?.email?.trim() ? `${h.name?.trim() ? h.name.trim() + " at " : ""}${h.email.trim()}` : "";
  return own ? `${own}, or write to Priority Activator Consulting at ${PAC_HELP_EMAIL}` : `Priority Activator Consulting at ${PAC_HELP_EMAIL}`;
};

/** The template text for one anonymity commitment. Paragraphs are separated by a blank line. Plain English, no dashes (client text rule). */
export function staffMessage(anonymity: Anonymity, ctx: TemplateContext): string {
  const who = ctx.sender?.name?.trim() ? [ctx.sender.name.trim(), [ctx.sender.role?.trim(), ctx.org].filter(Boolean).join(", ")].join("\n") : `Leadership of ${ctx.org}`;
  return [
    "Dear colleagues,",
    `We are asking every one of you to take part in a short survey about how work really gets done at ${ctx.org}, and how you would like it to be. I am asking you personally, because the answers will shape the decisions we make about how we lead and how we work. ${purposeLine(ctx.purpose)}`,
    "We have asked Priority Activator Consulting (PAC Africa) to run it for us. PAC is independent of our management, and it is PAC, not us, that handles your answers.",
    `What it asks. The survey takes about 40 minutes. You can stop and come back to it later using the same link. There are no right or wrong answers. We want what you see and what you would like, not what you think we want to hear. If something is unclear, or the link does not work, contact ${helpLine(ctx.help)}.`,
    COMMITMENT[anonymity](ctx.org),
    "How the results will be used. They will guide how we lead and how we work. They will never be used to assess, promote, reward or discipline any individual.",
    "Your link is yours alone. It is personal and works only once. Please do not forward it or share it. If you think someone else has opened it, tell us and a new one will be issued.",
    "It is your choice. Taking part is voluntary. If you do not want to be surveyed, you can tell us at any time through the Your rights page on the survey, and your link will stop working at once. Nothing will be held against you.",
    "What happens next: when the survey closes, PAC prepares a report of combined results. We will share what we learn with you, and tell you what we are going to do about it.",
    "Thank you for your honesty. It is the only way this works.",
    who,
  ].join("\n\n");
}

/** Which template (if any) a message is, word for word. A message the consultant edited is their own text and returns null. */
export function templateInUse(message: unknown, ctx: TemplateContext): Anonymity | null {
  if (typeof message !== "string") return null;
  const m = message.trim().replace(/\r\n/g, "\n");
  for (const a of ["FULL", "CONFIDENTIAL_AGGREGATE"] as const) if (m === staffMessage(a, ctx)) return a;
  return null;
}
