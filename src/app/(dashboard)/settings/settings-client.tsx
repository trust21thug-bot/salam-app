"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

import type { RankingGroup, Teacher, SchoolMember } from "@/types/database";

interface PrayerTimeItem {
  id: string;
  name: string;
  sort_order: number;
  clock_time?: string;
}

interface Props {
  initialGroups: RankingGroup[];
  teachers: Pick<Teacher, "id" | "full_name">[];
  initialPrayerTimes: PrayerTimeItem[];
  initialSchoolYearStart: string;
  initialSchoolMembers: SchoolMember[];
}

export function SettingsClient({ initialGroups, teachers, initialPrayerTimes, initialSchoolYearStart, initialSchoolMembers }: Props) {
  const [groups, setGroups] = useState(initialGroups);
  const [name, setName] = useState("");
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [prayerTimes, setPrayerTimes] = useState(initialPrayerTimes);
  const [newPrayerName, setNewPrayerName] = useState("");
  const [schoolYearStart, setSchoolYearStart] = useState(initialSchoolYearStart);

  const refresh = async () => {
    const res = await fetch("/api/query?table=ranking_groups");
    setGroups(await res.json());
  };

  const refreshPrayerTimes = async () => {
    const res = await fetch("/api/query?table=prayer_times");
    const data = await res.json();
    data.sort((a: PrayerTimeItem, b: PrayerTimeItem) => a.sort_order - b.sort_order);
    setPrayerTimes(data);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("اسم المجموعة مطلوب"); return; }
    if (selectedCircles.length < 1) { toast.error("اختر حلقة واحدة على الأقل"); return; }
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "ranking_groups", action: "upsert", data: { id: editingId ?? undefined, name: name.trim(), circle_ids: selectedCircles } }),
    });
    toast.success(editingId ? "تم تحديث المجموعة" : "تم إضافة المجموعة");
    setName("");
    setSelectedCircles([]);
    setEditingId(null);
    refresh();
  };

  const handleEdit = (g: RankingGroup) => {
    setName(g.name);
    setSelectedCircles(g.circle_ids);
    setEditingId(g.id);
  };

  const handleDelete = async (id: string) => {
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "ranking_groups", action: "delete", data: { id } }),
    });
    toast.success("تم حذف المجموعة");
    refresh();
  };

  const toggleCircle = (id: string) => {
    setSelectedCircles((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addPrayerTime = async () => {
    const name = newPrayerName.trim();
    if (!name) { toast.error("اسم الصلاة مطلوب"); return; }
    const maxOrder = prayerTimes.reduce((max, p) => Math.max(max, p.sort_order), 0);
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "prayer_times", action: "upsert", data: { name, sort_order: maxOrder + 1 } }),
    });
    toast.success("تم إضافة وقت الصلاة");
    setNewPrayerName("");
    refreshPrayerTimes();
  };

  const updatePrayerClock = async (id: string, name: string, clock_time: string) => {
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "prayer_times", action: "upsert", data: { id, name, clock_time } }),
    });
    refreshPrayerTimes();
  };

  const deletePrayerTime = async (id: string) => {
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "prayer_times", action: "delete", data: { id } }),
    });
    toast.success("تم حذف وقت الصلاة");
    refreshPrayerTimes();
  };

  const movePrayerTime = async (id: string, direction: "up" | "down") => {
    const idx = prayerTimes.findIndex((p) => p.id === id);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === prayerTimes.length - 1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const current = prayerTimes[idx];
    const swap = prayerTimes[swapIdx];
    await Promise.all([
      fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "prayer_times", action: "upsert", data: { id: current.id, name: current.name, clock_time: current.clock_time, sort_order: swap.sort_order } }),
      }),
      fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: "prayer_times", action: "upsert", data: { id: swap.id, name: swap.name, clock_time: swap.clock_time, sort_order: current.sort_order } }),
      }),
    ]);
    refreshPrayerTimes();
  };

  const [schoolMembers, setSchoolMembers] = useState(initialSchoolMembers);
  const [memberFirstName, setMemberFirstName] = useState("");
  const [memberLastName, setMemberLastName] = useState("");
  const [memberPhone, setMemberPhone] = useState("");
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const saveMember = async () => {
    if (!memberFirstName.trim() || !memberLastName.trim()) { toast.error("الاسم واللقب مطلوبان"); return; }
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "school_members", action: "upsert", data: { id: editingMemberId ?? undefined, first_name: memberFirstName.trim(), last_name: memberLastName.trim(), phone: memberPhone.trim() } }),
    });
    toast.success(editingMemberId ? "تم تحديث العضو" : "تم إضافة العضو");
    setMemberFirstName(""); setMemberLastName(""); setMemberPhone(""); setEditingMemberId(null);
    const res = await fetch("/api/query?table=school_members");
    setSchoolMembers(await res.json());
  };

  const editMember = (m: SchoolMember) => {
    setMemberFirstName(m.first_name); setMemberLastName(m.last_name); setMemberPhone(m.phone); setEditingMemberId(m.id);
  };

  const deleteMember = async (id: string) => {
    await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "school_members", action: "delete", data: { id } }) });
    toast.success("تم حذف العضو");
    setSchoolMembers((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">الإعدادات</h2>

      <Card>
        <CardHeader><CardTitle>بداية السنة الدراسية</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            حدد تاريخ أول يوم في السنة الدراسية (السبت).
          </p>
          <Input
            type="date"
            value={schoolYearStart}
            onChange={async (e) => {
              const val = e.target.value;
              setSchoolYearStart(val);
              await fetch("/api/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ table: "school_year", action: "upsert", data: { id: "current", start_date: val } }),
              });
              toast.success("تم حفظ تاريخ بداية السنة");
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>أوقات الصلوات</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            حدد أسماء أوقات الصلوات وحدد لكل صلاة وقتها (مثل المغرب: 20:00) ليتم ترتيب الجدول تلقائيًا حسب الوقت.
          </p>
          <div className="flex gap-2">
            <Input
              value={newPrayerName}
              onChange={(e) => setNewPrayerName(e.target.value)}
              placeholder="مثال: العشاء"
              onKeyDown={(e) => { if (e.key === "Enter") addPrayerTime(); }}
            />
            <Button onClick={addPrayerTime}>إضافة</Button>
          </div>
          {prayerTimes.length === 0 && (
            <p className="text-sm text-muted-foreground">لم يتم إضافة أوقات صلاة بعد. سيتم استخدام الأوقات الافتراضية.</p>
          )}
          {prayerTimes.length > 0 && (
            <div className="space-y-1">
              {prayerTimes.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-2 bg-muted/30 rounded px-3 py-1.5">
                  <span className="text-xs text-muted-foreground w-6">{idx + 1}</span>
                  <span className="w-20 text-sm">{p.name}</span>
                  <Input
                    type="time"
                    value={p.clock_time ?? ""}
                    onChange={(e) => updatePrayerClock(p.id, p.name, e.target.value)}
                    className="h-7 w-28 text-xs"
                  />
                  <Button variant="ghost" size="icon" className="size-7" disabled={idx === 0} onClick={() => movePrayerTime(p.id, "up")}>↑</Button>
                  <Button variant="ghost" size="icon" className="size-7" disabled={idx === prayerTimes.length - 1} onClick={() => movePrayerTime(p.id, "down")}>↓</Button>
                  <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => deletePrayerTime(p.id)}>✕</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>مجموعات الترتيب الأسبوعي</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            حدد أي الحلقات تتجمع معًا في جدول ترتيب واحد. يمكن أن تضم المجموعة حلقة واحدة أو أكثر.
          </p>

          <div>
            <Label>اسم المجموعة</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: المجموعة الأولى" />
          </div>
          <div>
            <Label>اختر الحلقات</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {teachers.map((t) => (
                <Button
                  key={t.id}
                  type="button"
                  variant={selectedCircles.includes(t.id) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleCircle(t.id)}
                >
                  {t.full_name}
                </Button>
              ))}
            </div>
          </div>
          <Button onClick={handleSave}>{editingId ? "تحديث" : "إضافة"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <DataTable
            columns={[
              { key: "name", header: "اسم المجموعة" },
              {
                key: "circle_ids",
                header: "الحلقات",
                render: (g: RankingGroup) => g.circle_ids.map((id) => {
                  const t = teachers.find((t) => t.id === id);
                  return t ? <Badge key={id} variant="outline" className="ml-1">{t.full_name}</Badge> : null;
                }),
              },
              {
                key: "actions",
                header: "",
                render: (g: RankingGroup) => (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(g)}>تعديل</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(g.id)}>حذف</Button>
                  </div>
                ),
              },
            ]}
            data={groups}
            keyExtractor={(g) => g.id}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>أعضاء المدرسة</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">إدارة أعضاء المدرسة (المؤطرين) الذين يمكن تحديدهم في الرحلات.</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>الاسم</Label><Input value={memberFirstName} onChange={(e) => setMemberFirstName(e.target.value)} placeholder="الاسم" />
            </div>
            <div>
              <Label>اللقب</Label><Input value={memberLastName} onChange={(e) => setMemberLastName(e.target.value)} placeholder="اللقب" />
            </div>
            <div>
              <Label>رقم الهاتف</Label><Input value={memberPhone} onChange={(e) => setMemberPhone(e.target.value)} placeholder="الهاتف" dir="ltr" />
            </div>
          </div>
          <Button onClick={saveMember}>{editingMemberId ? "تحديث" : "إضافة"}</Button>
          <div className="space-y-1">
            {schoolMembers.length === 0 && <p className="text-sm text-muted-foreground">لم يتم إضافة أعضاء بعد</p>}
            {schoolMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2">
                <span className="text-sm">{m.first_name} {m.last_name} — {m.phone}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => editMember(m)}>تعديل</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => deleteMember(m.id)}>حذف</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader><CardTitle>حدود التقدير النصي</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            حدود التقدير للمعدل الفصلي: ممتاز (≥9)، جيد جدًا (≥8)، جيد (≥6.5)، متوسط (≥5)، ضعيف (&lt;5).
            قابل للتعديل في الإصدارات القادمة.
          </p>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader><CardTitle>النسخ الاحتياطي</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            قم بتصدير نسخة احتياطية من جميع بيانات التطبيق بشكل دوري لتفادي فقدان المعلومات.
            يمكنك استيراد النسخة لاحقاً حتى لو تم حذف ملفات التطبيق بالكامل.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.open("/api/backup", "_blank")}>
              تصدير نسخة احتياطية
            </Button>
            <Label htmlFor="restore-backup" className="cursor-pointer">
              <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
                استيراد نسخة احتياطية
              </div>
              <Input id="restore-backup" type="file" accept=".json" className="hidden" onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                try {
                  const res = await fetch("/api/backup", { method: "POST", body: text });
                  const result = await res.json();
                  if (result.ok) {
                    toast.success(result.message || "تم استعادة النسخة الاحتياطية");
                    setTimeout(() => window.location.reload(), 1500);
                  } else {
                    toast.error(result.error || "فشل في استيراد الملف");
                  }
                } catch {
                  toast.error("فشل في استيراد الملف. تأكد من أنه نسخة احتياطية صالحة.");
                }
                e.target.value = "";
              }} />
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
