import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsClient } from "./settings-client";
import type { SchoolMember } from "@/types/database";

export const dynamic = "force-dynamic";

async function getData() {
  const db = createAdminClient();
  const [groups, teachers, prayerTimesRaw, schoolYearRaw, schoolMembers] = await Promise.all([
    db.from("ranking_groups").select("*").order("name"),
    db.from("teachers").select("id, full_name").order("full_name"),
    db.from("prayer_times").select("*").order("sort_order"),
    db.from("school_year").select("*"),
    db.from("school_members").select("*").order("last_name"),
  ]);
  const schoolYearData = (schoolYearRaw.data ?? []) as { id: string; start_date: string }[];
  return {
    groups: groups.data ?? [],
    teachers: teachers.data ?? [],
    prayerTimes: (prayerTimesRaw.data ?? []) as { id: string; name: string; sort_order: number; clock_time?: string }[],
    schoolYearStart: schoolYearData[0]?.start_date ?? "",
    schoolMembers: (schoolMembers.data ?? []) as SchoolMember[],
  };
}

export default async function SettingsPage() {
  const { groups, teachers, prayerTimes, schoolYearStart, schoolMembers } = await getData();
  return <SettingsClient initialGroups={groups} teachers={teachers} initialPrayerTimes={prayerTimes} initialSchoolYearStart={schoolYearStart} initialSchoolMembers={schoolMembers} />;
}
