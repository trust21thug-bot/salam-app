"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import type { AssistantTeacher, Teacher } from "@/types/database";
import { getTeacherDays } from "@/types/database";
import { DAY_LABELS } from "@/lib/utils";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function AssistantForm({ assistant, teachers, onDone }: { assistant?: AssistantTeacher | null; teachers: Teacher[]; onDone: () => void }) {
  const [fullName, setFullName] = useState(assistant?.full_name ?? "");
  const [phone, setPhone] = useState(assistant?.phone ?? "");
  const [teacherId, setTeacherId] = useState(assistant?.teacher_id ?? "");
  const [days, setDays] = useState<number[]>(assistant?.teaching_days ?? []);

  const selectedTeacher = teachers.find((t) => t.id === teacherId);
  const teacherDays = selectedTeacher ? getTeacherDays(selectedTeacher) : [];

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)));
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!teacherId) { toast.error("اختر الحلقة التابع لها"); return; }
    if (days.length === 0) { toast.error("اختر يوم تدريس على الأقل"); return; }

    const teacher = teachers.find((t) => t.id === teacherId);
    const teacherSchedule = teacher?.teaching_schedule ?? {};
    const derivedSchedule: Record<string, string> = {};
    for (const d of days) {
      const time = teacherSchedule[d] ?? teacher?.teaching_time;
      if (time) derivedSchedule[String(d)] = time;
    }
    const primaryTime = derivedSchedule[String(days[0])] ?? teacher?.teaching_time ?? "";

    const res = await fetch("/api/assistant-teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: assistant?.id,
        full_name: fullName.trim(),
        phone: phone || null,
        teaching_days: days,
        teaching_time: primaryTime,
        teaching_schedule: derivedSchedule,
        teacher_id: teacherId,
      }),
    });
    if (!res.ok) { toast.error("فشل الحفظ"); return; }
    toast.success(assistant ? "تم التحديث" : "تم الإضافة");
    onDone();
  };

  const handleDelete = async () => {
    if (!assistant?.id) return;
    await fetch("/api/assistant-teachers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assistant.id }),
    });
    toast.success("تم الحذف");
    onDone();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>الاسم واللقب</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div>
        <Label>رقم الهاتف</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <Label>الحلقة التابع لها</Label>
        <Select value={teacherId} onValueChange={setTeacherId}>
          <SelectTrigger><SelectValue placeholder="اختر حلقة" /></SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="mb-2 block">أيام التدريس</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {ALL_DAYS.map((d) => {
            const isTeacherDay = teacherDays.includes(d);
            return (
              <Button
                key={d}
                type="button"
                variant={days.includes(d) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleDay(d)}
                disabled={!isTeacherDay && teacherDays.length > 0}
                title={isTeacherDay ? DAY_LABELS[d] : "لا يعمل الأستاذ في هذا اليوم"}
              >
                {DAY_LABELS[d]}
              </Button>
            );
          })}
        </div>
        {teacherId && (
          <p className="text-xs text-muted-foreground mt-1">
            أيام تدريس الأستاذ: {teacherDays.map((d) => DAY_LABELS[d]).join("، ")}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSubmit}>{assistant ? "تحديث" : "إضافة"}</Button>
        {assistant && <Button variant="destructive" onClick={handleDelete}>حذف</Button>}
      </div>
    </div>
  );
}

export function AssistantTeachersTable({ initialData }: { initialData: AssistantTeacher[] }) {
  const [assistants, setAssistants] = useState(initialData);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [edit, setEdit] = useState<AssistantTeacher | null>(null);
  const [open, setOpen] = useState(false);

  const fetchTeachers = async () => {
    const r = await fetch("/api/teachers");
    return r.json() as Promise<Teacher[]>;
  };

  useEffect(() => {
    fetchTeachers().then(setTeachers);
    fetch("/api/assistant-teachers").then((r) => r.json()).then(setAssistants);
  }, []);

  const refresh = async () => {
    const [a, t] = await Promise.all([
      fetch("/api/assistant-teachers").then((r) => r.json()),
      fetchTeachers(),
    ]);
    setAssistants(a);
    setTeachers(t);
    setOpen(false);
    setEdit(null);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={async () => { setTeachers(await fetchTeachers()); setEdit(null); }}>
              إضافة أستاذ مساعد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{edit ? "تعديل" : "إضافة أستاذ مساعد"}</DialogTitle>
            </DialogHeader>
            <AssistantForm assistant={edit} teachers={teachers} onDone={refresh} />
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={[
          { key: "full_name", header: "الاسم" },
          {
            key: "teacher_id",
            header: "الحلقة",
            render: (a: AssistantTeacher) => teachers.find((t) => t.id === a.teacher_id)?.full_name ?? a.teacher_id,
          },
          {
            key: "teaching_days",
            header: "الأيام",
            render: (a: AssistantTeacher) => {
              const days = getTeacherDays(a);
              return days.map((d) => DAY_LABELS[d]).join("، ");
            },
          },
          {
            key: "teaching_schedule",
            header: "التوقيت",
            render: (a: AssistantTeacher) => {
              if (a.teaching_schedule) {
                const times = [...new Set(Object.values(a.teaching_schedule))];
                if (times.length === 1) return times[0];
                const days = Object.keys(a.teaching_schedule).map(Number);
                return days.map((d) => `${DAY_LABELS[d]}: ${a.teaching_schedule![d]}`).join(" | ");
              }
              return a.teaching_time;
            },
          },
          {
            key: "actions",
            header: "",
            render: (a: AssistantTeacher) => (
              <Button variant="ghost" size="sm" onClick={async () => { setTeachers(await fetchTeachers()); setEdit(a); setOpen(true); }}>
                تعديل
              </Button>
            ),
          },
        ]}
        data={assistants}
        keyExtractor={(a) => a.id}
      />
    </div>
  );
}
