"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import * as Dialog from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Trip, TripStudent, Student, Teacher, SchoolMember } from "@/types/database";
import { getAge, ACADEMIC_LEVELS, FILE_STATUS_LABELS } from "@/lib/utils";

interface EnrichedStudent {
  id: string;
  first_name: string;
  last_name: string;
  circle_id: string;
  birth_date: string;
  academic_level: string;
  insurance: boolean | null;
  file_status: string | null;
  guardian_phone: string;
}

interface AttendanceRow {
  student_id: string;
  status: string;
}

interface Props {
  trips: Trip[];
  teachers: Pick<Teacher, "id" | "full_name">[];
  students: EnrichedStudent[];
  attendance: AttendanceRow[];
  schoolYear: { start_date: string } | null;
  schoolMembers: SchoolMember[];
}

function unjustifiedCount(studentId: string, attendance: AttendanceRow[]): number {
  return attendance.filter(
    (a) => a.student_id === studentId && (a.status === "absent" || a.status === "late" || a.status === "excused_rejected")
  ).length;
}

export function TripsClient({ trips: initialTrips, teachers, students, attendance, schoolYear, schoolMembers }: Props) {
  const [trips, setTrips] = useState(initialTrips);
  const [open, setOpen] = useState(false);
  const [editTripId, setEditTripId] = useState<string | null>(null);

  const [date, setDate] = useState("");
  const [destination, setDestination] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [cost, setCost] = useState("0");
  const [tripStudents, setTripStudents] = useState<Record<string, { allowed: boolean; reason: string; notified: boolean; subscription_paid: boolean }>>({});
  const [allowedDialogOpen, setAllowedDialogOpen] = useState(false);
  const [allowedList, setAllowedList] = useState<(EnrichedStudent & { subscription_paid: boolean })[]>([]);
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);
  const [managerId, setManagerId] = useState<string | null>(null);

  const studentsByCircle = useMemo(() => {
    const m: Record<string, typeof students> = {};
    for (const s of students) {
      if (!m[s.circle_id]) m[s.circle_id] = [];
      m[s.circle_id].push(s);
    }
    return m;
  }, [students]);

  const totalParticipants = useMemo(() => 
    Object.values(tripStudents).filter((v) => v.allowed).length,
  [tripStudents]);

  const resetForm = () => {
    setDate(""); setDestination(""); setDepartureTime(""); setCost("0"); setTripStudents({}); setEditTripId(null); setManagerId(null);
  };

  const loadTrip = async (tripId: string) => {
    const [studentsRes, supervisorsRes] = await Promise.all([
      fetch(`/api/query?table=trip_students&trip_id=${tripId}`),
      fetch(`/api/query?table=trip_supervisors&trip_id=${tripId}`),
    ]);
    const data = await studentsRes.json();
    const ts: Record<string, { allowed: boolean; reason: string; notified: boolean; subscription_paid: boolean }> = {};
    for (const row of data) {
      ts[row.student_id] = { allowed: row.allowed, reason: row.reason ?? "", notified: row.notified ?? false, subscription_paid: row.subscription_paid ?? false };
    }
    for (const s of students) {
      if (!ts[s.id]) ts[s.id] = { allowed: false, reason: "", notified: false, subscription_paid: false };
    }
    setTripStudents(ts);
    const sv = await supervisorsRes.json();
    setSelectedSupervisors(sv.map((r: any) => r.school_member_id));
  };

  const openAllowedList = async (tripId: string) => {
    const res = await fetch(`/api/query?table=trip_students&trip_id=${tripId}`);
    const data: any[] = await res.json();
    const allowedIds = data.filter((r) => r.allowed).map((r) => r.student_id);
    const subMap: Record<string, boolean> = {};
    for (const r of data) {
      if (r.allowed) subMap[r.student_id] = r.subscription_paid ?? false;
    }
    setAllowedList(
      students.filter((s) => allowedIds.includes(s.id)).map((s) => ({ ...s, subscription_paid: subMap[s.id] ?? false }))
    );
    setCurrentTripId(tripId);
    setAllowedDialogOpen(true);
  };

  const printSupervisors = async (trip: Trip) => {
    const res = await fetch(`/api/query?table=trip_supervisors&trip_id=${trip.id}`);
    const data = await res.json();
    const members = data.map((r: any) => schoolMembers.find((m) => m.id === r.school_member_id)).filter(Boolean);
    if (members.length === 0) { toast.error("لا يوجد مؤطرون محددون لهذه الرحلة"); return; }
    const rows = members.map((m: SchoolMember, i: number) =>
      `<tr><td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${i + 1}</td><td style="padding:5px 8px;border:1px solid #ddd">${m.first_name}</td><td style="padding:5px 8px;border:1px solid #ddd">${m.last_name}</td><td style="padding:5px 8px;border:1px solid #ddd;direction:ltr">${m.phone}</td></tr>`
    ).join("");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>مؤطرو الرحلة - ${trip.destination}</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet"><style>@page{size:A4 portrait;margin:0.6cm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Tajawal',sans-serif;font-size:16px;color:#333}.header{background:linear-gradient(135deg,#1b5e20,#2e7d32);padding:14px 18px;color:#fff;text-align:center}.header h1{font-size:22px;font-weight:800}.header .divider{height:2px;background:#c8a45c;width:50px;margin:4px auto}.header .subtitle{font-size:16px;opacity:0.9;margin-top:3px}table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}th{background:#f0fdf4;padding:8px 6px;border:1px solid #ddd;font-weight:700;font-size:14px}td{padding:6px 6px;border:1px solid #ddd}tr:nth-child(even){background:#fafafa}.footer{text-align:center;padding:12px;font-size:11px;color:#999;margin-top:16px}</style></head><body><div class="header"><h1>قائمة المؤطرين</h1><div class="divider"></div><div class="subtitle">${trip.destination} — ${trip.date}</div></div><table><thead><tr><th>#</th><th>الاسم</th><th>اللقب</th><th>رقم الهاتف</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">مدرسة السلام القرآنية — تم التوليد ${new Date().toLocaleDateString("ar-SA")}</div><script>window.onload=()=>setTimeout(()=>window.print(),500)</script></body></html>`);
    win.document.close();
  };

  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = async (t: Trip) => {
    setEditTripId(t.id);
    setDate(t.date);
    setDestination(t.destination);
    setDepartureTime(t.departure_time ?? "");
    setCost(String(t.cost ?? 0));
    setManagerId(t.manager_id ?? null);
    await loadTrip(t.id);
    setOpen(true);
  };

  // Save trip + students + supervisors in the background, close dialog immediately
  const save = async () => {
    if (!date || !destination) return;
    const tripData = { date, destination, departure_time: departureTime || null, cost: Number(cost) || 0, manager_id: managerId || null };
    setOpen(false);
    resetForm();
    try {
      let tripId = editTripId;
      if (tripId) {
        await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "trips", action: "update", match: { id: tripId }, data: tripData }) });
      } else {
        const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: "trips", action: "insert", data: tripData }) });
        const r = await res.json();
        tripId = r.id ?? r[0]?.id;
      }
      const promises: Promise<any>[] = [];
      if (tripId) {
        for (const [studentId, v] of Object.entries(tripStudents)) {
          promises.push(
            (async () => {
              const existing = await fetch(`/api/query?table=trip_students&trip_id=${tripId}&student_id=${studentId}`).then(r => r.json());
              const payload = { allowed: v.allowed, reason: v.reason || null, notified: v.notified, subscription_paid: v.subscription_paid };
              if (existing.length > 0) {
                await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ table: "trip_students", action: "update", match: { trip_id: tripId, student_id: studentId }, data: payload }) });
              } else {
                await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ table: "trip_students", action: "insert", data: { trip_id: tripId, student_id: studentId, ...payload } }) });
              }
            })()
          );
        }
        promises.push(
          fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ table: "trip_supervisors", action: "delete", data: { match: { trip_id: tripId } } }) }).then(),
        );
        for (const memberId of selectedSupervisors) {
          promises.push(
            fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ table: "trip_supervisors", action: "insert", data: { trip_id: tripId, school_member_id: memberId } }) }).then(),
          );
        }
      }
      await Promise.all(promises);
    } catch (e) {
      console.error("Background save error:", e);
    }
    const res = await fetch("/api/query?table=trips&order=date.desc");
    setTrips(await res.json());
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">الرحلات</h2>
        <Button onClick={openNew}>إضافة رحلة</Button>
      </div>

      <Dialog.Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
        <Dialog.DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
          <Dialog.DialogHeader>
            <Dialog.DialogTitle>{editTripId ? "تعديل الرحلة" : "إضافة رحلة"}</Dialog.DialogTitle>
          </Dialog.DialogHeader>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div>
              <Label>التاريخ</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>الوجهة</Label>
              <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="الوجهة" />
            </div>
            <div>
              <Label>وقت الانطلاق</Label>
              <Input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} />
            </div>
            <div>
              <Label>التكلفة (دج)</Label>
              <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <span className="font-semibold">إجمالي المشاركين: {totalParticipants}</span>
          </div>

          {schoolMembers.length > 0 && (
            <div className="mb-4 p-3 border rounded-md space-y-3">
              <div>
                <p className="text-sm font-semibold mb-2">مدير الرحلة:</p>
                <div className="flex flex-wrap gap-2">
                  {schoolMembers.map((m) => (
                    <Button key={m.id} type="button" variant={managerId === m.id ? "default" : "outline"} size="sm" onClick={() => setManagerId((prev) => prev === m.id ? null : m.id)}>
                      {m.first_name} {m.last_name}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">المؤطرون:</p>
                <div className="flex flex-wrap gap-2">
                  {schoolMembers.map((m) => (
                    <Button key={m.id} type="button" variant={selectedSupervisors.includes(m.id) ? "default" : "outline"} size="sm" onClick={() => setSelectedSupervisors((prev) => prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id])}>
                      {m.first_name} {m.last_name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {teachers.map((t) => {
            const circleStudents = studentsByCircle[t.id] ?? [];
            if (circleStudents.length === 0) return null;
            return (
              <Card key={t.id} className="mb-4">
                <CardHeader><CardTitle className="text-lg">{t.full_name}</CardTitle></CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">#</TableHead>
                        <TableHead className="whitespace-nowrap">الاسم</TableHead>
                        <TableHead className="whitespace-nowrap">اللقب</TableHead>
                        <TableHead className="whitespace-nowrap">الرقم</TableHead>
                        <TableHead className="whitespace-nowrap">العمر</TableHead>
                        <TableHead className="whitespace-nowrap">المستوى</TableHead>
                        <TableHead className="whitespace-nowrap">التأمين</TableHead>
                        <TableHead className="whitespace-nowrap">حالة الملف</TableHead>
                        <TableHead className="whitespace-nowrap">غيابات غير مبررة</TableHead>
                        <TableHead className="whitespace-nowrap">مسموح</TableHead>
                        <TableHead className="whitespace-nowrap">السبب</TableHead>
                        <TableHead className="whitespace-nowrap">تم الإبلاغ</TableHead>
                        <TableHead className="whitespace-nowrap">دفع الاشتراك</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {circleStudents.map((s, idx) => {
                        const ts = tripStudents[s.id] ?? { allowed: false, reason: "", notified: false, subscription_paid: false };
                        const uCount = unjustifiedCount(s.id, attendance);
                        return (
                          <TableRow key={s.id}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell className="whitespace-nowrap">{s.first_name}</TableCell>
                            <TableCell className="whitespace-nowrap">{s.last_name}</TableCell>
                            <TableCell className="whitespace-nowrap" dir="ltr">{s.guardian_phone}</TableCell>
                            <TableCell className="whitespace-nowrap">{getAge(s.birth_date)} سنة</TableCell>
                            <TableCell className="whitespace-nowrap">{ACADEMIC_LEVELS[s.academic_level] || s.academic_level}</TableCell>
                            <TableCell>
                              {s.insurance ? <Badge variant="outline" className="border-0" style={{ backgroundColor: "#99FF99", color: "#003300" }}>نعم</Badge> : <Badge variant="destructive">لا</Badge>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {s.file_status ? <Badge variant="secondary">{FILE_STATUS_LABELS[s.file_status] || s.file_status}</Badge> : <span className="text-muted-foreground text-sm">—</span>}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className={uCount > 5 ? "text-red-600 font-bold" : ""}>{uCount}</span>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Button type="button" variant={ts.allowed ? "default" : "outline"} size="sm" className="w-16 text-xs" onClick={() => setTripStudents((prev) => ({ ...prev, [s.id]: { ...prev[s.id] ?? { reason: "", notified: false }, allowed: !ts.allowed } }))}>
                                {ts.allowed ? "نعم" : "لا"}
                              </Button>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Input value={ts.reason} onChange={(e) => setTripStudents((prev) => ({ ...prev, [s.id]: { ...prev[s.id] ?? { allowed: false, notified: false }, reason: e.target.value } }))} placeholder="السبب" disabled={ts.allowed} className="min-w-[100px]" />
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Button type="button" variant={ts.notified ? "default" : "outline"} size="sm" className="w-16 text-xs" disabled={!ts.allowed} onClick={() => setTripStudents((prev) => ({ ...prev, [s.id]: { ...prev[s.id] ?? { allowed: false, reason: "", subscription_paid: false }, notified: !ts.notified } }))}>
                                {ts.notified ? "نعم" : "لا"}
                              </Button>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Button type="button" variant={ts.subscription_paid ? "default" : "outline"} size="sm" className="w-16 text-xs" disabled={!ts.allowed} onClick={() => setTripStudents((prev) => ({ ...prev, [s.id]: { ...prev[s.id] ?? { allowed: false, reason: "", notified: false }, subscription_paid: !ts.subscription_paid } }))}>
                                {ts.subscription_paid ? "نعم" : "لا"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>إلغاء</Button>
            <Button onClick={save}>حفظ</Button>
          </div>
        </Dialog.DialogContent>
      </Dialog.Dialog>

      <Dialog.Dialog open={allowedDialogOpen} onOpenChange={setAllowedDialogOpen}>
        <Dialog.DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <Dialog.DialogHeader>
            <Dialog.DialogTitle>قائمة التلاميذ المسموح لهم</Dialog.DialogTitle>
          </Dialog.DialogHeader>
          {allowedList.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا يوجد تلاميذ مسموح لهم</p>
          ) : (
            teachers.map((t) => {
              const circleIds = new Set(allowedList.filter((s) => s.circle_id === t.id).map((s) => s.id));
              if (circleIds.size === 0) return null;
              return (
                <Card key={t.id} className="mb-4">
                  <CardHeader><CardTitle className="text-lg">{t.full_name}</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>الاسم</TableHead>
                          <TableHead>اللقب</TableHead>
                          <TableHead>رقم الولي</TableHead>
                          <TableHead>دفع الاشتراك</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allowedList.filter((s) => s.circle_id === t.id).map((s, idx) => (
                          <TableRow key={s.id}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>{s.first_name}</TableCell>
                            <TableCell>{s.last_name}</TableCell>
                            <TableCell dir="ltr">{s.guardian_phone}</TableCell>
                            <TableCell>
                              {s.subscription_paid ? <Badge variant="default" className="bg-green-600">نعم</Badge> : <Badge variant="destructive">لا</Badge>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAllowedDialogOpen(false); setCurrentTripId(null); }}>إغلاق</Button>
            {currentTripId && (
              <Button onClick={() => window.open(`/api/pdf/trips?trip_id=${currentTripId}&download=1`, "_blank")}>تحميل PDF</Button>
            )}
          </div>
        </Dialog.DialogContent>
      </Dialog.Dialog>

      <div className="grid gap-4">
        {trips.map((t) => (
          <Card key={t.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">{t.destination} — {t.date}</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openAllowedList(t.id)}>قائمة المسموح لهم</Button>
                <Button variant="outline" size="sm" onClick={() => printSupervisors(t)}>طباعة المؤطرين</Button>
                <Button variant="outline" size="sm" onClick={() => window.open(`/api/docx/mission?trip_id=${t.id}`, "_blank")}>Word</Button>
                <Button variant="outline" size="sm" onClick={() => window.open(`/api/pdf/mission?trip_id=${t.id}&download=true`, "_blank")}>PDF</Button>
                <Button variant="outline" size="sm" onClick={() => openEdit(t)}>عرض / تعديل</Button>
                <Button variant="destructive" size="sm" onClick={async () => {
                  if (!confirm("هل أنت متأكد من حذف هذه الرحلة؟")) return;
                  await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ table: "trip_students", action: "delete", data: { match: { trip_id: t.id } } }) });
                  await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ table: "trips", action: "delete", data: { id: t.id } }) });
                  const res = await fetch("/api/query?table=trips&order=date.desc");
                  setTrips(await res.json());
                }}>حذف</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 text-sm text-muted-foreground">
                {t.manager_id && (() => { const m = schoolMembers.find((x) => x.id === t.manager_id); return m ? <span>مدير الرحلة: {m.first_name} {m.last_name}</span> : null; })()}
                {t.departure_time && <span>الانطلاق: {t.departure_time}</span>}
                {t.cost != null && <span>التكلفة: {t.cost} دج</span>}
              </div>
            </CardContent>
          </Card>
        ))}
        {trips.length === 0 && <p className="text-muted-foreground">لا توجد رحلات بعد</p>}
      </div>
    </div>
  );
}
