type SessionCount = 2 | 3 | 4;

const POINTS: Record<SessionCount, { present: number; absent: number; late: number; excused_accepted: number }> = {
  2: { present: 5, absent: 0, late: 2.5, excused_accepted: 4 },
  3: { present: 3.333, absent: 0, late: 1.5, excused_accepted: 2.5 },
  4: { present: 2.5, absent: 0, late: 1, excused_accepted: 2 },
};

export function calculateAttendanceRate(
  totalSessions: number,
  statuses: Array<{ status: string }>
): number {
  const sessionsPerWeek = totalSessions as SessionCount;
  if (!(sessionsPerWeek in POINTS)) return 0;

  const p = POINTS[sessionsPerWeek];
  let total = 0;

  for (const s of statuses) {
    switch (s.status) {
      case "present":
        total += p.present;
        break;
      case "late":
        total += p.late;
        break;
      case "excused_accepted":
        total += p.excused_accepted;
        break;
      case "absent":
      case "excused_rejected":
        break;
    }
  }

  return Math.round(total * 10) / 10;
}

export function calculateAttendanceScore(
  totalSessions: number,
  statuses: Array<{ status: string }>
): number {
  const rate = calculateAttendanceRate(totalSessions, statuses);
  return Math.min(rate, 10);
}
