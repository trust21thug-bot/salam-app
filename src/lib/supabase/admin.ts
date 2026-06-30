import { createClient } from "@supabase/supabase-js";
import { createLocalClient, loadFromDisk, getTablesForPersistence } from "./local";

export function createAdminClient() {
  // Re-load from disk on every request to stay in sync with file changes
  loadFromDisk();
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );
  }
  return createLocalClient() as unknown as ReturnType<typeof createClient>;
}

// Pre-load from disk at module load time (server-side only)
if (typeof window === "undefined") {
  loadFromDisk();
}
