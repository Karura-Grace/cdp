import "server-only";   // the service role must never reach a browser bundle; importing this from client code fails the build
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// service_role bypasses RLS: use only in route handlers, after the caller has been authorised
// with their own JWT client, and never import this from a client component.
let client: ReturnType<typeof createClient<Database>> | null = null;

export function admin() {
  client ??= createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
