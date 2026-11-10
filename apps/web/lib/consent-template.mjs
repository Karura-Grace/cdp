// Consent text template (spec Table 19 and S2-03). DRAFT WORDING: PAC legal and the client's data protection officer
// must review it before first launch in each jurisdiction (spec §1.4.5). Paragraphs are separated by a blank line.
const REGIMES = {
  KE_DPA_2019: "the Kenya Data Protection Act, 2019",
  UG_DPPA_2019: "the Uganda Data Protection and Privacy Act, 2019",
  RW_DPP_2021: "Rwanda's law on the protection of personal data and privacy (2021)",
  TZ_PDPA_2022: "the Tanzania Personal Data Protection Act, 2022",
  NG_NDPA_2023: "the Nigeria Data Protection Act, 2023",
  GH_DPA_2012: "the Ghana Data Protection Act, 2012",
};

// The sentence that states the purpose. Without a stored engagement purpose the default wording is used.
export const purposeSentence = (purpose) => purpose
  ? `The purpose of this assessment is: ${purpose.trim().replace(/[.\s]+$/, "")}.`
  : "The purpose is to understand how things are done in your organisation today and how they need to be done in future.";

/** DRAFT wording for the right to withdraw (owner decision of 18 October 2026: drafted by Claude, for PAC legal review). The staff screen where the consent text is approved
 *  shows WITHDRAW_DRAFT_NOTE while the text carries this paragraph. Remove the note and this comment once legal has signed the wording off. */
export const WITHDRAW_HEADING = "Your right to withdraw.";
export const WITHDRAW_DRAFT_NOTE = "The paragraph that starts \"Your right to withdraw\" is a DRAFT written for PAC legal review. It has not been checked by a lawyer yet. Read it before you approve this text.";
const WITHDRAW = `${WITHDRAW_HEADING} You can withdraw your consent at any time before you submit. To do that, close this page without submitting, or press "I do not agree" on the consent screen, or write to hello@pac.africa and ask for your link to be cancelled. Your invitation record, which holds your name and email address, can then be erased. Withdrawing has no consequence for you. Once you have submitted, your answers have been separated from your name and cannot be found, so they cannot be taken back or removed. That is the one limit on this right.`;

/** A warning (never a block) when an approved consent text does not state the purpose of the assessment: the stored purpose sentence is missing, or, with no stored purpose, no purpose is mentioned at all. */
export function consentPurposeGap(body, purpose = null) {
  if (purpose && !body.includes(purposeSentence(purpose))) return "The approved consent text does not state this assessment's purpose as it is now recorded. Make a new consent version so people read the right purpose.";
  if (!purpose && !/purpose/i.test(body)) return "The approved consent text does not state a purpose for the assessment.";
  return null;
}

export function consentText({ orgName, privacyRegime, purpose = null }) {
  const law = privacyRegime?.startsWith("OTHER:")
    ? `the data protection law named as "${privacyRegime.slice(6)}"`
    : (REGIMES[privacyRegime] ?? "the data protection law that applies to your organisation");
  return {
    title: "Your consent to take part",
    body: [
      `${orgName} has asked Priority Activator Consulting (PAC Africa) to run the Culture Dynamics Profile. ${purposeSentence(purpose)} The results guide leadership decisions about culture. They are not used to assess, reward or discipline any individual.`,
      `What we collect: your answers to the scenario questions (how you distribute 100 points), the rating questions, the eight experience questions, and any typed comments. Typed comments are stored encrypted. Your name and email address are never stored with your answers. If your organisation set a group label for your link, such as a department or grade, it is stored with your answers so results can be reported by group.`,
      `Who sees it: PAC Africa consultants prepare the report. Your organisation's leadership receives results for groups only. Results are never shown for a group of fewer than 5 people.`,
      `When you submit, the link between your invitation and your answers is destroyed. After that, your answers cannot be individually found, retrieved or deleted, by you or by anyone else.`,
      `Your answers are kept for 24 months after the survey closes and are then permanently destroyed, unless your organisation asks PAC Africa in writing, before then, to keep them differently.`,
      `Taking part is voluntary and has no consequence for you either way. If you decline, nothing is recorded except that this link was declined. You can stop at any time before you submit: nothing is sent until you press Submit, and you can close this page and come back later with the same link.`,
      WITHDRAW,
      `Your rights under ${law} include access to, correction of and objection to the processing of your personal data. Before you submit, write to hello@pac.africa or to your organisation's data protection officer.`,
    ].join("\n\n"),
  };
}
