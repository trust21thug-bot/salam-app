import { createAdminClient } from "@/lib/supabase/admin";
import { TripsClient } from "./trips-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [trips, teachers, students, attendance, schoolYear, schoolMembers] = await Promise.all([
    db.from("trips").select("*").order("date", { ascending: false }),
    db.from("teachers").select("id, full_name").order("full_name"),
    db.from("students").select("*").order("first_name"),
    db.from("attendance_records").select("student_id, status"),
    db.from("school_year").select("start_date").single(),
    db.from("school_members").select("*").order("last_name"),
  ]);
  return {
    trips: trips.data ?? [],
    teachers: teachers.data ?? [],
    students: students.data ?? [],
    attendance: attendance.data ?? [],
    schoolYear: schoolYear.data ?? null,
    schoolMembers: schoolMembers.data ?? [],
  };
}

export default async function TripsPage() {
  const data = await getData();
  return <TripsClient {...data} />;
}
