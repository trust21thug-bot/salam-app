import type { GradeThreshold } from "@/types/app";

const DEFAULT_THRESHOLDS: GradeThreshold[] = [
  { label: "ممتاز", min: 9 },
  { label: "جيد جدًا", min: 8 },
  { label: "جيد", min: 6.5 },
  { label: "متوسط", min: 5 },
  { label: "ضعيف", min: 0 },
];

const WEIGHTS = { combined: 5, ward: 4, behavior: 2, attendance: 3 };
const WEIGHT_SUM = WEIGHTS.combined + WEIGHTS.ward + WEIGHTS.behavior + WEIGHTS.attendance;

export function calculateCombined(avgMemorization: number, _avgRevision: number): number {
  return Math.min(avgMemorization, 10);
}

export function calculateOverall(
  avgMemorization: number,
  avgRevision: number,
  avgWard: number,
  avgBehavior: number,
  avgAttendance: number,
  academicLevel?: string
): number {
  const combined = calculateCombined(avgMemorization, avgRevision);
  const weighted =
    combined * WEIGHTS.combined +
    avgWard * WEIGHTS.ward +
    avgBehavior * WEIGHTS.behavior +
    avgAttendance * WEIGHTS.attendance;

  const outOf = (academicLevel && !academicLevel.includes("ابتدائي")) ? 20 : 10;
  return Math.round((weighted / (WEIGHT_SUM * 10)) * outOf * 10) / 10;
}

export function getGradeLabel(overall: number, thresholds: GradeThreshold[] = DEFAULT_THRESHOLDS): string {
  for (const t of thresholds) {
    if (overall >= t.min) return t.label;
  }
  return thresholds[thresholds.length - 1].label;
}
