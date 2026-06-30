import { createAdminClient } from "@/lib/supabase/admin";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [students, teachers] = await Promise.all([
    db.from("students").select("id, first_name, last_name").order("first_name"),
    db.from("teachers").select("id, full_name").order("full_name"),
  ]);
  return { students: students.data ?? [], teachers: teachers.data ?? [] };
}

export default async function ReportsPage() {
  const { students, teachers } = await getData();
  return <ReportsClient students={students} teachers={teachers} />;
}
