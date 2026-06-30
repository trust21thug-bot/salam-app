import { createAdminClient } from "@/lib/supabase/admin";
import { DisciplineClient } from "./discipline-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [teachers, students] = await Promise.all([
    db.from("teachers").select("id, full_name").order("full_name"),
    db.from("students").select("id, first_name, last_name, circle_id").order("first_name"),
  ]);
  return { teachers: teachers.data ?? [], students: students.data ?? [] };
}

export default async function DisciplinePage() {
  const { teachers, students } = await getData();
  return <DisciplineClient teachers={teachers} initialStudents={students} />;
}
