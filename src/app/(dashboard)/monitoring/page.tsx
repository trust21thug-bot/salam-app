import { createAdminClient } from "@/lib/supabase/admin";
import { MonitoringClient } from "./monitoring-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [teachers, students, attendance, schoolYear] = await Promise.all([
    db.from("teachers").select("*").order("full_name"),
    db.from("students").select("*").order("first_name"),
    db.from("attendance_records").select("*"),
    db.from("school_year").select("*"),
  ]);
  return {
    teachers: teachers.data ?? [],
    students: students.data ?? [],
    attendance: attendance.data ?? [],
    schoolYear: schoolYear.data ?? [],
  };
}

export default async function MonitoringPage() {
  const { teachers, students, attendance, schoolYear } = await getData();
  return (
    <MonitoringClient
      teachers={teachers}
      students={students}
      attendance={attendance}
      schoolYear={schoolYear}
    />
  );
}