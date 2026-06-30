"use client";

import { useState, useMemo, lazy, Suspense, memo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import type { Student, Teacher, CircleTransfer } from "@/types/database";
import { CLASSIFICATION_LABELS, ACADEMIC_LEVELS, FILE_STATUS_LABELS } from "@/lib/utils";
import { getCurrentWeekNumber } from "@/lib/week-utils";

const ImageCropler = lazy(() => import("@/components/image-crop/image-cropper").then((m) => ({ default: m.ImageCropler })));

interface Props {
  teachers: Pick<Teacher, "id" | "full_name">[];
  student: Student | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDone: () => void;
  trigger?: React.ReactNode;
  allStudents?: Student[];
}

function StudentDialogInner({ teachers, student, open, onOpenChange, onDone, trigger, allStudents }: Props) {
  const [firstName, setFirstName] = useState(student?.first_name ?? "");
  const [lastName, setLastName] = useState(student?.last_name ?? "");
  const [birthDate, setBirthDate] = useState(student?.birth_date ?? "");
  const [phone, setPhone] = useState(student?.guardian_phone ?? "");
  const [circleId, setCircleId] = useState(student?.circle_id ?? "");
  const [classification, setClassification] = useState(student?.classification ?? "public_circle");
  const [academicLevel, setAcademicLevel] = useState(student?.academic_level ?? "");
  const [illness, setIllness] = useState(student?.illness ?? "");
  const [fileStatus, setFileStatus] = useState(student?.file_status ?? "");
  const [insurance, setInsurance] = useState(student?.insurance === false ? "no" : "yes");
  const [siblingId, setSiblingId] = useState(student?.sibling_id ?? "");
  const [requiredMem, setRequiredMem] = useState(student?.required_memorization?.toString() ?? "0.25");
  const [requiredRev, setRequiredRev] = useState(student?.required_revision?.toString() ?? "0.25");
  const [totalMemorization, setTotalMemorization] = useState(student?.total_memorization?.toString() ?? "");
  const [masterEvaluation, setMasterEvaluation] = useState(student?.master_evaluation?.toString() ?? "");
  const [siblingSearch, setSiblingSearch] = useState("");
  const [photoUrl] = useState(student?.photo_url ?? "");
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);

  const filteredSiblings = useMemo(() => {
    if (!siblingSearch) return allStudents ?? [];
    const q = siblingSearch.toLowerCase();
    return (allStudents ?? []).filter((s) =>
      s.id !== student?.id && `${s.first_name} ${s.last_name}`.toLowerCase().includes(q)
    );
  }, [allStudents, siblingSearch, student?.id]);



  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) { toast.error("الاسم مطلوب"); return; }
    if (!birthDate) { toast.error("تاريخ الميلاد مطلوب"); return; }
    if (!phone.trim()) { toast.error("هاتف الولي مطلوب"); return; }
    if (!circleId) { toast.error("اختر الحلقة"); return; }

    let finalPhotoUrl = photoUrl;
    if (croppedBlob) {
      const formData = new FormData();
      formData.append("file", croppedBlob, `${firstName}_${lastName}.jpg`);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.url) finalPhotoUrl = data.url;
      } else {
        toast.error("فشل رفع الصورة، حاول مرة أخرى");
        return;
      }
    }

    const oldCircleId = student?.circle_id;
    const circleChanged = student && oldCircleId && oldCircleId !== circleId;

    await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: student?.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate,
        guardian_phone: phone.trim(),
        circle_id: circleId,
        classification: classification as Student["classification"],
        academic_level: academicLevel,
        illness: illness || null,
        file_status: fileStatus || null,
        insurance: insurance === "yes",
        sibling_id: siblingId || null,
        photo_url: finalPhotoUrl || null,
        required_memorization: parseFloat(requiredMem) || 0.25,
        required_revision: parseFloat(requiredRev) || 0.25,
        total_memorization: totalMemorization ? parseFloat(totalMemorization) : null,
        master_evaluation: masterEvaluation ? parseFloat(masterEvaluation) : null,
      }),
    });

    if (circleChanged) {
      try {
        const schRes = await fetch("/api/query?table=school_year");
        const schData = await schRes.json();
        const startDate = schData?.[0]?.start_date ? new Date(schData[0].start_date) : null;
        const weekNum = startDate ? getCurrentWeekNumber(startDate) : 1;

        // check if student has any transfers yet
        const existingRes = await fetch(`/api/query?table=circle_transfers&student_id=${student!.id}`);
        const existingTransfers = await existingRes.json();

        if (!existingTransfers || existingTransfers.length === 0) {
          // first transfer: record the original placement at week 1
          await fetch("/api/query", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table: "circle_transfers",
              action: "upsert",
              data: {
                student_id: student!.id,
                from_circle_id: null,
                to_circle_id: oldCircleId,
                week_number: 1,
              } as Partial<CircleTransfer>,
            }),
          });
        }

        // record the actual transfer at the current week
        await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: "circle_transfers",
            action: "upsert",
            data: {
              student_id: student!.id,
              from_circle_id: oldCircleId,
              to_circle_id: circleId,
              week_number: weekNum,
            } as Partial<CircleTransfer>,
          }),
        });
      } catch { /* transfer best-effort */ }
    }

    toast.success(student ? "تم تحديث الطالب" : "تم إضافة الطالب");
    onDone();
  };

  const handleDelete = async () => {
    if (!student?.id) return;
    await fetch("/api/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: student.id }),
    });
    toast.success("تم حذف الطالب");
    onDone();
  };

  const content = (
    <ScrollArea className="max-h-[80vh]">
    <div className="space-y-4 p-1">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>الاسم</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="الاسم" />
        </div>
        <div>
          <Label>اللقب</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="اللقب" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>تاريخ الميلاد</Label>
          <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div>
          <Label>المستوى الدراسي</Label>
          <Select value={academicLevel} onValueChange={setAcademicLevel}>
            <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
            <SelectContent>
              {Object.entries(ACADEMIC_LEVELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>رقم هاتف الولي</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05XXXXXXXX" />
      </div>
      <div>
        <Label>هل يعاني من مرض؟</Label>
        <Input value={illness} onChange={(e) => setIllness(e.target.value)} placeholder="اذكر المرض إن وجد" />
      </div>
      <div>
        <Label>حالة الملف</Label>
        <Select value={fileStatus} onValueChange={setFileStatus}>
          <SelectTrigger><SelectValue placeholder="اختر حالة الملف" /></SelectTrigger>
          <SelectContent>
            {Object.entries(FILE_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>التأمين</Label>
        <Select value={insurance} onValueChange={setInsurance}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">نعم</SelectItem>
            <SelectItem value="no">لا</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>الحفظ المطلوب (حزب/أسبوع)</Label>
        <Input type="number" step="0.05" min="0" value={requiredMem} onChange={(e) => setRequiredMem(e.target.value)} />
      </div>
      <div>
        <Label>المراجعة المطلوبة (حزب/أسبوع)</Label>
        <Input type="number" step="0.05" min="0" value={requiredRev} onChange={(e) => setRequiredRev(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>مقدار الحفظ الكلي (حزب)</Label>
          <Input type="number" step="0.1" min="0" value={totalMemorization} onChange={(e) => setTotalMemorization(e.target.value)} placeholder="مثال: 5" />
        </div>
        <div>
          <Label>نسبة ضبط الحفظ (%)</Label>
          <Input type="number" step="1" min="0" max="100" value={masterEvaluation} onChange={(e) => setMasterEvaluation(e.target.value)} placeholder="مثال: 65" />
        </div>
      </div>
      <div>
        <Label>هل له أخ في المدرسة؟</Label>
        <Input placeholder="ابحث بالاسم..." value={siblingSearch} onChange={(e) => setSiblingSearch(e.target.value)} className="mb-1" />
        <Select value={siblingId} onValueChange={setSiblingId}>
          <SelectTrigger><SelectValue placeholder="اختر الأخ (إن وجد)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">لا يوجد</SelectItem>
            {filteredSiblings.filter((s) => s.id !== student?.id).map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>الحلقة</Label>
        <Select value={circleId} onValueChange={setCircleId}>
          <SelectTrigger><SelectValue placeholder="اختر حلقة" /></SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>التصنيف</Label>
        <Select value={classification} onValueChange={(v) => setClassification(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>صورة الطالب</Label>
        <Suspense fallback={<div className="text-sm text-muted-foreground">جاري تحميل أداة الصور...</div>}>
          <ImageCropler
            currentUrl={photoUrl}
            onCrop={(blob) => setCroppedBlob(blob)}
          />
        </Suspense>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleSubmit}>{student ? "تحديث" : "إضافة"}</Button>
        {student && <Button variant="destructive" onClick={handleDelete}>حذف</Button>}
      </div>
    </div>
    </ScrollArea>
  );

  const dialogContent = (
    <DialogHeader>
      <DialogTitle>{student ? "تعديل طالب" : "إضافة طالب"}</DialogTitle>
    </DialogHeader>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl" onPointerDownOutside={(e) => e.preventDefault()}>
        {dialogContent}
        {content}
      </DialogContent>
    </Dialog>
  );
}

export const StudentDialog = memo(StudentDialogInner);
