import { RULES_VERSION, INSTRUMENT_VERSION } from "@pac/cdp-engine";

// Engine uses node:crypto, so engine-calling routes must run on the Node runtime.
export const runtime = "nodejs";

export function GET() {
  return Response.json({ ok: true, rules: RULES_VERSION, instrument: INSTRUMENT_VERSION });
}
