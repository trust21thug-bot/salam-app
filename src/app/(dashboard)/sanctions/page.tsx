import { createAdminClient } from "@/lib/supabase/admin";
import { SanctionsClient } from "./sanctions-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [teachers, students, sportsBans, schoolYear] = await Promise.all([
    db.from("teachers").select("id, full_name").order("full_name"),
    db.from("students").select("id, first_name, last_name, circle_id").order("first_name"),
    db.from("sports_bans").select("*"),
    db.from("school_year").select("start_date").single(),
  ]);
  return {
    teachers: teachers.data ?? [],
    students: students.data ?? [],
    sportsBans: sportsBans.data ?? [],
    schoolYear: schoolYear.data ?? null,
  };
}

export default async function SanctionsPage() {
  const data = await getData();
  return <SanctionsClient {...data} />;
}
