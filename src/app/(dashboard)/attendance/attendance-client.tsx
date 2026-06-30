"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { generateWeekNumber, DAY_LABELS, ATTENDANCE_LABELS } from "@/lib/utils";
import { calculateAttendanceRate } from "@/lib/formulas/attendance";
import { useSchoolYear } from "@/lib/hooks/use-school-year";
import { getWeekRangeLabel } from "@/lib/week-utils";
import { filterStudentsForCircleAtWeek } from "@/lib/circle-transfers";
import type { CircleTransfer } from "@/types/database";

interface Props {
  teachers: any[];
  students: any[];
}

const STATUSES = ["present", "absent", "late", "excused_accepted", "excused_rejected"];

export function AttendanceClient({ teachers, students }: Props) {
  const searchParams = useSearchParams();
  const { weekNumber: calculatedWeek, startDate } = useSchoolYear();
  const [circleId, setCircleId] = useState(searchParams.get("circle") || "");
  const [weekNumber, setWeekNumber] = useState(Number(searchParams.get("week")) || 1);
  const [dayOfWeek, setDayOfWeek] = useState<number>(Number(searchParams.get("day")) || new Date().getDay());
  const [records, setRecords] = useState<Record<string, string>>({});
  const [transfers, setTransfers] = useState<CircleTransfer[]>([]);

  useEffect(() => {
    if (calculatedWeek > 1) {
      const paramWeek = searchParams.get("week");
      if (!paramWeek) setWeekNumber(calculatedWeek);
    }
  }, [calculatedWeek, searchParams]);

  const selectedTeacher = useMemo(() => teachers.find((t) => t.id === circleId), [teachers, circleId]);
  const availableDays = useMemo(() => {
    if (selectedTeacher?.teaching_schedule) return Object.keys(selectedTeacher.teaching_schedule).map(Number);
    return selectedTeacher?.teaching_days ?? [];
  }, [selectedTeacher]);
  const circleStudents = useMemo(() => filterStudentsForCircleAtWeek(students, transfers, circleId, weekNumber), [students, transfers, circleId, weekNumber]);

  const daysUpToSelected = useMemo(() => {
    const sorted = [...availableDays].sort((a: number, b: number) => a - b);
    const idx = sorted.indexOf(dayOfWeek);
    return idx >= 0 ? sorted.slice(0, idx + 1) : sorted;
  }, [availableDays, dayOfWeek]);

  const loadRecords = useCallback(async () => {
    if (!circleId) return;
    const res = await fetch(`/api/query?table=attendance_records&circle_id=${encodeURIComponent(circleId)}&week_number=${weekNumber}`);
    const data = await res.json();

    const dayMap: Record<string, string> = {};
    const weekMap: Record<string, Record<number, string>> = {};

    data.forEach((r: any) => {
      if (!weekMap[r.student_id]) weekMap[r.student_id] = {};
      weekMap[r.student_id][r.day_of_week] = r.status;
      if (r.day_of_week === dayOfWeek) dayMap[r.student_id] = r.status;
    });

    setAllWeekRecords(weekMap);
    setRecords(dayMap);
  }, [circleId, weekNumber, dayOfWeek]);

  const [allWeekRecords, setAllWeekRecords] = useState<Record<string, Record<number, string>>>({});

  useEffect(() => {
    fetch("/api/query?table=circle_transfers")
      .then((r) => r.json())
      .then((data) => setTransfers(data ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { if (circleId) loadRecords(); }, [circleId, weekNumber, dayOfWeek, loadRecords]);

  const setStatus = async (studentId: string, status: string) => {
    setRecords((prev) => ({ ...prev, [studentId]: status }));
    setAllWeekRecords((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [dayOfWeek]: status },
    }));
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: "attendance_records",
        action: "upsert",
        data: {
          student_id: studentId,
          circle_id: circleId,
          week_number: weekNumber,
          day_of_week: dayOfWeek,
          status,
        },
      }),
    });
  };

  const handleMassAbsence = async () => {
    const records = circleStudents.map((s) => ({
      student_id: s.id,
      circle_id: circleId,
      week_number: weekNumber,
      day_of_week: dayOfWeek,
      status: "excused_accepted",
      is_mass_absence: true,
    }));
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "attendance_records", action: "upsert-many", data: records }),
    });
    await loadRecords();
    toast.success("تم تسجيل غياب الأستاذ لجميع الطلبة");
  };

  const summary = useMemo(() => {
    const totalSessions = daysUpToSelected.length;

    return circleStudents.map((s) => {
      const dayRecords = allWeekRecords[s.id] ?? {};
      const statuses = daysUpToSelected
        .filter((d: number) => dayRecords[d] !== undefined)
        .map((d: number) => ({ status: dayRecords[d] }));

      const rate = calculateAttendanceRate(totalSessions, statuses);

      return {
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        totalSessions,
        studiedSessions: statuses.length,
        absences: statuses.filter((r: any) => r.status === "absent").length,
        lates: statuses.filter((r: any) => r.status === "late").length,
        excusedAccepted: statuses.filter((r: any) => r.status === "excused_accepted").length,
        excusedRejected: statuses.filter((r: any) => r.status === "excused_rejected").length,
        rate,
      };
    });
  }, [circleStudents, allWeekRecords, daysUpToSelected]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">تسجيل الغياب</h2>

      <div className="flex gap-4 flex-wrap">
        <div className="w-64">
          <Select value={circleId} onValueChange={setCircleId}>
            <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
            <SelectContent>
              {teachers.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <input type="number" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={weekNumber} onChange={(e) => setWeekNumber(parseInt(e.target.value) || 1)} />
        </div>
        {startDate && (
          <div className="flex items-center text-sm" style={{ color: "#7C5C1E" }}>
            {getWeekRangeLabel(startDate, weekNumber)}
          </div>
        )}
        <div className="w-40">
          <Select value={String(dayOfWeek)} onValueChange={(v) => setDayOfWeek(parseInt(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableDays.map((d: number) => (
                <SelectItem key={d} value={String(d)}>{DAY_LABELS[d]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="secondary" onClick={handleMassAbsence}>
          غياب الأستاذ (تسجيل جماعي)
        </Button>
      </div>

      {circleId && (
        <>
          <Card>
            <CardHeader><CardTitle>تسجيل الحضور - {DAY_LABELS[dayOfWeek]}</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الطالب</TableHead>
                    {STATUSES.map((s) => (
                      <TableHead key={s}>{ATTENDANCE_LABELS[s]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {circleStudents.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.first_name} {s.last_name}</TableCell>
                      {STATUSES.map((status) => (
                        <TableCell key={status}>
                          <input
                            type="radio"
                            name={`status-${s.id}`}
                            checked={records[s.id] === status}
                            onChange={() => setStatus(s.id, status)}
                            className="w-4 h-4"
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>ملخص الحضور الأسبوعي (حتى {DAY_LABELS[dayOfWeek]})</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الطالب</TableHead>
                    <TableHead>عدد الحصص</TableHead>
                    <TableHead>المدروسة</TableHead>
                    <TableHead>غياب</TableHead>
                    <TableHead>تأخر</TableHead>
                    <TableHead>مبرر مقبول</TableHead>
                    <TableHead>مبرر غير مقبول</TableHead>
                    <TableHead>المعدل (من 10)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.name}</TableCell>
                      <TableCell>{s.totalSessions}</TableCell>
                      <TableCell>{s.studiedSessions}</TableCell>
                      <TableCell>{s.absences}</TableCell>
                      <TableCell>{s.lates}</TableCell>
                      <TableCell>{s.excusedAccepted}</TableCell>
                      <TableCell>{s.excusedRejected}</TableCell>
                      <TableCell><Badge>{s.rate}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}