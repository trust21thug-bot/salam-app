export type AttendanceStatus = "present" | "absent" | "late" | "excused_accepted" | "excused_rejected";
export type DisciplineType = "reprimand" | "praise";
export type Classification = "invitation" | "project" | "public_circle";
export type FileStatus = "complete" | "not_paid" | "missing_birth_cert" | "missing_photo" | "missing_photo_and_birth_cert" | "no_file";

export interface Teacher {
  id: string;
  full_name: string;
  teaching_days: number[];
  teaching_time: string;
  teaching_schedule: Record<number, string> | null;
  phone: string | null;
  assistant_id: string | null;
  required_memorization: number;
  required_revision: number;
  created_at: string;
}

export interface AssistantTeacher {
  id: string;
  full_name: string;
  teaching_days: number[];
  teaching_time: string;
  teaching_schedule: Record<number, string> | null;
  phone: string | null;
  teacher_id: string;
  created_at: string;
}

export function getTeacherTime(t: Teacher | AssistantTeacher, day: number): string | null {
  if (t.teaching_schedule?.[day]) return t.teaching_schedule[day];
  if (t.teaching_days.includes(day)) return t.teaching_time;
  return null;
}

export function getTeacherDays(t: Teacher | AssistantTeacher): number[] {
  if (t.teaching_schedule) return Object.keys(t.teaching_schedule).map(Number);
  return t.teaching_days;
}

export interface Attendant {
  id: string;
  full_name: string;
  attendant_number: string;
  duty_days: number[];
  created_at: string;
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  circle_id: string;
  academic_level: string;
  photo_url: string | null;
  photo_cropped_url: string | null;
  guardian_phone: string;
  classification: Classification;
  illness: string | null;
  file_status: string | null;
  sibling_id: string | null;
  required_memorization?: number;
  required_revision?: number;
  total_memorization?: number | null;
  master_evaluation?: number | null;
  insurance?: boolean;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  circle_id: string;
  week_number: number;
  day_of_week: number;
  status: AttendanceStatus;
  is_mass_absence: boolean;
  created_at: string;
}

export interface WeeklyTracking {
  id: string;
  student_id: string;
  week_number: number;
  memorization_amount: number;
  revision_amount: number;
  ward_score: number;
  behavior_score: number;
  created_at: string;
}

export interface DisciplineRecord {
  id: string;
  student_id: string;
  type: DisciplineType;
  reason: string;
  record_date: string;
  created_at: string;
}

export interface RankingGroup {
  id: string;
  name: string;
  circle_ids: string[];
  created_at: string;
}

export interface WeeklyRanking {
  id: string;
  student_id: string;
  week_number: number;
  group_id: string;
  memorization_score: number;
  revision_score: number;
  ward_score: number;
  behavior_score: number;
  attendance_score: number;
  manual_adjustment: number;
  total_score: number;
  rank_position: number;
  created_at: string;
}

export interface Trip {
  id: string;
  date: string;
  destination: string;
  departure_time: string | null;
  cost: number | null;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripStudent {
  id: string;
  trip_id: string;
  student_id: string;
  allowed: boolean;
  reason: string | null;
  notified: boolean | null;
  subscription_paid: boolean;
  created_at: string;
}

export interface SchoolMember {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  created_at: string;
}

export interface TripSupervisor {
  id: string;
  trip_id: string;
  school_member_id: string;
  created_at: string;
}

export interface SportsBan {
  id: string;
  student_id: string;
  week_number: number;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeneralRanking {
  id: string;
  student_id: string;
  total_memorization: number;
  master_evaluation: number;
  total_score: number | null;
  rank_position: number | null;
  updated_at: string;
}

export interface CircleTransfer {
  id: string;
  student_id: string;
  from_circle_id: string | null;
  to_circle_id: string;
  week_number: number;
  created_at: string;
}

export interface ProspectiveStudent {
  id: string;
  first_name: string;
  last_name: string;
  guardian_phone: string;
  birth_date: string;
  studied_before: boolean;
  previous_memorization: number;
  notified: boolean;
  created_at: string;
}
