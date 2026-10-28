import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { getServerEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

// Secret-key client: bypasses row level security. Only for server code that
// acts for anonymous patients (the chat), and every query must filter by the
// clinic it has resolved itself. Never import this from client components or
// from staff-facing pages, which must stay under RLS.
export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, getServerEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
