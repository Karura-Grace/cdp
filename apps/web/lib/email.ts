import "server-only";

// Email through Resend's HTTP API (pac.africa is a verified sending domain). Sender is hello@pac.africa.
const FROM = "Culture Dynamics Profile <hello@pac.africa>";
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export type Mail = { to: string; subject: string; text: string; replyTo?: string };

/** Sends one message. Returns true on acceptance by Resend; never throws, so a bad address cannot stop a batch. */
export async function sendMail(m: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || /\.(example|test|invalid)$/i.test(m.to)) return false;   // reserved domains (RFC 2606, the demo logins) never deliver
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [m.to], reply_to: m.replyTo ?? "hello@pac.africa", subject: m.subject, text: m.text }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : null);

/** The data rights page for a personal survey link: same token, /respond/rights instead of /respond. */
export const rightsUrl = (surveyUrl: string) => surveyUrl.replace("/respond#", "/respond/rights#");

/** The survey invitation. The link is personal and works once. */
export function invitationMail(o: { to: string; name: string | null; org: string; url: string; close: string | null; message?: string | null; estimate?: string | null }): Mail {
  const closes = fmt(o.close);
  return {
    to: o.to,
    subject: `Your voice on how we work at ${o.org}`,   // owner ruling 24 Oct 2026 (Q-SM7): a short email, the full message is on the survey's first page
    text: [
      `Hello${o.name ? ` ${o.name.split(" ")[0]}` : ""},`,
      "",
      `${o.org} is running the Culture Dynamics Profile with Priority Activator Consulting. Your view of how the organisation works today, and how it should work, is needed.`,
      "",
      `The survey takes about ${o.estimate ?? "35 to 45 minutes"}. You can stop and come back to it.`,
      ...(o.message ? ["", "Before you start, please read the message from the leadership of " + o.org + " on the first page of the survey. It explains what the survey asks, how your answers are protected, and how to get help or opt out."] : []),
      "",
      `Your personal link: ${o.url}`,
      "",
      `The link works once and is yours alone, so please do not forward it.${closes ? ` The survey closes on ${closes}.` : ""}`,
      "Results are reported for groups, never for individuals.",
      "",
      `You can see what is held about you, correct it, object, or have your invitation erased before you submit: ${rightsUrl(o.url)}`,
      "",
      "Questions? Reply to this email.",
      "",
      "Priority Activator Consulting",
    ].join("\n"),
  };
}

/** The pulse invitation: a short check on a few priorities, so it says how long it takes and that nothing is traced to a person. */
export function pulseMail(o: { to: string; name: string | null; org: string; url: string; close: string | null }): Mail {
  const closes = fmt(o.close);
  return {
    to: o.to,
    subject: `${o.org}: a short culture pulse`,
    text: [
      `Hello${o.name ? ` ${o.name.split(" ")[0]}` : ""},`,
      "",
      `${o.org} is checking how its culture priorities are going, with Priority Activator Consulting. It is a short pulse, about five to ten minutes.`,
      "",
      `Your personal link: ${o.url}`,
      "",
      `The link works once and is yours alone, so please do not forward it.${closes ? ` The pulse closes on ${closes}.` : ""}`,
      "Your name is separated from your answers when you submit. Results are only reported for groups of five or more, and they are indicative, not a new assessment.",
      "",
      "Questions? Reply to this email.",
      "",
      "Priority Activator Consulting",
    ].join("\n"),
  };
}

/** A survey reminder. Links are not stored (only their hashes), so it points to the invitation email instead of carrying one. */
export function reminderMail(o: { to: string; name: string | null; org: string; close: string | null; final: boolean }): Mail {
  const closes = fmt(o.close);
  return {
    to: o.to,
    subject: `${o.org}: ${o.final ? "last chance to finish" : "a reminder about"} your Culture Dynamics Profile survey`,
    text: [
      `Hello${o.name ? ` ${o.name.split(" ")[0]}` : ""},`,
      "",
      o.final
        ? `You started the Culture Dynamics Profile survey for ${o.org} but have not submitted it yet. Your answers so far are saved.`
        : `This is a reminder that the Culture Dynamics Profile survey for ${o.org} is open and your view is still needed.`,
      "",
      `Please use the personal link in the invitation email from hello@pac.africa.${closes ? ` The survey closes on ${closes}.` : ""}`,
      "If you have already submitted, thank you, and please ignore this message. If you cannot find the invitation, reply to this email.",
      "",
      "Priority Activator Consulting",
    ].join("\n"),
  };
}
