export interface RankingCriteria {
  memorizationScore: number;
  revisionScore: number;
  wardScore: number;
  behaviorScore: number;
  attendanceScore: number;
  manualAdjustment: number;
}

const WEIGHTS = {
  memorization: 4,
  revision: 2,
  ward: 2,
  behavior: 1,
  attendance: 1,
};

export function calculateTotalScore(criteria: RankingCriteria): number {
  return (
    criteria.memorizationScore * WEIGHTS.memorization +
    criteria.revisionScore * WEIGHTS.revision +
    criteria.wardScore * WEIGHTS.ward +
    criteria.behaviorScore * WEIGHTS.behavior +
    criteria.attendanceScore * WEIGHTS.attendance +
    criteria.manualAdjustment
  );
}

export function rankStudents(
  students: Array<{ id: string; criteria: RankingCriteria }>
): Array<{ id: string; totalScore: number; rank: number }> {
  const scored = students.map((s) => ({
    id: s.id,
    totalScore: calculateTotalScore(s.criteria),
  }));

  scored.sort((a, b) => b.totalScore - a.totalScore);

  return scored.map((s, i) => ({
    ...s,
    rank: i + 1,
  }));
}

export function combineWeeklyRankings(
  weeklyScores: Array<{ weekNumber: number; totalScore: number }>
): number {
  return weeklyScores.reduce((sum, w) => sum + w.totalScore, 0);
}
