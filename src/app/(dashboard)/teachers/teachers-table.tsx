"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Teacher } from "@/types/database";
import { getTeacherDays } from "@/types/database";
import { DAY_LABELS } from "@/lib/utils";
import { usePrayerTimes } from "@/lib/hooks/use-prayer-times";
import { DayRow } from "./day-row";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function TeacherForm({ teacher, onDone }: { teacher?: Teacher | null; onDone: () => void }) {
  const { names: prayerTimes } = usePrayerTimes();
  const initialSchedule = teacher?.teaching_schedule ?? {};
  const [fullName, setFullName] = useState(teacher?.full_name ?? "");
  const [phone, setPhone] = useState(teacher?.phone ?? "");
  const [schedule, setSchedule] = useState<Record<number, string>>(initialSchedule);

  const handleSubmit = async () => {
    if (!fullName.trim()) { toast.error("الاسم مطلوب"); return; }
    const activeDays = Object.keys(schedule).filter((d) => schedule[Number(d)]).map(Number);
    if (activeDays.length === 0) { toast.error("اختر يوم تدريس على الأقل"); return; }

    const primaryTime = schedule[activeDays[0]];
    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: teacher?.id,
        full_name: fullName.trim(),
        phone: phone || null,
        teaching_days: activeDays,
        teaching_time: primaryTime,
        teaching_schedule: schedule,
      }),
    });
    if (!res.ok) { toast.error("فشل الحفظ"); return; }
    toast.success(teacher ? "تم تحديث الأستاذ" : "تم إضافة الأستاذ");
    onDone();
  };

  const handleDelete = async () => {
    if (!teacher?.id) return;
    await fetch("/api/teachers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: teacher.id }),
    });
    toast.success("تم حذف الأستاذ");
    onDone();
  };

  const setDay = (day: number, val: string) => {
    setSchedule((prev) => {
      const next = { ...prev };
      if (val) next[day] = val;
      else delete next[day];
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>الاسم واللقب</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="مثال: عبد الرحيم" />
      </div>
      <div>
        <Label>رقم الهاتف</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" />
      </div>
      <div>
        <Label className="mb-2 block">جدول التدريس (اختر اليوم وحدد التوقيت)</Label>
        <div className="space-y-1.5">
          {ALL_DAYS.map((d) => (
            <DayRow key={d} day={d} value={schedule[d] ?? ""} onChange={(v) => setDay(d, v)} prayerTimes={prayerTimes} />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSubmit}>{teacher ? "تحديث" : "إضافة"}</Button>
        {teacher && <Button variant="destructive" onClick={handleDelete}>حذف</Button>}
      </div>
    </div>
  );
}

export function TeachersTable({ initialData }: { initialData: Teacher[] }) {
  const [teachers, setTeachers] = useState(initialData);
  const [edit, setEdit] = useState<Teacher | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/teachers").then((r) => r.json()).then(setTeachers);
  }, []);

  const refresh = async () => {
    const res = await fetch("/api/teachers");
    setTeachers(await res.json());
    setOpen(false);
    setEdit(null);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEdit(null)}>إضافة أستاذ</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{edit ? "تعديل أستاذ" : "إضافة أستاذ"}</DialogTitle>
            </DialogHeader>
            <TeacherForm teacher={edit} onDone={refresh} />
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={[
          {
            key: "actions",
            header: "",
            render: (t: Teacher) => (
              <Button variant="ghost" size="sm" onClick={() => { setEdit(t); setOpen(true); }}>
                تعديل
              </Button>
            ),
          },
          { key: "phone", header: "الهاتف" },
          {
            key: "teaching_schedule",
            header: "التوقيت",
            render: (t: Teacher) => {
              if (t.teaching_schedule) {
                const days = Object.keys(t.teaching_schedule).map(Number);
                const times = [...new Set(Object.values(t.teaching_schedule))];
                if (times.length === 1) return times[0];
                return days.map((d) => `${DAY_LABELS[d]}: ${t.teaching_schedule![d]}`).join(" | ");
              }
              return t.teaching_time;
            },
          },
          {
            key: "teaching_days",
            header: "أيام التدريس",
            render: (t: Teacher) => {
              const days = getTeacherDays(t);
              return days.map((d) => DAY_LABELS[d]).join("، ");
            },
          },
          { key: "full_name", header: "الاسم" },
        ]}
        data={teachers}
        keyExtractor={(t) => t.id}
      />
    </div>
  );
}
