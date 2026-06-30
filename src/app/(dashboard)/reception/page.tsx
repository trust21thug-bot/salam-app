import { createAdminClient } from "@/lib/supabase/admin";
import { ReceptionClient } from "./reception-client";

export const dynamic = "force-dynamic";

export default async function ReceptionPage() {
  const db = createAdminClient();
  const { data } = await db.from("prospective_students").select("*").order("created_at", { ascending: false });
  return <ReceptionClient initialStudents={data ?? []} />;
}
