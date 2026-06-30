import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const db = createAdminClient();
    await db.from("audit_logs").insert({
      level: body.level ?? "info",
      message: body.message,
      data: body.data ?? null,
    });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("Logging failed:", e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
