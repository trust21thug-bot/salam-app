import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDb } from "@/lib/supabase/init";
import { saveToDisk } from "@/lib/supabase/local";
import { calculateMemorizationScore, calculateRevisionScore } from "@/lib/formulas/grading";
import { filterStudentsForCircleAtWeek } from "@/lib/circle-transfers";

const VALID_TABLES = new Set([
  "teachers", "assistant_teachers", "attendants", "students",
  "attendance_records", "weekly_tracking", "discipline_records",
  "ranking_groups", "weekly_rankings", "general_rankings",
  "prayer_times", "school_year", "trips", "trip_students", "trip_supervisors", "sports_bans", "school_members", "prospective_students", "circle_transfers",
]);

export async function GET(req: Request) {
  await ensureDb();
  const url = new URL(req.url);
  const table = url.searchParams.get("table");
  if (!table || !VALID_TABLES.has(table)) {
    return Response.json({ error: "Invalid or missing table" }, { status: 400 });
  }

  const db = createAdminClient();
  let q = db.from(table).select("*");

  for (const [key, val] of url.searchParams) {
    if (key === "table") continue;
    if (key === "ids" || key === "student_ids") continue;
    const num = Number(val);
    const parsed = String(num) === val ? num : val;
    q = q.eq(key, parsed) as typeof q;
  }

  const ids = url.searchParams.get("ids");
  if (ids) {
    const idList = ids.split(",").filter(Boolean);
    if (idList.length > 0) {
      q = q.in("id", idList) as typeof q;
    }
  }

  const studentIds = url.searchParams.get("student_ids");
  if (studentIds) {
    const idList = studentIds.split(",").filter(Boolean);
    if (idList.length > 0) {
      q = q.in("student_id", idList) as typeof q;
    }
  }

  const { data } = await q;
  return Response.json(data ?? []);
}

export async function POST(req: Request) {
  await ensureDb();
  const body = await req.json() as {
    table: string;
    action: "upsert" | "delete" | "batch-upsert" | "upsert-many" | "calculate" | "recalculate-general" | "update" | "insert";
    data: unknown;
    match?: Record<string, unknown>;
    filter?: Record<string, unknown>;
    group_id?: string;
    week_number?: number;
    circle_ids?: string[];
  };

  if (!body.table || !VALID_TABLES.has(body.table)) {
    return Response.json({ error: "Invalid or missing table" }, { status: 400 });
  }

  const db = createAdminClient();

  if (body.action === "calculate" && body.table === "weekly_rankings") {
    const { group_id, week_number, circle_ids } = body;
    if (!group_id || !week_number || !circle_ids) {
      return Response.json({ error: "Missing group_id, week_number, or circle_ids" }, { status: 400 });
    }

    const { data: allStudentsRaw } = await db.from("students").select("*");
    const { data: transfersRaw } = await db.from("circle_transfers").select("*");
    const transfers = (transfersRaw ?? []) as any[];
    const allStudents = filterStudentsForCircleAtWeek(
      (allStudentsRaw ?? []) as any[],
      transfers,
      circle_ids,
      week_number!
    );
    if (allStudents.length === 0) {
      return Response.json({ error: "لا يوجد طلاب في الحلقات المحددة" }, { status: 400 });
    }

    const { data: trackingData } = await db.from("weekly_tracking").select("*").eq("week_number", week_number).in("student_id", allStudents.map((s: any) => s.id));
    const trackingMap: Record<string, any> = {};
    for (const t of (trackingData ?? []) as any[]) {
      trackingMap[t.student_id] = t;
    }

    const { data: attendanceData } = await db.from("attendance_records").select("*").eq("week_number", week_number).in("student_id", allStudents.map((s: any) => s.id));
    const attMap: Record<string, any[]> = {};
    for (const a of (attendanceData ?? []) as any[]) {
      if (!attMap[a.student_id]) attMap[a.student_id] = [];
      attMap[a.student_id].push(a);
    }

    const rankings: any[] = [];
    for (const s of allStudents) {
      const t = trackingMap[s.id];
      const att = attMap[s.id] || [];
      const requiredMem = (s as any).required_memorization ?? 0.25;
      const requiredRev = (s as any).required_revision ?? 0.25;

      const memorizationScore = t ? calculateMemorizationScore(t.memorization_amount ?? 0, requiredMem) : 0;
      const revisionScore = t ? calculateRevisionScore(t.revision_amount ?? 0, requiredRev) : 0;
      const combinedScore = Math.min(memorizationScore + revisionScore, 10);
      const wardScore = t?.ward_score ?? 0;
      const behaviorScore = t?.behavior_score ?? 0;
      const presentCount = att.filter((a: any) => a.status === "present" || a.status === "excused_accepted").length;
      const attendanceScore = att.length > 0 ? (presentCount / att.length) * 10 : 0;
      const totalScore = combinedScore * 5 + wardScore * 4 + behaviorScore * 2 + attendanceScore * 3;

      rankings.push({
        student_id: s.id,
        group_id,
        week_number,
        memorization_score: Math.round(memorizationScore * 10) / 10,
        revision_score: Math.round(revisionScore * 10) / 10,
        ward_score: Math.round(wardScore * 10) / 10,
        behavior_score: Math.round(behaviorScore * 10) / 10,
        attendance_score: Math.round(attendanceScore * 10) / 10,
        total_score: Math.round(totalScore * 10) / 10,
        manual_adjustment: 0,
        rank_position: 0,
      });
    }

    rankings.sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0));
    rankings.forEach((r: any, i: number) => { r.rank_position = i + 1; });

    (db.from("weekly_rankings") as any).clear();
    await db.from("weekly_rankings").upsert(rankings as any);
    return Response.json({ ok: true, count: rankings.length });
  }

  if (body.action === "recalculate-general") {
    const { data: students } = await db.from("students").select("*");
    const allStudents = (students ?? []) as any[];

    const generalRankings: any[] = [];
    for (const s of allStudents) {
      const mem = s.total_memorization != null && s.total_memorization > 0 ? s.total_memorization : 0;
      const evalScore = s.master_evaluation != null && s.master_evaluation > 0 ? s.master_evaluation : 0;
      const total = Math.round(mem * evalScore);

      generalRankings.push({
        student_id: s.id,
        total_memorization: mem,
        master_evaluation: evalScore,
        total_score: total,
        rank_position: 0,
      });
    }

    generalRankings.sort((a: any, b: any) => (b.total_score || 0) - (a.total_score || 0));
    generalRankings.forEach((r: any, i: number) => { r.rank_position = i + 1; });

    (db.from("general_rankings") as any).clear();
    await db.from("general_rankings").upsert(generalRankings as any);
    return Response.json({ ok: true, count: generalRankings.length });
  }

  if (body.action === "insert") {
    const record = body.data as Record<string, unknown>;
    const { data, error } = await db.from(body.table).insert(record as any).select().single();
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json(data);
  }

  if (body.action === "upsert") {
    const record = body.data as Record<string, unknown>;

    if (!record.id && body.table === "attendance_records") {
      const { data } = await db.from(body.table).select("*")
        .eq("student_id", record.student_id as string)
        .eq("circle_id", record.circle_id as string)
        .eq("week_number", Number(record.week_number))
        .eq("day_of_week", Number(record.day_of_week));
      const rows = data as any[] | null;
      if (rows && rows[0]) record.id = rows[0].id;
    }

    const { data, error } = await db.from(body.table).upsert(record as any).select().single();
    if (error) return Response.json({ error }, { status: 500 });
    return Response.json(data);
  }

  if (body.action === "upsert-many") {
    const arr = Array.isArray(body.data) ? body.data : [body.data];
    await db.from(body.table).upsert(arr as any);
    return Response.json({ ok: true });
  }

  if (body.action === "delete") {
    const { id, match } = body.data as { id?: string; match?: Record<string, unknown> };
    if (id) {
      await db.from(body.table).delete().eq("id", id);
    } else if (match) {
      let q = db.from(body.table).delete();
      for (const [key, val] of Object.entries(match)) {
        q = q.eq(key, val) as typeof q;
      }
      await q;
    }
    return Response.json({ ok: true });
  }

  if (body.action === "update") {
    const { match, data } = body;
    if (!match || !data) return Response.json({ error: "match and data required" }, { status: 400 });
    let q = db.from(body.table).select("*");
    for (const [key, val] of Object.entries(match as Record<string, unknown>)) {
      q = q.eq(key, val) as typeof q;
    }
    const { data: existing } = await q;
    const rows = (existing ?? []) as any[];
    for (const row of rows) {
      Object.assign(row, data, { updated_at: new Date().toISOString() });
    }
    saveToDisk();
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
}