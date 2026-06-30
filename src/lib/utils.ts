import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateWeekNumber(): number {
  return 1;
}

export { getCurrentWeekNumber, getWeekRangeLabel, formatDate } from "./week-utils";

export function getAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export const DAY_LABELS: Record<number, string> = {
  0: "الأحد",
  1: "الإثنين",
  2: "الثلاثاء",
  3: "الأربعاء",
  4: "الخميس",
  5: "الجمعة",
  6: "السبت",
};

export const ATTENDANCE_LABELS: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused_accepted: "مبرر مقبول",
  excused_rejected: "مبرر غير مقبول",
};

export const CLASSIFICATION_LABELS: Record<string, string> = {
  invitation: "دعوة",
  project: "مشروع",
  public_circle: "حلقة عامة",
};

export const GRADE_LABELS: Record<string, string> = {
  excellent: "ممتاز",
  "very-good": "جيد جدًا",
  good: "جيد",
  average: "متوسط",
  poor: "ضعيف",
};

export const FILE_STATUS_LABELS: Record<string, string> = {
  complete: "كامل",
  not_paid: "لم يدفع",
  missing_birth_cert: "لم يحضر شهادة الميلاد",
  missing_photo: "لم يحضر صورة",
  missing_photo_and_birth_cert: "لم يحضر صورة وشهادة الميلاد",
  no_file: "لا يوجد ملف",
};

export const ACADEMIC_LEVELS: Record<string, string> = {
  "1-ابتدائي": "الأولى ابتدائي",
  "2-ابتدائي": "الثانية ابتدائي",
  "3-ابتدائي": "الثالثة ابتدائي",
  "4-ابتدائي": "الرابعة ابتدائي",
  "5-ابتدائي": "الخامسة ابتدائي",
  "1-متوسط": "الأولى متوسط",
  "2-متوسط": "الثانية متوسط",
  "3-متوسط": "الثالثة متوسط",
  "4-متوسط": "الرابعة متوسط",
  "1-ثانوي": "الأولى ثانوي",
  "2-ثانوي": "الثانية ثانوي",
  "3-ثانوي": "الثالثة ثانوي",
};
