import { createAdminClient } from "./admin";
import type {
  Teacher,
  AssistantTeacher,
  Attendant,
  Student,
  AttendanceRecord,
  WeeklyTracking,
  DisciplineRecord,
  RankingGroup,
  WeeklyRanking,
  GeneralRanking,
  CircleTransfer,
} from "@/types/database";
import { filterStudentsForCircleAtWeek } from "@/lib/circle-transfers";

const db = () => createAdminClient();

export async function getTeachers(): Promise<Teacher[]> {
  const { data } = await db().from("teachers").select("*").order("full_name");
  return data ?? [];
}

export async function getTeacher(id: string): Promise<Teacher | null> {
  const { data } = await db().from("teachers").select("*").eq("id", id).single();
  return data;
}

export async function upsertTeacher(teacher: Partial<Teacher> & { full_name: string }): Promise<Teacher> {
  const { data } = await db().from("teachers").upsert(teacher).select().single();
  return data!;
}

export async function deleteTeacher(id: string): Promise<void> {
  await db().from("teachers").delete().eq("id", id);
}

export async function getAssistantTeachers(): Promise<AssistantTeacher[]> {
  const { data } = await db().from("assistant_teachers").select("*").order("full_name");
  return data ?? [];
}

export async function upsertAssistantTeacher(at: Partial<AssistantTeacher> & { full_name: string }): Promise<AssistantTeacher> {
  const { data } = await db().from("assistant_teachers").upsert(at).select().single();
  return data!;
}

export async function deleteAssistantTeacher(id: string): Promise<void> {
  await db().from("assistant_teachers").delete().eq("id", id);
}

export async function getAttendants(): Promise<Attendant[]> {
  const { data } = await db().from("attendants").select("*").order("full_name");
  return data ?? [];
}

export async function upsertAttendant(a: Partial<Attendant> & { full_name: string }): Promise<Attendant> {
  const { data } = await db().from("attendants").upsert(a).select().single();
  return data!;
}

export async function deleteAttendant(id: string): Promise<void> {
  await db().from("attendants").delete().eq("id", id);
}

export async function getStudents(circleId?: string, weekNumber?: number): Promise<Student[]> {
  let q = db().from("students").select("*").order("first_name");
  if (circleId && !weekNumber) q = q.eq("circle_id", circleId);
  const { data } = await q;
  const students = (data ?? []) as Student[];
  if (circleId && weekNumber) {
    const { data: transfersData } = await db().from("circle_transfers").select("*");
    return filterStudentsForCircleAtWeek(students, (transfersData ?? []) as CircleTransfer[], circleId, weekNumber);
  }
  return students;
}

export async function getStudent(id: string): Promise<Student | null> {
  const { data } = await db().from("students").select("*").eq("id", id).single();
  return data;
}

export async function upsertStudent(s: Partial<Student> & { first_name: string; last_name: string }): Promise<Student> {
  const { data } = await db().from("students").upsert(s).select().single();
  return data!;
}

export async function deleteStudent(id: string): Promise<void> {
  await db().from("students").delete().eq("id", id);
}

export async function getAttendanceRecords(circleId: string, weekNumber: number): Promise<AttendanceRecord[]> {
  const { data } = await db()
    .from("attendance_records")
    .select("*")
    .eq("circle_id", circleId)
    .eq("week_number", weekNumber);
  return data ?? [];
}

export async function upsertAttendanceRecord(r: Partial<AttendanceRecord> & { student_id: string; circle_id: string; week_number: number; day_of_week: number; status: string }): Promise<AttendanceRecord> {
  const { data } = await db().from("attendance_records").upsert(r).select().single();
  return data!;
}

export async function massAbsence(circleId: string, weekNumber: number, dayOfWeek: number): Promise<void> {
  const students = await getStudents(circleId, weekNumber);
  const records = students.map((s) => ({
    student_id: s.id,
    circle_id: circleId,
    week_number: weekNumber,
    day_of_week: dayOfWeek,
    status: "excused_accepted" as const,
    is_mass_absence: true,
  }));
  await db().from("attendance_records").upsert(records);
}

export async function getWeeklyTracking(studentId: string, weekNumber: number): Promise<WeeklyTracking | null> {
  const { data } = await db()
    .from("weekly_tracking")
    .select("*")
    .eq("student_id", studentId)
    .eq("week_number", weekNumber)
    .single();
  return data;
}

export async function getWeeklyTrackingBatch(studentIds: string[], weekNumber: number): Promise<WeeklyTracking[]> {
  if (studentIds.length === 0) return [];
  const { data } = await db()
    .from("weekly_tracking")
    .select("*")
    .in("student_id", studentIds)
    .eq("week_number", weekNumber);
  return data ?? [];
}

export async function upsertWeeklyTracking(t: Partial<WeeklyTracking> & { student_id: string; week_number: number }): Promise<WeeklyTracking> {
  const { data } = await db().from("weekly_tracking").upsert(t).select().single();
  return data!;
}

export async function getDisciplineRecords(studentId: string): Promise<DisciplineRecord[]> {
  const { data } = await db()
    .from("discipline_records")
    .select("*")
    .eq("student_id", studentId)
    .order("record_date", { ascending: false });
  return data ?? [];
}

export async function getDisciplineRecordsBatch(studentIds: string[]): Promise<DisciplineRecord[]> {
  if (studentIds.length === 0) return [];
  const { data } = await db()
    .from("discipline_records")
    .select("*")
    .in("student_id", studentIds)
    .order("record_date", { ascending: false });
  return data ?? [];
}

export async function upsertDisciplineRecord(r: Partial<DisciplineRecord> & { student_id: string; type: string; reason: string }): Promise<DisciplineRecord> {
  const { data } = await db().from("discipline_records").upsert(r).select().single();
  return data!;
}

export async function getRankingGroups(): Promise<RankingGroup[]> {
  const { data } = await db().from("ranking_groups").select("*").order("name");
  return data ?? [];
}

export async function upsertRankingGroup(g: Partial<RankingGroup> & { name: string; circle_ids: string[] }): Promise<RankingGroup> {
  const { data } = await db().from("ranking_groups").upsert(g).select().single();
  return data!;
}

export async function deleteRankingGroup(id: string): Promise<void> {
  await db().from("ranking_groups").delete().eq("id", id);
}

export async function getWeeklyRankings(groupId: string, weekNumber: number): Promise<WeeklyRanking[]> {
  const { data } = await db()
    .from("weekly_rankings")
    .select("*")
    .eq("group_id", groupId)
    .eq("week_number", weekNumber)
    .order("rank_position");
  return data ?? [];
}

export async function getGeneralRankings(): Promise<GeneralRanking[]> {
  const { data } = await db()
    .from("general_rankings")
    .select("*")
    .order("rank_position");
  return data ?? [];
}

export async function upsertGeneralRanking(r: Partial<GeneralRanking> & { student_id: string }): Promise<GeneralRanking> {
  const { data } = await db().from("general_rankings").upsert(r).select().single();
  return data!;
}
