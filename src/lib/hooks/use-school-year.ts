"use client";

import { useEffect, useState } from "react";
import { getCurrentWeekNumber, getWeekRangeLabel } from "@/lib/week-utils";

export function useSchoolYear() {
  const [startDate, setStartDate] = useState<Date | null>(null);

  useEffect(() => {
    fetch("/api/query?table=school_year")
      .then((r) => r.json())
      .then((data: { id: string; start_date: string }[]) => {
        if (data && data[0]?.start_date) {
          setStartDate(new Date(data[0].start_date));
        }
      })
      .catch(() => {});
  }, []);

  const weekNumber = startDate ? getCurrentWeekNumber(startDate) : 1;
  const weekRangeLabel = startDate ? getWeekRangeLabel(startDate, weekNumber) : "";

  return { weekNumber, weekRangeLabel, startDate };
}
