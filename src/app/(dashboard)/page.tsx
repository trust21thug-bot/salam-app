import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

async function getStats() {
  const db = createAdminClient();
  const [students, teachers, groups] = await Promise.all([
    db.from("students").select("*", { count: "exact", head: true }),
    db.from("teachers").select("*", { count: "exact", head: true }),
    db.from("ranking_groups").select("*", { count: "exact", head: true }),
  ]);
  return {
    studentCount: students.count ?? 0,
    teacherCount: teachers.count ?? 0,
    groupCount: groups.count ?? 0,
  };
}

export default async function DashboardPage() {
  const db = createAdminClient();
  const [stats, teachers, assistants, attendants] = await Promise.all([
    getStats(),
    db.from("teachers").select("*").order("full_name"),
    db.from("assistant_teachers").select("*").order("full_name"),
    db.from("attendants").select("*").order("full_name"),
  ]);
  return (
    <DashboardClient
      stats={stats}
      teachers={teachers.data ?? []}
      assistants={assistants.data ?? []}
      attendants={attendants.data ?? []}
    />
  );
}
