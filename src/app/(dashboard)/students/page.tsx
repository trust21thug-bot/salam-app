import { createAdminClient } from "@/lib/supabase/admin";
import { StudentsClient } from "./students-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [students, teachers] = await Promise.all([
    db.from("students").select("*").order("first_name"),
    db.from("teachers").select("id, full_name").order("full_name"),
  ]);
  return {
    students: students.data ?? [],
    teachers: teachers.data ?? [],
  };
}

export default async function StudentsPage() {
  const { students, teachers } = await getData();
  return <StudentsClient initialStudents={students} teachers={teachers} />;
}
