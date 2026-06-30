"use client";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { generateWeekNumber } from "@/lib/utils";
import { useSchoolYear } from "@/lib/hooks/use-school-year";
import { getWeekRangeLabel } from "@/lib/week-utils";
import { calculateMemorizationScore, calculateRevisionScore } from "@/lib/formulas/grading";
import { filterStudentsForCircleAtWeek } from "@/lib/circle-transfers";
import type { CircleTransfer } from "@/types/database";

interface Props {
  teachers: any[];
  initialStudents: any[];
}

export function TrackingClient({ teachers, initialStudents }: Props) {
  const { weekNumber: calculatedWeek, startDate } = useSchoolYear();
  const [circleId, setCircleId] = useState("");
  const [weekNumber, setWeekNumber] = useState(1);

  const [transfers, setTransfers] = useState<CircleTransfer[]>([]);
  useEffect(() => { if (calculatedWeek) setWeekNumber(calculatedWeek); }, [calculatedWeek]);
  useEffect(() => {
    fetch("/api/query?table=circle_transfers")
      .then((r) => r.json())
      .then((data) => setTransfers(data ?? []))
      .catch(() => {});
  }, []);
  const [data, setData] = useState<Record<string, { memorization_amount: number; revision_amount: number; ward_score: number; behavior_score: number }>>({});

  const selectedTeacher = useMemo(() => teachers.find((t: any) => t.id === circleId), [teachers, circleId]);
  const circleStudents = useMemo(() => filterStudentsForCircleAtWeek(initialStudents, transfers, circleId, weekNumber), [initialStudents, transfers, circleId, weekNumber]);
  const studentRequiredMap = useMemo(() => {
    const map: Record<string, { mem: number; rev: number }> = {};
    for (const s of initialStudents) {
      map[s.id] = { mem: s.required_memorization || 0.25, rev: s.required_revision || 0.25 };
    }
    return map;
  }, [initialStudents]);

  const loadData = async () => {
    if (!circleId) return;
    const ids = circleStudents.map((s: any) => s.id);
    if (ids.length === 0) return;
    const res = await fetch(`/api/query?table=weekly_tracking&student_ids=${ids.join(",")}&week_number=${weekNumber}`);
    const rows = await res.json();
    const map: Record<string, any> = {};
    for (const r of rows) map[r.student_id] = r;
    setData(map);
  };

  useEffect(() => { if (circleId) loadData(); }, [circleId, weekNumber, transfers]);

  const setField = (studentId: string, field: string, value: number) => {
    setData((prev) => {
      const existing = prev[studentId] ?? {};
      return { ...prev, [studentId]: { ...existing, [field]: value } };
    });
  };

  const saveAll = async () => {
    const records = circleStudents
      .filter((s) => data[s.id])
      .map((s) => {
        const d = data[s.id];
        return {
          student_id: s.id,
          week_number: weekNumber,
          memorization_amount: d.memorization_amount || 0,
          revision_amount: d.revision_amount || 0,
          ward_score: d.ward_score || 0,
          behavior_score: d.behavior_score || 0,
        };
      });
    if (records.length === 0) { toast.error("لا توجد بيانات للحفظ"); return; }
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "weekly_tracking", action: "upsert-many", data: records }),
    });
    toast.success("تم حفظ جميع البيانات");
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">متابعة الطلبة (الحفظ والمراجعة)</h2>
      <div className="flex gap-4">
        <div className="w-64">
          <Select value={circleId} onValueChange={setCircleId}>
            <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
            <SelectContent>
              {teachers.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Input type="number" value={weekNumber} onChange={(e) => setWeekNumber(parseInt(e.target.value) || 1)} />
        </div>
        {startDate && (
          <div className="flex items-center text-sm" style={{ color: "#7C5C1E" }}>
            {getWeekRangeLabel(startDate, weekNumber)}
          </div>
        )}
        <Button onClick={saveAll}>حفظ الكل</Button>
      </div>
      {circleId && selectedTeacher && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedTeacher.full_name} — الأسبوع {weekNumber}
              <span className="text-sm font-normal mr-4 text-muted-foreground">
                المستوى المطلوب: حسب إعدادات كل طالب
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>الحفظ (حزب)</TableHead>
                  <TableHead>المراجعة (حزب)</TableHead>
                  <TableHead>علامة الحفظ</TableHead>
                  <TableHead>علامة المراجعة</TableHead>
                  <TableHead>الورد (من 10)</TableHead>
                  <TableHead>السلوك (من 10)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {circleStudents.map((s: any) => {
                  const d = data[s.id];
                  const required = studentRequiredMap[s.id] || { mem: 0.25, rev: 0.25 };
                  const memAmount = d?.memorization_amount ?? 0;
                  const revAmount = d?.revision_amount ?? 0;
                  const memScore = calculateMemorizationScore(memAmount, required.mem);
                  const revScore = calculateRevisionScore(revAmount, required.rev);
                  return (
                    <TableRow key={s.id}>
                      <TableCell>{s.first_name} {s.last_name}</TableCell>
                      <TableCell><Input type="number" step="0.05" className="w-20 h-8" value={memAmount || ""}
                          onChange={(e) => setField(s.id, "memorization_amount", parseFloat(e.target.value) || 0)} /></TableCell>
                      <TableCell><Input type="number" step="0.05" className="w-20 h-8" value={revAmount || ""}
                          onChange={(e) => setField(s.id, "revision_amount", parseFloat(e.target.value) || 0)} /></TableCell>
                      <TableCell><Badge variant="outline">{memScore.toFixed(1)}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{revScore.toFixed(1)}</Badge></TableCell>
                      <TableCell><Input type="number" step="0.5" max="10" className="w-20 h-8" value={d?.ward_score ?? ""}
                          onChange={(e) => setField(s.id, "ward_score", parseFloat(e.target.value) || 0)} /></TableCell>
                      <TableCell><Input type="number" step="0.5" max="10" className="w-20 h-8" value={d?.behavior_score ?? ""}
                          onChange={(e) => setField(s.id, "behavior_score", parseFloat(e.target.value) || 0)} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
