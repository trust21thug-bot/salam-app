"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSchoolYear } from "@/lib/hooks/use-school-year";
import { filterStudentsForCircleAtWeek } from "@/lib/circle-transfers";
import type { CircleTransfer } from "@/types/database";

interface Props {
  students: any[];
  teachers: any[];
}

export function ReportsClient({ students: _students, teachers }: Props) {
  const { weekNumber: currentWeek } = useSchoolYear();
  const [weekStart, setWeekStart] = useState("1");
  const [weekEnd, setWeekEnd] = useState("1");
  const [circleFilter, setCircleFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [weekNumber, setWeekNumber] = useState("1");
  const [weekCircleFilter, setWeekCircleFilter] = useState("");
  const [weekSearchQuery, setWeekSearchQuery] = useState("");
  const [transfers, setTransfers] = useState<CircleTransfer[]>([]);

  useEffect(() => {
    if (currentWeek > 1) {
      setWeekEnd(String(currentWeek));
      setWeekNumber(String(currentWeek));
    }
  }, [currentWeek]);
  useEffect(() => {
    fetch("/api/query?table=circle_transfers")
      .then((r) => r.json())
      .then((data) => setTransfers(data ?? []))
      .catch(() => {});
  }, []);

  const filteredStudents = useMemo(() => {
    let result = _students;
    if (circleFilter) result = result.filter((s: any) => s.circle_id === circleFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s: any) =>
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
      );
    }
    return result;
  }, [_students, circleFilter, searchQuery]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">التقارير</h2>

      <Tabs defaultValue="semester">
        <TabsList>
          <TabsTrigger value="semester">المعدلات الفصلية</TabsTrigger>
          <TabsTrigger value="weekly">التقرير الأسبوعي</TabsTrigger>
          <TabsTrigger value="ranking">جدول الترتيب</TabsTrigger>
        </TabsList>

        <TabsContent value="semester">
          <Card>
            <CardHeader>
              <CardTitle>المعدل الفصلي</CardTitle>
              <p className="text-sm text-muted-foreground">حدد نطاق الأسابيع واختر الطالب لتوليد تقريره</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div>
                  <label className="text-sm">من أسبوع</label>
                  <Input type="number" className="w-28" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">إلى أسبوع</label>
                  <Input type="number" className="w-28" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">الحلقة</label>
                  <Select value={circleFilter} onValueChange={setCircleFilter}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="كل الحلقات" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">كل الحلقات</SelectItem>
                      {teachers.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">بحث</label>
                  <Input type="text" className="w-48" placeholder="ابحث بالاسم..."
                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الحلقة</TableHead>
                      <TableHead>معاينة التقرير</TableHead>
                      <TableHead>تحميل PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا يوجد طلبة</TableCell></TableRow>
                    ) : (
                      filteredStudents.map((s: any, idx: number) => {
                        const previewUrl = `/api/pdf/semester?student_id=${s.id}&start=${weekStart}&end=${weekEnd}`;
                        const teacher = teachers.find((t: any) => t.id === s.circle_id);
                        return (
                          <TableRow key={s.id}>
                            <TableCell><Badge variant="outline">{idx + 1}</Badge></TableCell>
                            <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                            <TableCell className="text-muted-foreground">{teacher?.full_name || "—"}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, "_blank")}>
                                معاينة
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" onClick={() => window.open(`${previewUrl}&download=1`, "_blank")}>
                                تحميل PDF
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly">
          <Card>
            <CardHeader>
              <CardTitle>التقرير الأسبوعي</CardTitle>
              <p className="text-sm text-muted-foreground">اختر الأسبوع والطالب لتوليد تقرير أسبوعي مفصل</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 flex-wrap items-end">
                <div>
                  <label className="text-sm">رقم الأسبوع</label>
                  <Input type="number" className="w-28" value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm">الحلقة</label>
                  <Select value={weekCircleFilter} onValueChange={(v) => setWeekCircleFilter(v === "__all__" ? "" : v)}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="كل الحلقات" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">كل الحلقات</SelectItem>
                      {teachers.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm">بحث</label>
                  <Input type="text" className="w-48" placeholder="ابحث بالاسم..."
                    value={weekSearchQuery} onChange={(e) => setWeekSearchQuery(e.target.value)} />
                </div>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الحلقة</TableHead>
                      <TableHead>معاينة التقرير</TableHead>
                      <TableHead>تحميل PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let result = _students;
                      if (weekCircleFilter) result = filterStudentsForCircleAtWeek(result, transfers, weekCircleFilter, Number(weekNumber));
                      if (weekSearchQuery) {
                        const q = weekSearchQuery.toLowerCase();
                        result = result.filter((s: any) =>
                          `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
                        );
                      }
                      return result;
                    })().length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">لا يوجد طلبة</TableCell></TableRow>
                    ) : (
                      (() => {
                        let result = _students;
                        if (weekCircleFilter) result = filterStudentsForCircleAtWeek(result, transfers, weekCircleFilter, Number(weekNumber));
                        if (weekSearchQuery) {
                          const q = weekSearchQuery.toLowerCase();
                          result = result.filter((s: any) =>
                            `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
                          );
                        }
                        return result;
                      })().map((s: any, idx: number) => {
                        const previewUrl = `/api/pdf/weekly?student_id=${s.id}&week=${weekNumber}`;
                        const teacher = teachers.find((t: any) => t.id === s.circle_id);
                        return (
                          <TableRow key={s.id}>
                            <TableCell><Badge variant="outline">{idx + 1}</Badge></TableCell>
                            <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                            <TableCell className="text-muted-foreground">{teacher?.full_name || "—"}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm" onClick={() => window.open(previewUrl, "_blank")}>
                                معاينة
                              </Button>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" onClick={() => window.open(`${previewUrl}&download=1`, "_blank")}>
                                تحميل PDF
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ranking">
          <Card>
            <CardHeader><CardTitle>جدول الترتيب الأسبوعي للطباعة</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-4 items-end">
                <div>
                  <label className="text-sm">رقم الأسبوع</label>
                  <Input type="number" value={weekNumber} onChange={(e) => setWeekNumber(e.target.value)} className="w-28" />
                </div>
                <Button onClick={() => toast.success("سيتم تحميل جدول الترتيب قريبًا")}>
                  تحميل PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
