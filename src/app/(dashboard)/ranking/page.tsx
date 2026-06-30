import { createAdminClient } from "@/lib/supabase/admin";
import { RankingClient } from "./ranking-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [groups, teachers, students] = await Promise.all([
    db.from("ranking_groups").select("*").order("name"),
    db.from("teachers").select("id, full_name").order("full_name"),
    db.from("students").select("id, first_name, last_name, circle_id").order("first_name"),
  ]);
  return {
    groups: groups.data ?? [],
    teachers: teachers.data ?? [],
    students: students.data ?? [],
  };
}

export default async function RankingPage() {
  const data = await getData();
  return <RankingClient {...data} />;
}
