// Section I rules that need more than a field type (spec 1.4.4, Table 18). Plain JavaScript with no imports, so the browser, the server and the node check scripts all load the same file.

/** A cohort has up to this many conditions (owner decision 18 October 2026: three or more allowed). Fields axis1 and value1 to axis5 and value5. */
export const MAX_CONDITIONS = 5;
export const COHORT_AXES = ["DEPARTMENT", "GRADE", "TENURE_BAND", "EXECUTIVE", "DEMOGRAPHIC"];
export const REMINDER_KINDS = ["WORKING_DAY_AFTER_OPEN", "HOURS_BEFORE_CLOSE"];
export const REMINDER_AUDIENCE = ["NOT_SUBMITTED", "STARTED_NOT_SUBMITTED"];

/** Spec Table 18, I6: "recommended minimum 8 interviews and 2 focus groups". A hint shown to the consultant, never a block. */
export const RECOMMENDED_QUALITATIVE = { interviews: 8, focus_groups: 2 };

const set = (v) => v !== undefined && v !== null && v !== "";

/** What each cohort axis expects in its value, so a typo is caught when saving and not at launch. */
export function cohortValueError(axis, value) {
  if (!set(value)) return null;
  if (axis === "EXECUTIVE" && value !== "YES" && value !== "NO") return "for Executive, the value is YES or NO";
  if (axis === "DEMOGRAPHIC" && !/^[^=]+=.+$/.test(String(value))) return "for Demographic, write the attribute name, an equals sign and the value (for example Gender=Female)";
  return null;
}

/** Interview and focus group counts are tied to the I6 choice. */
export function qualitativeErrors(p, complete) {
  const out = [];
  const q = p.qualitative, iv = Number(p.interviews_planned ?? 0), fg = Number(p.focus_groups_planned ?? 0);
  if (q === "NONE" && (iv > 0 || fg > 0)) out.push("I6 Qualitative complement: remove the counts, or choose interviews, focus groups or both");
  if (q === "INTERVIEWS" && fg > 0) out.push("I6 Qualitative complement: focus groups are counted only with Focus groups or Both");
  if (q === "FOCUS_GROUPS" && iv > 0) out.push("I6 Qualitative complement: interviews are counted only with Interviews or Both");
  if (complete) {
    if ((q === "INTERVIEWS" || q === "BOTH") && !(iv >= 1)) out.push("I6 Qualitative complement: enter the number of interviews planned");
    if ((q === "FOCUS_GROUPS" || q === "BOTH") && !(fg >= 1)) out.push("I6 Qualitative complement: enter the number of focus groups planned");
  }
  return out;
}

/** The recommended minimum is a hint (spec I6), so it comes back as text and never as an error. */
export function qualitativeHints(p) {
  const q = p.qualitative, iv = Number(p.interviews_planned ?? 0), fg = Number(p.focus_groups_planned ?? 0), out = [];
  if ((q === "INTERVIEWS" || q === "BOTH") && iv >= 1 && iv < RECOMMENDED_QUALITATIVE.interviews) out.push(`${iv} interviews planned; the recommended minimum is ${RECOMMENDED_QUALITATIVE.interviews}.`);
  if ((q === "FOCUS_GROUPS" || q === "BOTH") && fg >= 1 && fg < RECOMMENDED_QUALITATIVE.focus_groups) out.push(`${fg} focus group${fg === 1 ? "" : "s"} planned; the recommended minimum is ${RECOMMENDED_QUALITATIVE.focus_groups}.`);
  return out;
}

/** Cross field rules for Section I. `complete` rules apply only when agreeing. */
export function crossI(p, complete, out) {
  const cohorts = p.cohorts ?? [];
  const names = cohorts.map((c) => String(c.name ?? "").trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) out.push("I1 Cohorts: each cohort needs a different name");
  cohorts.forEach((c, i) => {
    const l = `I1 Cohorts ${i + 1}`;
    const ORD = ["", "first", "second", "third", "fourth", "fifth"], seen = new Set();
    for (let k = 1; k <= MAX_CONDITIONS; k++) {
      const ax = c["axis" + k], va = c["value" + k];
      // the same axis twice is a mistake, except Demographic with two different attributes (for example Gender and Disability)
      const key = ax === "DEMOGRAPHIC" ? "DEMOGRAPHIC:" + String(va ?? "").split("=")[0].trim().toLowerCase() : ax;
      if (ax && seen.has(key)) out.push(`${l}: the conditions must use different axes`);
      if (ax) seen.add(key);
      const e = cohortValueError(ax, va); if (e) out.push(`${l}: ${e}`);
      if (k > 1 && set(ax) !== set(va) && (complete || set(va))) out.push(`${l}: the ${ORD[k]} condition needs both an axis and a value, or neither`);
    }
  });
  demographicErrors(p, out);
  out.push(...qualitativeErrors(p, complete));
  const custom = p.reminder_custom ?? [];
  custom.forEach((r, i) => { const max = r.kind === "HOURS_BEFORE_CLOSE" ? 168 : 60; if (typeof r.n === "number" && r.n > max) out.push(`Custom reminders ${i + 1}: at most ${max}`); });
  const keys = custom.map((r) => `${r.kind}|${r.n}|${r.audience}`);
  if (new Set(keys).size !== keys.length) out.push("Reminder plan: the same reminder is listed twice");
  if (p.reminder_plan !== "CUSTOM" && custom.length) out.push("Reminder plan: remove the custom reminders, or choose Custom");
  if (complete) {
    if (p.reminder_plan === "CUSTOM" && !custom.length) out.push("Reminder plan: a custom plan needs at least one reminder");
    if (p.reminder_plan === "CUSTOM" && p.reminder_custom_approved !== true) out.push("Reminder plan: a custom plan needs the consultant's approval (tick the approval box)");
    if (p.staff_message_checked !== true) out.push("I5 Message to staff: confirm that it states the purpose, how results are used, the anonymity commitment and what happens next");
  }
}

// ---------------------------------------------------------------- demographic attributes declared inside Section I (spec 1.4.1, 1.4.5)

/** Splits the typed list of values ("Female; Male; Prefer not to say") into the closed list. */
export const splitValues = (t) => [...new Set(String(t ?? "").split(/[;\n]/).map((v) => v.trim()).filter(Boolean))];

export function demographicErrors(p, out) {
  const list = p.demographics ?? [], names = new Set();
  list.forEach((d, i) => {
    const l = `I1 Demographic attributes ${i + 1}`, n = String(d.name ?? "").trim().toLowerCase();
    if (n && names.has(n)) out.push(`${l}: each attribute needs a different name`);
    names.add(n);
    const v = splitValues(d.values);
    if (v.length < 2 || v.length > 30) out.push(`${l}: give a closed list of 2 to 30 values, separated by semicolons`);
    if (v.some((x) => x.length > 60)) out.push(`${l}: each value is at most 60 characters`);
    if (String(d.analytical_purpose ?? "").trim().length < 10) out.push(`${l}: say why the attribute is needed (at least 10 characters)`);
  });
}

// ---------------------------------------------------------------- staff message keyword scan (I5)

/** The four things the message must say (spec 1.4.4 I5) and words that suggest each is there. A scan can miss wording, so a miss is a warning only. */
export const MESSAGE_TOPICS = [
  ["purpose", "the purpose of the survey", /\b(purpose|aim|goal|in order to|so that|we want to understand|to understand)\b/i],
  ["use of results", "how the results will be used", /\b(results?|findings?|report)\b[^.]{0,120}\b(used|use|guide|inform|decide|decisions?|shared|shown)\b|\bwill be used\b/i],
  ["anonymity", "the anonymity or confidentiality commitment", /\b(anonymous|anonymity|confidential|confidentiality|cannot be (traced|identified)|never (shown|stored))\b/i],
  ["next steps", "what happens next", /\b(what happens next|next steps?|after the survey|will (receive|then)|follow[- ]up|then decide)\b/i],
];
export function messageGaps(message) {
  const m = String(message ?? "");
  return MESSAGE_TOPICS.filter(([, , re]) => !re.test(m)).map(([k, t]) => ({ topic: k, text: t }));
}
