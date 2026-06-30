export function calculateGrade(
  achieved: number,
  required: number
): number {
  if (required <= 0) return 10;
  const raw = (achieved / required) * 10;
  return Math.min(raw, 10);
}

export function calculateMemorizationScore(
  memorizationAmount: number,
  requiredMemorization: number
): number {
  return calculateGrade(memorizationAmount, requiredMemorization);
}

export function calculateRevisionScore(
  revisionAmount: number,
  requiredRevision: number
): number {
  return calculateGrade(revisionAmount, requiredRevision);
}
