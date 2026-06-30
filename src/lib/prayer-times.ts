export const DEFAULT_PRAYER_TIMES = ["الفجر", "الشروق", "الظهر", "العصر", "المغرب", "العشاء"];
export const DEFAULT_PRAYER_CLOCK: Record<string, string> = {
  الفجر: "05:00",
  الشروق: "06:30",
  الظهر: "12:30",
  العصر: "16:00",
  المغرب: "20:00",
  العشاء: "21:30",
};

export interface PrayerTimeData {
  names: string[];
  clockMap: Record<string, string>;
}

export async function fetchPrayerTimes(): Promise<PrayerTimeData> {
  try {
    const res = await fetch("/api/query?table=prayer_times");
    const data = (await res.json()) as { name: string; sort_order: number; clock_time?: string }[];
    if (data && data.length > 0) {
      const sorted = data.sort((a, b) => a.sort_order - b.sort_order);
      const names = sorted.map((p) => p.name);
      const clockMap: Record<string, string> = {};
      for (const p of sorted) {
        if (p.clock_time) clockMap[p.name] = p.clock_time;
      }
      return { names, clockMap };
    }
  } catch {}
  return { names: DEFAULT_PRAYER_TIMES, clockMap: DEFAULT_PRAYER_CLOCK };
}
