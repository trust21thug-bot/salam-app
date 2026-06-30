"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as Dialog from "@/components/ui/dialog";
import type { ProspectiveStudent } from "@/types/database";
import { getAge } from "@/lib/utils";

interface Props {
  initialStudents: ProspectiveStudent[];
}

export function ReceptionClient({ initialStudents }: Props) {
  const [students, setStudents] = useState(initialStudents);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProspectiveStudent | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [studiedBefore, setStudiedBefore] = useState(false);
  const [previousMemorization, setPreviousMemorization] = useState("0");

  const resetForm = () => {
    setFirstName(""); setLastName(""); setGuardianPhone(""); setBirthDate("");
    setStudiedBefore(false); setPreviousMemorization("0");
  };

  const addStudent = async () => {
    if (!firstName || !lastName || !guardianPhone || !birthDate) return;
    const data = {
      first_name: firstName, last_name: lastName, guardian_phone: guardianPhone,
      birth_date: birthDate, studied_before: studiedBefore,
      previous_memorization: Number(previousMemorization) || 0, notified: false,
    };
    const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "prospective_students", action: "insert", data }) });
    const r = await res.json();
    setStudents((prev) => [r as ProspectiveStudent, ...prev]);
    setOpen(false);
    resetForm();
  };

  const deleteStudent = async () => {
    if (!deleteTarget) return;
    await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "prospective_students", action: "delete", data: { id: deleteTarget.id } }) });
    setStudents((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  const toggleNotified = async (s: ProspectiveStudent) => {
    const updated = { notified: !s.notified };
    await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "prospective_students", action: "update", match: { id: s.id }, data: updated }) });
    setStudents((prev) => prev.map((p) => p.id === s.id ? { ...p, ...updated } : p));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">الاستقبال — التلاميذ الجدد</h2>
        <Button onClick={() => { resetForm(); setOpen(true); }}>إضافة تلميذ جديد</Button>
      </div>

      <Dialog.Dialog open={open} onOpenChange={setOpen}>
        <Dialog.DialogContent className="max-w-lg">
          <Dialog.DialogHeader>
            <Dialog.DialogTitle>إضافة تلميذ جديد</Dialog.DialogTitle>
          </Dialog.DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>الاسم</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label>اللقب</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <div>
              <Label>رقم الولي</Label>
              <Input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} dir="ltr" />
            </div>
            <div>
              <Label>تاريخ الميلاد</Label>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div className="col-span-2 flex items-center gap-4">
              <Label>درس في مدرسة قرآنية من قبل؟</Label>
              <Button type="button" variant={studiedBefore ? "default" : "outline"} size="sm" onClick={() => setStudiedBefore(!studiedBefore)}>
                {studiedBefore ? "نعم" : "لا"}
              </Button>
            </div>
            <div className="col-span-2">
              <Label>مقدار الحفظ القديم (عدد الأحزاب)</Label>
              <Input type="number" min="0" value={previousMemorization} onChange={(e) => setPreviousMemorization(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>إلغاء</Button>
            <Button onClick={addStudent}>إضافة</Button>
          </div>
        </Dialog.DialogContent>
      </Dialog.Dialog>

      <Dialog.Dialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <Dialog.DialogContent className="max-w-sm">
          <Dialog.DialogHeader>
            <Dialog.DialogTitle>تأكيد الحذف</Dialog.DialogTitle>
          </Dialog.DialogHeader>
          <p className="text-sm text-muted-foreground">
            هل أنت متأكد من حذف التلميذ <strong>{deleteTarget?.first_name} {deleteTarget?.last_name}</strong>؟
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteStudent}>حذف</Button>
          </div>
        </Dialog.DialogContent>
      </Dialog.Dialog>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>اللقب</TableHead>
                <TableHead>الاسم</TableHead>
                <TableHead>رقم الولي</TableHead>
                <TableHead>العمر</TableHead>
                <TableHead>درس من قبل</TableHead>
                <TableHead>الحفظ القديم (حزب)</TableHead>
                <TableHead>الإعلام</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا يوجد تلاميذ جدد بعد</TableCell>
                </TableRow>
              ) : students.map((s, idx) => (
                <TableRow key={s.id}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className={s.notified ? "text-green-600 font-semibold" : ""}>{s.last_name}</TableCell>
                  <TableCell className={s.notified ? "text-green-600 font-semibold" : ""}>{s.first_name}</TableCell>
                  <TableCell dir="ltr">{s.guardian_phone}</TableCell>
                  <TableCell>{getAge(s.birth_date)} سنة</TableCell>
                  <TableCell>{s.studied_before ? "نعم" : "لا"}</TableCell>
                  <TableCell>{s.previous_memorization}</TableCell>
                  <TableCell>
                    {s.notified ? (
                      <span className="text-green-600 font-semibold">تم اعلامه</span>
                    ) : (
                      <Button variant="destructive" size="sm" onClick={() => toggleNotified(s)}>
                        لم يتم اعلامه
                      </Button>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => setDeleteTarget(s)}>
                      حذف
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
