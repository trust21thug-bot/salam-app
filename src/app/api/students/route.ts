import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDb } from "@/lib/supabase/init";

export async function GET() {
  await ensureDb();
  const db = createAdminClient();
  const { data } = await db.from("students").select("*").order("first_name");
  return Response.json(data ?? []);
}

export async function POST(req: Request) {
  await ensureDb();
  const body = await req.json();
  const db = createAdminClient();
  const { data, error } = await db.from("students").upsert(body).select().single();
  if (error) return Response.json({ error }, { status: 500 });
  return Response.json(data);
}

export async function DELETE(req: Request) {
  await ensureDb();
  const { id } = await req.json();
  const db = createAdminClient();
  await db.from("students").delete().eq("id", id);
  return Response.json({ ok: true });
}