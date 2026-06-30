import { createAdminClient } from "@/lib/supabase/admin";
import { TeachersPageClient } from "./teachers-page-client";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [teachers, assistants, attendants] = await Promise.all([
    db.from("teachers").select("*").order("full_name"),
    db.from("assistant_teachers").select("*").order("full_name"),
    db.from("attendants").select("*").order("full_name"),
  ]);
  return {
    teachers: teachers.data ?? [],
    assistants: assistants.data ?? [],
    attendants: attendants.data ?? [],
  };
}

export default async function TeachersPage() {
  const { teachers, assistants, attendants } = await getData();

  return <TeachersPageClient initialData={{ teachers, assistants, attendants }} />;
}
