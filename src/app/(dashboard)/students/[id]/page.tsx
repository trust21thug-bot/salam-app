import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { StudentProfile } from "./student-profile";
import { getAge } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

async function getStudentData(id: string) {
  const db = createAdminClient();
  const [student, records, tracking, discipline, generalRanking, weeklyRankings, schoolYear] = await Promise.all([
    db.from("students").select("*, teachers(full_name)").eq("id", id).single(),
    db.from("attendance_records").select("*").eq("student_id", id).order("week_number", { ascending: false }),
    db.from("weekly_tracking").select("*").eq("student_id", id).order("week_number", { ascending: false }),
    db.from("discipline_records").select("*").eq("student_id", id).order("record_date", { ascending: false }),
    db.from("general_rankings").select("*").eq("student_id", id).single(),
    db.from("weekly_rankings").select("*").eq("student_id", id).order("week_number", { ascending: false }),
    db.from("school_year").select("*"),
  ]);
  const studentData = student.data as any;
  let siblings: any[] = [];
  if (studentData?.sibling_ids?.length) {
    const { data: sibData } = await db.from("students").select("id, first_name, last_name").in("id", studentData.sibling_ids);
    siblings = (sibData ?? []) as any[];
  }
  return {
    student: studentData,
    records: records.data ?? [],
    tracking: tracking.data ?? [],
    discipline: discipline.data ?? [],
    generalRanking: (generalRanking as any)?.data ?? null,
    weeklyRankings: (weeklyRankings as any)?.data ?? [],
    schoolYear: (schoolYear.data ?? []) as any[],
    siblings,
  };
}

export default async function StudentPage({ params }: Props) {
  const { id } = await params;
  const data = await getStudentData(id);
  if (!data.student) notFound();
  return <StudentProfile data={data} />;
}
