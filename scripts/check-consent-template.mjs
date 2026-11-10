// Consent template content checks (spec Table 19, S1.4.5): purpose, data categories, retention, recipients, unlinking statement, rights. No server needed.
//   node scripts/check-consent-template.mjs
import { readFileSync } from "node:fs";
import { consentText, purposeSentence, consentPurposeGap, WITHDRAW_HEADING, WITHDRAW_DRAFT_NOTE } from "../apps/web/lib/consent-template.mjs";
import { ok, done } from "./lib/e2e.mjs";

const base = consentText({ orgName: "Acme", privacyRegime: "KE_DPA_2019" });
ok("without a stored purpose the standard purpose wording is used", base.body.includes(purposeSentence(null)));
const p = "Find where culture blocks the growth plan.";
const t = consentText({ orgName: "Acme", privacyRegime: "KE_DPA_2019", purpose: p });
ok("the stored purpose is copied into the consent text", t.body.includes("The purpose of this assessment is: Find where culture blocks the growth plan."), t.body.slice(0, 300));
ok("a trailing full stop or spaces in the purpose do not double up", !consentText({ orgName: "A", privacyRegime: "KE_DPA_2019", purpose: "Why.  " }).body.includes(".."));
ok("the standard purpose sentence is replaced, not repeated", !t.body.includes(purposeSentence(null)));
ok("data categories are stated", /What we collect/.test(t.body) && /typed comments/.test(t.body));
ok("recipients are stated", /Who sees it/.test(t.body));
ok("retention is stated (24 months)", /24 months/.test(t.body));
ok("the unlinking statement is present (cannot be individually found, retrieved or deleted)", /cannot be individually found, retrieved or deleted/.test(t.body));
ok("rights are named under the tenant's law", /Kenya Data Protection Act, 2019/.test(t.body) && /access to, correction of and objection/.test(t.body));
ok("voluntary, no consequence and stop at any time", /voluntary/.test(t.body) && /stop at any time/.test(t.body));

// right to withdraw (owner decision of 18 October 2026): explicit wording, plain English, before submit, with the one limit after submit
const paras = t.body.split("\n\n"), w = paras.find((p) => p.startsWith(WITHDRAW_HEADING)) ?? "";
ok("a paragraph states the right to withdraw consent", w.includes("withdraw your consent at any time before you submit"), w);
ok("it says how: close the page, press I do not agree, or write to hello@pac.africa", /close this page/.test(w) && /I do not agree/.test(w) && /hello@pac\.africa/.test(w));
ok("it says withdrawing has no consequence, and names the limit after submit", /no consequence for you/.test(w) && /cannot be taken back or removed/.test(w));
ok("the withdraw paragraph sits before the rights paragraph and is in every regime's text", paras.indexOf(w) === paras.length - 2 && ["UG_DPPA_2019", "RW_DPP_2021", "TZ_PDPA_2022", "NG_NDPA_2023", "GH_DPA_2012", "OTHER:Test law"].every((r) => consentText({ orgName: "A", privacyRegime: r }).body.includes(WITHDRAW_HEADING)));
ok("the withdraw wording has no dashes (house style)", !/[\u2013\u2014]| - /.test(w));
ok("the DRAFT note for the staff screen says it is draft wording for legal review", /DRAFT/.test(WITHDRAW_DRAFT_NOTE) && /legal review/.test(WITHDRAW_DRAFT_NOTE));
const src = (f) => readFileSync(new URL("../apps/web/" + f, import.meta.url), "utf8");
ok("source: the staff consent screen shows the DRAFT note when the text carries the withdraw paragraph", /ConsentDraftNote body=\{consent\.body\}/.test(src("app/engagements/[id]/setup/setup-client.tsx")) && /DRAFT for legal review/.test(src("app/engagements/[id]/setup/consent-draft-note.tsx")) && /WITHDRAW_HEADING/.test(src("app/engagements/[id]/setup/consent-draft-note.tsx")));

// purpose missing from the approved text: a warning helper (the lead wires it into pre-flight), never a block
ok("purpose gap: the stored purpose sentence is in the text, no warning", consentPurposeGap(t.body, p) === null);
ok("purpose gap: the stored purpose is not in the text, warning", /does not state this assessment's purpose/.test(consentPurposeGap(base.body, p) ?? ""));
ok("purpose gap: no stored purpose and the default sentence is there, no warning", consentPurposeGap(base.body, null) === null);
ok("purpose gap: no stored purpose and no purpose in the text at all, warning", /does not state a purpose/.test(consentPurposeGap("You agree to take part.", null) ?? ""));
ok("purpose gap: it only ever returns text or null (a warning, not a block)", ["string", "object"].includes(typeof consentPurposeGap("x", "y")));
ok("source: the async helper for pre-flight exists and uses the same check on an APPROVED text only", /consentPurposeGap/.test(src("lib/consent-purpose-warning.ts")) && /status !== "APPROVED"/.test(src("lib/consent-purpose-warning.ts")));

// the rights page is linked from the consent screen, the invitation email and the survey footer
ok("source: the consent screen links to the rights page", /<RightsLink>your data rights<\/RightsLink>/.test(src("app/respond/flow.tsx")));
ok("source: the survey footer (every screen after the invitation) and the invitation screen link to it", /<RightsLink \/>/.test(src("components/survey-shell.tsx")) && /<RightsLink \/>/.test(src("app/respond/invite.tsx")));
const mail = src("lib/email.ts"), inv = mail.slice(mail.indexOf("export function invitationMail"), mail.indexOf("export function pulseMail"));
ok("source: the invitation email carries the rights link with the same personal token", /rightsUrl\(o\.url\)/.test(inv) && /replace\("\/respond#", "\/respond\/rights#"\)/.test(mail));
ok("source: the link keeps the token in the URL hash (never sent to a server) when followed", /window\.location\.hash/.test(src("components/rights-link.tsx")));

done();
