import { createAdminClient } from "@/lib/supabase/admin";
import { AttendanceClient } from "./attendance-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [teachers, students] = await Promise.all([
    db.from("teachers").select("id, full_name, teaching_days").order("full_name"),
    db.from("students").select("id, first_name, last_name, circle_id").order("first_name"),
  ]);
  return {
    teachers: teachers.data ?? [],
    students: students.data ?? [],
  };
}

export default async function AttendancePage() {
  const { teachers, students } = await getData();
  return <AttendanceClient teachers={teachers} students={students} />;
}
