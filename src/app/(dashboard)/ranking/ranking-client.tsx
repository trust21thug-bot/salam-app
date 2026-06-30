"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { generateWeekNumber, CLASSIFICATION_LABELS } from "@/lib/utils";
import { useSchoolYear } from "@/lib/hooks/use-school-year";
import { getWeekRangeLabel } from "@/lib/week-utils";

interface Props {
  groups: any[];
  teachers: any[];
  students: any[];
}

export function RankingClient({ groups, teachers: _teachers, students: _students }: Props) {
  const { weekNumber: calculatedWeek, startDate } = useSchoolYear();
  const [weekNumber, setWeekNumber] = useState(1);

  useEffect(() => { if (calculatedWeek) setWeekNumber(calculatedWeek); }, [calculatedWeek]);
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id ?? "");
  const [weeklyRankings, setWeeklyRankings] = useState<any[]>([]);
  const [generalRankings, setGeneralRankings] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [monthlyGroup, setMonthlyGroup] = useState(groups[0]?.id ?? "");
  const [monthlyRankings, setMonthlyRankings] = useState<any[]>([]);
  const [monthStart, setMonthStart] = useState("1");
  const [monthEnd, setMonthEnd] = useState("5");

  const studentMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const s of _students) map[s.id] = s;
    return map;
  }, [_students]);
  const circleMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of _teachers) map[t.id] = t.full_name;
    return map;
  }, [_teachers]);

  const loadWeekly = async () => {
    if (!selectedGroup) return;
    const res = await fetch(`/api/query?table=weekly_rankings&group_id=${encodeURIComponent(selectedGroup)}&week_number=${weekNumber}`);
    let rows: any[] = await res.json();
    rows.sort((a, b) => ((b.total_score || 0) + (b.manual_adjustment || 0)) - ((a.total_score || 0) + (a.manual_adjustment || 0)));
    rows.forEach((r, i) => { r.rank_position = i + 1; });
    setWeeklyRankings(rows);
  };

  const loadGeneral = async () => {
    const res = await fetch("/api/query?table=general_rankings");
    setGeneralRankings(await res.json());
  };

  const loadMonthly = async () => {
    if (!monthlyGroup) return;
    const start = parseInt(monthStart) || 1;
    const end = parseInt(monthEnd) || 1;
    if (start > end) { toast.error("بداية النطاق أكبر من نهايته"); return; }
    const seen = new Set<string>();
    const all: any[] = [];
    for (let w = start; w <= end; w++) {
      const res = await fetch(`/api/query?table=weekly_rankings&group_id=${encodeURIComponent(monthlyGroup)}&week_number=${w}`);
      const data = await res.json();
      for (const r of (data ?? [])) {
        const key = `${r.student_id}_${r.week_number}`;
        if (!seen.has(key)) { seen.add(key); all.push(r); }
      }
    }
    const grouped: Record<string, any[]> = {};
    for (const r of all) {
      if (!grouped[r.student_id]) grouped[r.student_id] = [];
      grouped[r.student_id].push(r);
    }
    const monthly: any[] = Object.entries(grouped).map(([studentId, rows]) => {
      const total = rows.reduce((s, r) => s + (r.total_score || 0), 0);
      return {
        student_id: studentId,
        total_score: total,
        avg_score: rows.length ? (total / rows.length).toFixed(1) : "0.0",
        weeks_count: rows.length,
        weeks: rows.map((r) => r.week_number).join(", "),
      };
    });
    monthly.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
    setMonthlyRankings(monthly);
  };

  useEffect(() => { loadWeekly(); }, [selectedGroup, weekNumber]);
  useEffect(() => { loadGeneral(); }, []);
  useEffect(() => { loadMonthly(); }, [monthlyGroup, monthStart, monthEnd]);

  const setAdjustment = (studentId: string, val: number) => {
    setAdjustments((prev) => ({ ...prev, [studentId]: val }));
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">الترتيب</h2>

      <Tabs defaultValue="weekly">
        <TabsList>
          <TabsTrigger value="weekly">الترتيب الأسبوعي</TabsTrigger>
          <TabsTrigger value="monthly">الترتيب الشهري</TabsTrigger>
          <TabsTrigger value="general">الترتيب العام</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly">
          <div className="flex gap-4 mb-4">
            <div className="w-64">
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger><SelectValue placeholder="اختر مجموعة" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Input type="number" value={weekNumber} onChange={(e) => setWeekNumber(parseInt(e.target.value) || 1)} />
            </div>
            {startDate && (
              <span className="text-sm" style={{ color: "#7C5C1E" }}>
                {getWeekRangeLabel(startDate, weekNumber)}
              </span>
            )}
            <Button onClick={async () => {
              if (!selectedGroup) { toast.error("اختر مجموعة أولاً"); return; }
              const group = groups.find((g: any) => g.id === selectedGroup);
              if (!group) return;
              const circleIds = group.circle_ids || [];
              try {
                const res = await fetch("/api/query", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    table: "weekly_rankings",
                    action: "calculate",
                    group_id: selectedGroup,
                    week_number: weekNumber,
                    circle_ids: circleIds,
                  }),
                });
                const result = await res.json();
                if (result.error) { toast.error(result.error); return; }
                toast.success("تم حساب الترتيب بنجاح");
                loadWeekly();
              } catch { toast.error("فشل حساب الترتيب"); }
            }}>
              حساب الترتيب
            </Button>
            <Button variant="outline" onClick={loadWeekly}>تحديث</Button>
            <Button variant="outline" onClick={() => {
              if (!selectedGroup) { toast.error("اختر مجموعة أولاً"); return; }
              window.open(`/api/pdf/ranking?type=weekly&group_id=${encodeURIComponent(selectedGroup)}&week=${weekNumber}`, "_blank");
            }}>PDF</Button>
            <Button variant="outline" onClick={() => {
              if (!selectedGroup) { toast.error("اختر مجموعة أولاً"); return; }
              window.open(`/api/pdf/ranking?type=weekly&group_id=${encodeURIComponent(selectedGroup)}&week=${weekNumber}&download=1`, "_blank");
            }}>تحميل PDF</Button>
            <Button variant="secondary" onClick={async () => {
              try {
                for (const r of weeklyRankings) {
                  const adj = adjustments[r.student_id];
                  if (adj == null || adj === (r.manual_adjustment ?? 0)) continue;
                  await fetch("/api/query", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      table: "weekly_rankings",
                      action: "upsert",
                      data: { id: r.id, manual_adjustment: adj },
                    }),
                  });
                }
                setAdjustments({});
                toast.success("تم حفظ التعديلات");
                loadWeekly();
              } catch { toast.error("فشل حفظ التعديلات"); }
            }}>حفظ التعديلات</Button>
          </div>

          <Card>
            <CardHeader><CardTitle>الترتيب الأسبوعي</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>الطالب</TableHead>
                    <TableHead>الحلقة</TableHead>
                    <TableHead>الحفظ والمراجعة (×5)</TableHead>
                    <TableHead>الورد (×4)</TableHead>
                    <TableHead>السلوك (×2)</TableHead>
                    <TableHead>الحضور (×3)</TableHead>
                    <TableHead>تعديل يدوي</TableHead>
                    <TableHead>المجموع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weeklyRankings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        لا توجد بيانات ترتيب. قم بحساب الترتيب أولاً.
                      </TableCell>
                    </TableRow>
                  ) : (
                    weeklyRankings.map((r: any, idx: number) => {
                      const s = studentMap[r.student_id];
                      return (
                      <TableRow key={r.id}>
                        <TableCell><Badge>{r.rank_position || idx + 1}</Badge></TableCell>
                        <TableCell>{s?.first_name} {s?.last_name}</TableCell>
                        <TableCell>{circleMap[s?.circle_id] || ""}</TableCell>
                        <TableCell>{(Math.min((r.memorization_score || 0) + (r.revision_score || 0), 10)).toFixed(1)}</TableCell>
                        <TableCell>{(r.ward_score || 0).toFixed(1)}</TableCell>
                        <TableCell>{(r.behavior_score || 0).toFixed(1)}</TableCell>
                        <TableCell>{(r.attendance_score || 0).toFixed(1)}</TableCell>
                        <TableCell>
                          <Input type="number" step="0.1" className="w-20 h-8"
                            value={adjustments[r.student_id] ?? r.manual_adjustment ?? 0}
                            onChange={(e) => setAdjustment(r.student_id, parseFloat(e.target.value) || 0)} />
                        </TableCell>
                        <TableCell className="font-bold">{((r.total_score || 0) + (adjustments[r.student_id] ?? r.manual_adjustment ?? 0)).toFixed(1)}</TableCell>
                      </TableRow>
                    );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <div className="flex gap-4 mb-4">
            <div className="w-64">
              <Select value={monthlyGroup} onValueChange={setMonthlyGroup}>
                <SelectTrigger><SelectValue placeholder="اختر مجموعة" /></SelectTrigger>
                <SelectContent>
                  {groups.map((g: any) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-28">
              <label className="text-xs text-muted-foreground block mb-1">من أسبوع</label>
              <Input type="number" value={monthStart} min={1}
                onChange={(e) => setMonthStart(e.target.value)} />
            </div>
            <div className="w-28">
              <label className="text-xs text-muted-foreground block mb-1">إلى أسبوع</label>
              <Input type="number" value={monthEnd} min={1}
                onChange={(e) => setMonthEnd(e.target.value)} />
            </div>
            <Button variant="outline" className="self-end" onClick={loadMonthly}>تطبيق</Button>
            <Button variant="outline" className="self-end" onClick={() => {
              if (!monthlyGroup) { toast.error("اختر مجموعة أولاً"); return; }
              window.open(`/api/pdf/ranking?type=monthly&group_id=${encodeURIComponent(monthlyGroup)}&week_start=${monthStart}&week_end=${monthEnd}`, "_blank");
            }}>PDF</Button>
            <Button variant="outline" className="self-end" onClick={() => {
              if (!monthlyGroup) { toast.error("اختر مجموعة أولاً"); return; }
              window.open(`/api/pdf/ranking?type=monthly&group_id=${encodeURIComponent(monthlyGroup)}&week_start=${monthStart}&week_end=${monthEnd}&download=1`, "_blank");
            }}>تحميل PDF</Button>
          </div>
          <Card>
            <CardHeader><CardTitle>الترتيب الشهري</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>الطالب</TableHead>
                    <TableHead>المجموع الكلي</TableHead>
                    <TableHead>المعدل</TableHead>
                    <TableHead>عدد الأسابيع</TableHead>
                    <TableHead>الأسابيع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyRankings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        لا توجد بيانات
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthlyRankings.map((r: any, idx: number) => (
                      <TableRow key={r.student_id}>
                        <TableCell><Badge>{idx + 1}</Badge></TableCell>
                        <TableCell>{studentMap[r.student_id]?.first_name} {studentMap[r.student_id]?.last_name}</TableCell>
                        <TableCell className="font-bold">{(r.total_score || 0).toFixed(1)}</TableCell>
                        <TableCell>{(parseFloat(r.avg_score) || 0).toFixed(1)}</TableCell>
                        <TableCell>{r.weeks_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.weeks}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <div className="flex gap-2 mb-4">
            <Button onClick={async () => {
              try {
                const res = await fetch("/api/query", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ table: "general_rankings", action: "recalculate-general" }),
                });
                const result = await res.json();
                if (result.error) { toast.error(result.error); return; }
                toast.success("تم حساب الترتيب العام بنجاح");
                loadGeneral();
              } catch { toast.error("فشل حساب الترتيب العام"); }
            }}>
              حساب الترتيب العام
            </Button>
            <Button variant="outline" onClick={loadGeneral}>تحديث</Button>
            <Button variant="outline" onClick={() => window.open("/api/pdf/ranking?type=general", "_blank")}>PDF</Button>
            <Button variant="outline" onClick={() => window.open("/api/pdf/ranking?type=general&download=1", "_blank")}>تحميل PDF</Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>الترتيب العام</CardTitle>
              <p className="text-sm text-muted-foreground">يعتمد على إجمالي الحفظ والمراجعة والورد والسلوك والحضور.</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>الطالب</TableHead>
                    <TableHead>الحفظ الكلي (حزب)</TableHead>
                    <TableHead>نسبة الضبط (%)</TableHead>
                    <TableHead>المجموع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generalRankings.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell><Badge>{r.rank_position}</Badge></TableCell>
                      <TableCell>{studentMap[r.student_id]?.first_name} {studentMap[r.student_id]?.last_name}</TableCell>
                      <TableCell>{(r.total_memorization || 0).toFixed(1)}</TableCell>
                        <TableCell>{(r.master_evaluation || 0).toFixed(1)}</TableCell>
                        <TableCell className="font-bold">{(r.total_score || 0).toFixed(1)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
