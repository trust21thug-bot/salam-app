"use client";

import { useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { getCurrentWeekNumber, formatWeekDay } from "@/lib/week-utils";

interface Props {
  teachers: any[];
  students: any[];
  attendance: any[];
  schoolYear: any[];
}

export function MonitoringClient({ teachers, students, attendance, schoolYear }: Props) {
  const router = useRouter();
  const startDate = schoolYear?.[0]?.start_date ? new Date(schoolYear[0].start_date) : null;
  const currentWeek = startDate ? getCurrentWeekNumber(startDate) : 19;

  const circleMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const t of teachers) map[t.id] = t;
    return map;
  }, [teachers]);

  const studentsByCircle = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const s of students) {
      if (!map[s.circle_id]) map[s.circle_id] = [];
      map[s.circle_id].push(s);
    }
    return map;
  }, [students]);

  const attByStudent = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const a of attendance) {
      if (!map[a.student_id]) map[a.student_id] = new Set();
      map[a.student_id].add(`${a.week_number}_${a.day_of_week}`);
    }
    return map;
  }, [attendance]);

  const missingDaysByCircle = useMemo(() => {
    const result: Record<string, { week: number; day: number }[]> = {};
    for (const t of teachers) {
      const teachingDays: number[] = t.teaching_days ?? [];
      if (teachingDays.length === 0) continue;
      const circleStudents = studentsByCircle[t.id] || [];
      const found: Set<string> = new Set();
      for (const s of circleStudents) {
        const studentKeys = attByStudent[s.id] || new Set();
        for (let w = 1; w <= currentWeek; w++) {
          for (const day of teachingDays) {
            if (!studentKeys.has(`${w}_${day}`)) found.add(`${w}_${day}`);
          }
        }
      }
      const days = Array.from(found).map((k) => {
        const [w, d] = k.split("_").map(Number);
        return { week: w, day: d };
      });
      days.sort((a, b) => a.week - b.week || a.day - b.day);
      result[t.id] = days;
    }
    return result;
  }, [teachers, studentsByCircle, attByStudent, currentWeek]);

  const [expandedMissing, setExpandedMissing] = useState<Record<string, boolean>>({});

  const allAbsentStudents = useMemo(() => {
    const absentMap: Record<string, { student: any; absences: any[] }> = {};
    for (const a of attendance) {
      if (a.status === "absent") {
        if (!absentMap[a.student_id]) {
          const s = students.find((st: any) => st.id === a.student_id);
          absentMap[a.student_id] = { student: s || null, absences: [] };
        }
        absentMap[a.student_id].absences.push(a);
      }
    }
    return Object.values(absentMap).filter((e: any) => e.student);
  }, [attendance, students]);

  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const [justifying, setJustifying] = useState<Record<string, boolean>>({});

  const justifyAbsence = async (recordId: string, newStatus: string) => {
    setJustifying((prev) => ({ ...prev, [recordId]: true }));
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: "attendance_records",
          action: "upsert",
          data: { id: recordId, status: newStatus },
        }),
      });
      const result = await res.json();
      if (result.error) { toast.error("فشل التبرير"); return; }
      toast.success("تم تبرير الغياب");
    } catch {
      toast.error("فشل التبرير");
    } finally {
      setJustifying((prev) => ({ ...prev, [recordId]: false }));
    }
  };

  function getAttendanceStatus(circleId: string): "تم" | "ناقص" {
    const circleStudents = studentsByCircle[circleId] || [];
    if (circleStudents.length === 0) return "تم";
    const teacher = circleMap[circleId];
    const teachingDays: number[] = teacher?.teaching_days ?? [];
    if (teachingDays.length === 0) return "تم";
    for (const s of circleStudents) {
      const studentKeys = attByStudent[s.id] || new Set();
      for (let w = 1; w <= currentWeek; w++) {
        for (const day of teachingDays) {
          if (!studentKeys.has(`${w}_${day}`)) return "ناقص";
        }
      }
    }
    return "تم";
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">المتابعة</h2>
      <div className="grid gap-6">
        {teachers.map((teacher: any) => {
          const attStatus = getAttendanceStatus(teacher.id);
          const circleStudents = studentsByCircle[teacher.id] || [];
          return (
            <Card key={teacher.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{teacher.full_name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={attStatus === "تم" ? "default" : "destructive"}>
                      تسجيل الغياب: {attStatus}
                    </Badge>
                    {attStatus === "ناقص" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() =>
                          setExpandedMissing((p) => ({
                            ...p,
                            [teacher.id]: !p[teacher.id],
                          }))
                        }
                      >
                        {expandedMissing[teacher.id] ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                      </Button>
                    )}
                  </div>
                </CardTitle>
                {attStatus === "ناقص" && expandedMissing[teacher.id] && (
                  <div className="mt-2 border rounded-md p-3 bg-muted/20">
                    <p className="text-xs font-semibold mb-2">الأيام الناقصة (اضغط للذهاب إلى الغياب):</p>
                    <div className="flex flex-wrap gap-2">
                      {(missingDaysByCircle[teacher.id] || []).map((md) => (
                        <Button
                          key={`${md.week}_${md.day}`}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            router.push(
                              `/attendance?circle=${teacher.id}&week=${md.week}&day=${md.day}`
                            )
                          }
                        >
                          {startDate ? formatWeekDay(startDate, md.week, md.day) : `الأسبوع ${md.week} - ${DAY_NAMES[md.day]}`}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  عدد الطلاب: {circleStudents.length}
                </p>
                {/* Absent students list */}
                {allAbsentStudents.filter((e: any) => e.student.circle_id === teacher.id).length === 0 ? (
                  <p className="text-sm text-green-600">لا يوجد تلاميذ متغيبون دون عذر</p>
                ) : (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">التلاميذ المتغيبون (غير مبرر):</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>اللقب</TableHead>
                          <TableHead>الاسم</TableHead>
                          <TableHead>رقم الولي</TableHead>
                          <TableHead>عدد الغيابات</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allAbsentStudents
                          .filter((e: any) => e.student.circle_id === teacher.id)
                          .map((entry: any) => (
                            <Fragment key={entry.student.id}>
                              <TableRow>
                                <TableCell>{entry.student.last_name}</TableCell>
                                <TableCell>{entry.student.first_name}</TableCell>
                                <TableCell dir="ltr">{entry.student.guardian_phone}</TableCell>
                                <TableCell>
                                  <Badge variant="destructive">{entry.absences.length}</Badge>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setExpandedStudent(
                                        expandedStudent === entry.student.id ? null : entry.student.id
                                      )
                                    }
                                  >
                                    {expandedStudent === entry.student.id ? "إخفاء" : "عرض التفاصيل"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                              {expandedStudent === entry.student.id && (
                                <TableRow>
                                  <TableCell colSpan={5} className="p-0">
                                    <div className="border-t bg-muted/30 p-3">
                                      {entry.absences.map((rec: any) => (
                                        <div
                                          key={rec.id}
                                          className="flex items-center justify-between py-2 border-b last:border-0"
                                        >
                                          <span className="text-sm">
                                            {startDate ? formatWeekDay(startDate, rec.week_number, rec.day_of_week) : `الأسبوع ${rec.week_number} - اليوم ${["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][rec.day_of_week]}`}
                                          </span>
                                          <div className="flex gap-2">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              disabled={justifying[rec.id]}
                                              onClick={() => justifyAbsence(rec.id, "excused_accepted")}
                                            >
                                              تبرير مقبول
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              disabled={justifying[rec.id]}
                                              onClick={() => justifyAbsence(rec.id, "excused_rejected")}
                                            >
                                              تبرير غير مقبول
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}