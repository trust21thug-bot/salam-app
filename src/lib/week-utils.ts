const ARABIC_MONTHS = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export function formatDate(date: Date): string {
  return `${date.getDate()} ${ARABIC_MONTHS[date.getMonth()]}`;
}

export function getWeekDayDate(startDate: Date, weekNumber: number, dayOfWeek: number): Date {
  const date = new Date(startDate);
  date.setDate(date.getDate() + (weekNumber - 1) * 7 + dayOfWeek);
  return date;
}

export function formatWeekDay(startDate: Date, weekNumber: number, dayOfWeek: number): string {
  const date = getWeekDayDate(startDate, weekNumber, dayOfWeek);
  return `${DAY_NAMES[dayOfWeek]} ${date.getDate()} ${ARABIC_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function getWeekDateRange(startDate: Date, weekNumber: number): { from: Date; to: Date } {
  const from = new Date(startDate);
  from.setDate(from.getDate() + (weekNumber - 1) * 7);
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  return { from, to };
}

export function getWeekRangeLabel(startDate: Date, weekNumber: number): string {
  const { from, to } = getWeekDateRange(startDate, weekNumber);
  return `من ${formatDate(from)} إلى ${formatDate(to)}`;
}

export function getCurrentWeekNumber(startDate: Date): number {
  const now = new Date();
  const diff = now.getTime() - startDate.getTime();
  if (diff < 0) return 1;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}
