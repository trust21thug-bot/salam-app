import type { Student, CircleTransfer } from "@/types/database";

function getTransfersForStudent(
  studentId: string,
  transfers: CircleTransfer[]
): CircleTransfer[] {
  return transfers
    .filter((t) => t.student_id === studentId)
    .sort((a, b) => a.week_number - b.week_number);
}

export function getCircleAtWeek(
  student: Student,
  weekNumber: number,
  transfers: CircleTransfer[]
): string {
  const studentTransfers = getTransfersForStudent(student.id, transfers);

  // Find the last transfer that took effect on or before weekNumber
  // Iterate in reverse (highest week_number first)
  for (let i = studentTransfers.length - 1; i >= 0; i--) {
    if (studentTransfers[i].week_number <= weekNumber) {
      return studentTransfers[i].to_circle_id;
    }
  }

  // No transfer applies at this week; use current circle_id
  return student.circle_id;
}

export function filterStudentsForCircleAtWeek(
  students: Student[],
  transfers: CircleTransfer[],
  circleId: string | string[],
  weekNumber: number
): Student[] {
  const ids = Array.isArray(circleId) ? circleId : [circleId];
  const idSet = new Set(ids);
  return students.filter((s) => {
    const circle = getCircleAtWeek(s, weekNumber, transfers);
    return idSet.has(circle);
  });
}
