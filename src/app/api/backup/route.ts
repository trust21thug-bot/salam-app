import { createAdminClient } from "@/lib/supabase/admin";
import { saveToDisk } from "@/lib/supabase/local";

const BACKUP_TABLES = [
  "teachers", "assistant_teachers", "attendants", "students",
  "attendance_records", "weekly_tracking", "discipline_records",
  "ranking_groups", "weekly_rankings", "general_rankings",
  "prayer_times", "school_year", "trips", "trip_students", "trip_supervisors", "sports_bans", "school_members",
];

export async function GET() {
  const db = createAdminClient();
  const snapshot: Record<string, unknown> = {};
  for (const table of BACKUP_TABLES) {
    const { data } = await db.from(table).select("*");
    snapshot[table] = data ?? [];
  }
  snapshot["_exported_at"] = new Date().toISOString();
  return new Response(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="salam-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    const data = JSON.parse(text);
    const db = createAdminClient();

    for (const table of BACKUP_TABLES) {
      if (Array.isArray(data[table])) {
        (db.from(table) as any).clear();
        if (data[table].length > 0) {
          (db.from(table) as any).insert(data[table]);
        }
      }
    }

    saveToDisk();
    return Response.json({ ok: true, message: "تم استعادة النسخة الاحتياطية بنجاح" });
  } catch {
    return Response.json({ error: "فشل في استيراد الملف. تأكد من أنه نسخة احتياطية صالحة." }, { status: 400 });
  }
}
