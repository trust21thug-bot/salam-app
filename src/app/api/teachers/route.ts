import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDb } from "@/lib/supabase/init";

export async function GET() {
  await ensureDb();
  const db = createAdminClient();
  const { data } = await db.from("teachers").select("*").order("full_name");
  return Response.json(data ?? []);
}

export async function POST(req: Request) {
  await ensureDb();
  const body = await req.json();
  const db = createAdminClient();
  const { data, error } = await db.from("teachers").upsert(body).select().single();
  if (error) return Response.json({ error }, { status: 500 });
  return Response.json(data);
}

export async function DELETE(req: Request) {
  await ensureDb();
  const { id } = await req.json();
  const db = createAdminClient();
  await db.from("teachers").delete().eq("id", id);
  return Response.json({ ok: true });
}
