import { createAdminClient } from "@/lib/supabase/admin";
import { TrackingClient } from "./tracking-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [teachers, students] = await Promise.all([
    db.from("teachers").select("id, full_name").order("full_name"),
    db.from("students").select("id, first_name, last_name, circle_id, required_memorization, required_revision").order("first_name"),
  ]);
  return { teachers: teachers.data ?? [], students: students.data ?? [] };
}

export default async function TrackingPage() {
  const { teachers, students } = await getData();
  return <TrackingClient teachers={teachers} initialStudents={students} />;
}
