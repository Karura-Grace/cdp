import "server-only";   // like the service role, this key must never reach a browser bundle
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// AC 3.6: the only client that may run the functions returning response rows (capture.frozen_response_set, frozen_360_set, closed_pulse_set).
// It carries SCORING_KEY, a JWT whose role is scoring_reader, in the Authorization header. The gateway still wants a project key in
// `apikey`, so the public anon key goes there, as for staff requests. The application's service role key can no longer run these functions.
// Import this only from the scoring job: scoring, the freeze check and pulse results. Fails closed when the key is missing.
// scripts/mint-scoring-key.mjs mints and renews the key.
let client: ReturnType<typeof createClient<Database>> | null = null;

export function scoringClient() {
  const key = process.env.SCORING_KEY;
  if (!key) throw new Error("SCORING_KEY is not set");
  client ??= createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${key}` } },
  });
  return client;
}
