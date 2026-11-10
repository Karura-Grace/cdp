import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/email";

// The CDP site's Contact form ("Request a briefing"). Checks the entries, emails the CDP team (reply-to is the visitor) and sends the visitor
// a short confirmation. Nothing is stored: no database, no schema. Logs carry no names, addresses or message text.
export const runtime = "nodejs";

const TEAM = "cdp@pac.africa";
const NEEDS = ["Align culture to strategy", "Leadership behaviour gap", "Systems and rituals", "Business-model change", "Readiness for transformation", "Sub-cultures or integration"];
const SIZES = ["Under 250", "250 to 1,000", "1,000 to 5,000", "Over 5,000"];

// Best effort, per server instance: 5 enquiries per address per 10 minutes.
const hits = new Map<string, number[]>();
function allowed(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= 5) return false;
  hits.set(ip, [...recent, now]);
  if (hits.size > 5000) hits.clear();
  return true;
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\r\u0000]/g, "").trim().slice(0, max) : "");
const oneLine = (s: string) => s.replace(/\s+/g, " ");

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  if (clean(b.website, 200)) return NextResponse.json({ ok: true }); // honeypot: pretend it worked

  const name = oneLine(clean(b.name, 80));
  const role = oneLine(clean(b.role, 80));
  const email = clean(b.email, 254);
  const org = oneLine(clean(b.org, 150));
  const size = SIZES.includes(clean(b.size, 40)) ? clean(b.size, 40) : "";
  const needs = Array.isArray(b.needs) ? b.needs.filter((n): n is string => typeof n === "string" && NEEDS.includes(n)) : [];
  const message = clean(b.message, 3000);

  if (!name) return NextResponse.json({ error: "Please add your name." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Please enter a valid work email." }, { status: 400 });
  if (b.consent !== true) return NextResponse.json({ error: "Please tick the box so we may contact you." }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allowed(ip)) return NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });

  const staff = await sendMail({
    to: TEAM,
    replyTo: email,
    subject: `CDP briefing request: ${org || name}`,
    text: [
      `${name} <${email}> asked for a CDP briefing on the CDP website.`,
      `Role: ${role || "not given"}`,
      `Organisation: ${org || "not given"}`,
      `Headcount: ${size || "not given"}`,
      `Interested in: ${needs.join(", ") || "not given"}`,
      "",
      message || "(no message)",
    ].join("\n"),
  });
  if (!staff) return NextResponse.json({ error: "We could not send your request just now. Please write to cdp@pac.africa instead." }, { status: 502 });

  // The confirmation is a courtesy: if it fails the team still has the request.
  await sendMail({
    to: email,
    subject: "We received your CDP enquiry",
    text: `Hello ${name},\n\nThank you for asking about the Culture Dynamics Profile. A PAC consultant will reply to arrange a briefing.\n\nIf you need to add anything, reply to this email.\n\nPriority Activator Consulting`,
  });
  return NextResponse.json({ ok: true });
}
