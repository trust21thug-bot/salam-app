"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Attendant } from "@/types/database";
import { DAY_LABELS } from "@/lib/utils";

function AttendantForm({ attendant, onDone }: { attendant?: Attendant | null; onDone: () => void }) {
  const [fullName, setFullName] = useState(attendant?.full_name ?? "");
  const [number, setNumber] = useState(attendant?.attendant_number ?? "");
  const [days, setDays] = useState<number[]>(attendant?.duty_days ?? []);

  const toggleDay = (d: number) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const handleSubmit = async () => {
    if (!fullName.trim()) { toast.error("الاسم مطلوب"); return; }
    const res = await fetch("/api/attendants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: attendant?.id,
        full_name: fullName.trim(),
        attendant_number: number,
        duty_days: days,
      }),
    });
    if (!res.ok) { toast.error("فشل الحفظ"); return; }
    toast.success(attendant ? "تم التحديث" : "تم الإضافة");
    onDone();
  };

  const handleDelete = async () => {
    if (!attendant?.id) return;
    await fetch("/api/attendants", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: attendant.id }),
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
        <Label>رقم المداوم</Label>
        <Input value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>
      <div>
        <Label>أيام المداومة</Label>
        <div className="flex flex-wrap gap-2 mt-1">
         {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <Button key={d} type="button" variant={days.includes(d) ? "default" : "outline"} size="sm" onClick={() => toggleDay(d)}>
              {DAY_LABELS[d]}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSubmit}>{attendant ? "تحديث" : "إضافة"}</Button>
        {attendant && <Button variant="destructive" onClick={handleDelete}>حذف</Button>}
      </div>
    </div>
  );
}

export function AttendantsTable({ initialData }: { initialData: Attendant[] }) {
  const [attendants, setAttendants] = useState(initialData);
  const [edit, setEdit] = useState<Attendant | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/attendants").then((r) => r.json()).then(setAttendants);
  }, []);

  const refresh = async () => {
    const res = await fetch("/api/attendants");
    setAttendants(await res.json());
    setOpen(false);
    setEdit(null);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button onClick={() => setEdit(null)}>إضافة مداوم</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit ? "تعديل" : "إضافة مداوم"}</DialogTitle></DialogHeader>
            <AttendantForm attendant={edit} onDone={refresh} />
          </DialogContent>
        </Dialog>
      </div>
      <DataTable
        columns={[
          { key: "full_name", header: "الاسم" },
          { key: "attendant_number", header: "الرقم" },
          { key: "duty_days", header: "أيام المداومة", render: (a: Attendant) => a.duty_days.map((d) => DAY_LABELS[d]).join("، ") },
          { key: "actions", header: "", render: (a: Attendant) => (
            <Button variant="ghost" size="sm" onClick={() => { setEdit(a); setOpen(true); }}>تعديل</Button>
          )},
        ]}
        data={attendants}
        keyExtractor={(a) => a.id}
      />
    </div>
  );
}
