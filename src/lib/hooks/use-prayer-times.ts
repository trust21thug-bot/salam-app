"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PRAYER_TIMES, DEFAULT_PRAYER_CLOCK } from "@/lib/prayer-times";

export function usePrayerTimes() {
  const [names, setNames] = useState<string[]>(DEFAULT_PRAYER_TIMES);
  const [clockMap, setClockMap] = useState<Record<string, string>>(DEFAULT_PRAYER_CLOCK);

  useEffect(() => {
    fetch("/api/query?table=prayer_times")
      .then((r) => r.json())
      .then((data: { name: string; sort_order: number; clock_time?: string }[]) => {
        if (data && data.length > 0) {
          const sorted = data.sort((a, b) => a.sort_order - b.sort_order);
          setNames(sorted.map((p) => p.name));
          const cm: Record<string, string> = {};
          for (const p of sorted) {
            if (p.clock_time) cm[p.name] = p.clock_time;
          }
          setClockMap(cm);
        }
      })
      .catch(() => {});
  }, []);

  return { names, clockMap };
}
