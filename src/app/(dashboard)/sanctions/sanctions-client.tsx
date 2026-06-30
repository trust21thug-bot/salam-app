"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import type { Teacher, SportsBan } from "@/types/database";
import { getCurrentWeekNumber, getWeekRangeLabel } from "@/lib/week-utils";

interface StudentBrief {
  id: string;
  first_name: string;
  last_name: string;
  circle_id: string;
}

interface Props {
  teachers: Pick<Teacher, "id" | "full_name">[];
  students: StudentBrief[];
  sportsBans: SportsBan[];
  schoolYear: { start_date: string } | null;
}

const MAX_WEEKS = 20;

export function SanctionsClient({ teachers, students, sportsBans: initialBans, schoolYear }: Props) {
  const startDate = schoolYear?.start_date ? new Date(schoolYear.start_date) : new Date("2026-02-07");
  const defaultWeek = String(Math.min(getCurrentWeekNumber(startDate), MAX_WEEKS));
  const [currentWeek, setCurrentWeek] = useState(defaultWeek);
  const printRef = useRef<HTMLDivElement>(null);
  const [bans, setBans] = useState<Record<string, Record<string, boolean>>>(() => {
    const m: Record<string, Record<string, boolean>> = {};
    for (const b of initialBans) {
      const wk = String(b.week_number);
      if (!m[wk]) m[wk] = {};
      m[wk][b.student_id] = b.is_banned;
    }
    return m;
  });

  const weekOptions = useMemo(() =>
    Array.from({ length: MAX_WEEKS }, (_, i) => {
      const wk = i + 1;
      return { value: String(wk), label: `الأسبوع ${wk}: ${getWeekRangeLabel(startDate, wk)}` };
    }),
  [startDate]);

  const studentsByCircle = useMemo(() => {
    const m: Record<string, typeof students> = {};
    for (const s of students) {
      if (!m[s.circle_id]) m[s.circle_id] = [];
      m[s.circle_id].push(s);
    }
    return m;
  }, [students]);

  const weekBans = bans[currentWeek] ?? {};

  const bannedStudents = useMemo(() => {
    const result: { teacher: string; students: StudentBrief[] }[] = [];
    for (const t of teachers) {
      const circleStudents = (studentsByCircle[t.id] ?? []).filter((s) => weekBans[s.id]);
      if (circleStudents.length > 0) result.push({ teacher: t.full_name, students: circleStudents });
    }
    return result;
  }, [teachers, studentsByCircle, weekBans]);

  const setBan = async (studentId: string, isBanned: boolean) => {
    setBans((prev) => ({
      ...prev,
      [currentWeek]: { ...prev[currentWeek], [studentId]: isBanned },
    }));
    const wk = Number(currentWeek);
    const existing = initialBans.find((b) => b.student_id === studentId && b.week_number === wk);
    if (existing) {
      await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "sports_bans", action: "update", match: { id: existing.id }, data: { is_banned: isBanned } }) });
    } else {
      await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "sports_bans", action: "insert", data: { student_id: studentId, week_number: wk, is_banned: isBanned } }) });
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const rangeLabel = getWeekRangeLabel(startDate, Number(currentWeek));
    let html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>الممنوعون من الرياضة</title>
      <style>
        body { font-family: "Tajawal", sans-serif; padding: 20px; text-align: center; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 16px; color: #555; font-weight: normal; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #333; padding: 6px 10px; text-align: center; }
        th { background: #eee; }
        .teacher-title { font-size: 16px; font-weight: bold; margin: 16px 0 6px; text-align: right; }
        @media print { @page { size: A4; margin: 1cm; } }
      </style></head><body>
      <h1>مدرسة السلام</h1>
      <h2>لائحة التلاميذ الممنوعين من حصة الرياضة — ${rangeLabel}</h2>`;
    for (const group of bannedStudents) {
      html += `<div class="teacher-title">${group.teacher}</div>
      <table><thead><tr><th>#</th><th>الاسم</th><th>اللقب</th></tr></thead><tbody>`;
      group.students.forEach((s, i) => {
        html += `<tr><td>${i + 1}</td><td>${s.first_name}</td><td>${s.last_name}</td></tr>`;
      });
      html += `</tbody></table>`;
    }
    if (bannedStudents.length === 0) {
      html += `<p style="color:#888;">لا يوجد تلاميذ ممنوعون هذا الأسبوع</p>`;
    }
    html += `</body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">العقوبات</h2>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>التلاميذ الممنوعون من حصة الرياضة</CardTitle>
            <Button variant="outline" onClick={handlePrint} disabled={bannedStudents.length === 0}>طباعة اللائحة</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Label>اختر الأسبوع</Label>
            <Select value={currentWeek} onValueChange={setCurrentWeek}>
              <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
              <SelectContent>
                {weekOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {teachers.map((t) => {
            const circleStudents = studentsByCircle[t.id] ?? [];
            if (circleStudents.length === 0) return null;
            return (
              <Card key={t.id} className="mb-4">
                <CardHeader><CardTitle className="text-lg">{t.full_name}</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">#</TableHead>
                        <TableHead className="text-center">الاسم</TableHead>
                        <TableHead className="text-center">اللقب</TableHead>
                        <TableHead className="text-center">ممنوع من الرياضة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {circleStudents.map((s, idx) => (
                        <TableRow key={s.id}>
                          <TableCell className="text-center">{idx + 1}</TableCell>
                          <TableCell className="text-center">{s.first_name}</TableCell>
                          <TableCell className="text-center">{s.last_name}</TableCell>
                          <TableCell className="text-center">
                            <Select value={weekBans[s.id] ? "yes" : "no"} onValueChange={(v) => setBan(s.id, v === "yes")}>
                              <SelectTrigger className={`w-28 mx-auto ${weekBans[s.id] ? "border-red-500" : ""}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="no">لا</SelectItem>
                                <SelectItem value="yes">نعم</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>
      <div ref={printRef} />
    </div>
  );
}
