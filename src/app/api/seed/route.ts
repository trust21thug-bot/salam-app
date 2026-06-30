import { seedLocalDatabase } from "@/lib/supabase/local";

export async function POST() {
  seedLocalDatabase();
  return Response.json({ ok: true });
}
