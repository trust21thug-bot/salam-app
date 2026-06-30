import type { Student, WeeklyTracking, AttendanceRecord } from "./database";

export type StudentWithCircle = Student & { circle_name: string };

export type TrackingWithStudent = WeeklyTracking & {
  student: Pick<Student, "id" | "first_name" | "last_name">;
};

export type AttendanceWithStudent = AttendanceRecord & {
  student: Pick<Student, "id" | "first_name" | "last_name">;
};

export interface WeeklySummary {
  student_id: string;
  full_name: string;
  total_sessions: number;
  studied_sessions: number;
  absences: number;
  lates: number;
  excused_accepted: number;
  excused_rejected: number;
  attendance_rate: number;
}

export interface SemesterGrade {
  student_id: string;
  full_name: string;
  avg_memorization: number;
  avg_revision: number;
  avg_ward: number;
  avg_behavior: number;
  avg_attendance: number;
  overall: number;
  grade_label: string;
  teacher_note: string;
  total_unexcused_absences: number;
  total_excused_accepted: number;
  total_excused_rejected: number;
  total_lates: number;
}

export type GradeThreshold = {
  label: string;
  min: number;
};
