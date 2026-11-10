// Submits generated survey answers through the same two routes a respondent's browser uses (consent, then the final submit).
import { surveyPayload } from "./rehearsal-data.mjs";

/** links: [{ email, token }]. kindOf(email) is "exec" or "staff". Returns how many were submitted. */
export async function fillAll(base, links, kindOf, { skip = new Set(), seedBase = 1000 } = {}) {
  let n = 0;
  for (const [i, l] of links.entries()) {
    if (skip.has(l.email)) continue;
    const h = { "content-type": "application/json", "x-survey-token": l.token };
    const c = await fetch(`${base}/v1/survey/consent`, { method: "POST", headers: h, body: JSON.stringify({ decision: "AGREE" }) });
    if (!c.ok) throw new Error(`consent ${l.email}: ${c.status}`);
    const r = await fetch(`${base}/v1/survey`, { method: "PUT", headers: h, body: JSON.stringify({ payload: surveyPayload(kindOf(l.email), seedBase + i), language: "en", duration: 1800 + (i % 7) * 120 }) });
    if (!r.ok) throw new Error(`submit ${l.email}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    n++;
  }
  return n;
}
