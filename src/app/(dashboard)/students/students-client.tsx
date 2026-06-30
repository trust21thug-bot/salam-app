"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Student, Teacher } from "@/types/database";

import { getAge, CLASSIFICATION_LABELS, ACADEMIC_LEVELS, FILE_STATUS_LABELS } from "@/lib/utils";
import { StudentDialog } from "./student-dialog";

function exportToExcel(data: Student[], filename: string) {
  import("xlsx").then((XLSX) => {
    const rows = data.map((s) => ({
      الاسم: `${s.first_name} ${s.last_name}`,
      "المستوى الدراسي": ACADEMIC_LEVELS[s.academic_level] || s.academic_level || "",
      "هاتف الولي": s.guardian_phone || "",
      التصنيف: CLASSIFICATION_LABELS[s.classification as string] || s.classification || "",
      العمر: `${getAge(s.birth_date)} سنة`,
      "حالة الملف": FILE_STATUS_LABELS[s.file_status as string] || s.file_status || "",
      المرض: s.illness || "",
      "تاريخ الميلاد": s.birth_date || "",
      الملاحظات: s.notes || "",
      الحي: s.neighborhood || "",
      "يذهب بمفرده": s.goes_alone ? "نعم" : "لا",
      "الأيام المشكلة": s.problem_days || "",
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "الطلبة");
    XLSX.writeFile(wb, filename);
  });
}

export function StudentsClient({ initialStudents, teachers }: { initialStudents: Student[]; teachers: Pick<Teacher, "id" | "full_name">[] }) {
  const [students, setStudents] = useState(initialStudents);
  const [edit, setEdit] = useState<Student | null>(null);
  const [open, setOpen] = useState(false);

  const circleOpts = useMemo(() => teachers.map((t) => ({ label: t.full_name, value: t.id })), [teachers]);
  const classificationOpts = useMemo(() => Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => ({ label: v, value: k })), []);
  const fileStatusOpts = useMemo(() => Object.entries(FILE_STATUS_LABELS).map(([k, v]) => ({ label: v, value: k })), []);
  const academicLevelOpts = useMemo(() => Object.entries(ACADEMIC_LEVELS).map(([k, v]) => ({ label: v, value: k })), []);

  const refresh = async () => {
    const res = await fetch("/api/students");
    setStudents(await res.json());
    setOpen(false);
    setEdit(null);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">الطلبة</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportToExcel(students, "الطلبة.xlsx")}>تصدير Excel</Button>
          <StudentDialog
          teachers={teachers}
          student={null}
          open={open && !edit}
          onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}
          onDone={refresh}
          allStudents={students}
          trigger={<Button onClick={() => { setEdit(null); setOpen(true); }}>إضافة طالب</Button>}
        />
      </div>
      </div>

      <DataTable
        columns={[
          {
            key: "name",
            header: "الاسم",
            render: (s: Student) => (
              <Link href={`/students/${s.id}`} className="text-primary hover:underline font-medium">
                {s.first_name} {s.last_name}
              </Link>
            ),
            filter: { type: "text", placeholder: "بحث بالاسم", filterValue: (s) => `${s.first_name} ${s.last_name}` },
          },
          {
            key: "academic_level",
            header: "المستوى",
            render: (s: Student) => ACADEMIC_LEVELS[s.academic_level] || s.academic_level || "—",
            filter: { type: "select", placeholder: "كل المستويات", options: academicLevelOpts, filterValue: (s) => s.academic_level || "" },
          },
          {
            key: "guardian_phone",
            header: "هاتف الولي",
            filter: { type: "text", placeholder: "بحث بهاتف" },
          },
          {
            key: "circle_id",
            header: "الحلقة",
            render: (s: Student) => teachers.find((t) => t.id === s.circle_id)?.full_name ?? s.circle_id,
            filter: { type: "select", placeholder: "كل الحلقات", options: circleOpts, filterValue: (s) => s.circle_id },
          },
          {
            key: "classification",
            header: "التصنيف",
            render: (s: Student) => <Badge variant="outline">{CLASSIFICATION_LABELS[s.classification as string] ?? s.classification}</Badge>,
            filter: { type: "select", placeholder: "كل التصنيفات", options: classificationOpts, filterValue: (s) => s.classification || "" },
          },
          {
            key: "birth_date",
            header: "العمر",
            render: (s: Student) => `${getAge(s.birth_date)} سنة`,
            filter: { type: "text", placeholder: "بحث بالعمر", filterValue: (s) => String(getAge(s.birth_date)) },
          },
          {
            key: "file_status",
            header: "حالة الملف",
            render: (s: Student) => s.file_status ? <Badge variant="secondary">{FILE_STATUS_LABELS[s.file_status] || s.file_status}</Badge> : <span className="text-muted-foreground text-sm">—</span>,
            filter: { type: "select", placeholder: "كل الحالات", options: fileStatusOpts, filterValue: (s) => s.file_status || "" },
          },
          {
            key: "insurance",
            header: "التأمين",
            render: (s: Student) => s.insurance ? <Badge variant="outline" className="border-0" style={{ backgroundColor: "#99FF99", color: "#003300" }}>نعم</Badge> : <Badge variant="destructive">لا</Badge>,
            filter: { type: "select", placeholder: "الكل", options: [{ label: "نعم", value: "yes" }, { label: "لا", value: "no" }], filterValue: (s) => s.insurance ? "yes" : "no" },
          },
          {
            key: "illness",
            header: "المرض",
            render: (s: Student) => s.illness || "—",
            filter: { type: "text", placeholder: "بحث بمرض", filterValue: (s) => s.illness || "" },
          },
          {
            key: "neighborhood",
            header: "الحي",
            render: (s: Student) => s.neighborhood || "—",
            filter: { type: "text", placeholder: "بحث بالحي", filterValue: (s) => s.neighborhood || "" },
          },
          {
            key: "goes_alone",
            header: "بمفرده",
            render: (s: Student) => s.goes_alone ? <Badge variant="outline" className="border-0" style={{ backgroundColor: "#99FF99", color: "#003300" }}>نعم</Badge> : <Badge variant="destructive">لا</Badge>,
            filter: { type: "select", placeholder: "الكل", options: [{ label: "نعم", value: "yes" }, { label: "لا", value: "no" }], filterValue: (s) => s.goes_alone ? "yes" : "no" },
          },
          {
            key: "problem_days",
            header: "أيام مشكلة",
            render: (s: Student) => s.problem_days || "—",
            filter: { type: "text", placeholder: "بحث", filterValue: (s) => s.problem_days || "" },
          },
          {
            key: "notes",
            header: "ملاحظات",
            render: (s: Student) => s.notes || "—",
            filter: { type: "text", placeholder: "بحث", filterValue: (s) => s.notes || "" },
          },
          {
            key: "actions",
            header: "",
            render: (s: Student) => (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/students/${s.id}`}>عرض</Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setEdit(s); setOpen(true); }}>
                  تعديل
                </Button>
              </div>
            ),
          },
        ]}
        data={students}
        keyExtractor={(s) => s.id}
      />

      {edit && (
        <StudentDialog
          teachers={teachers}
          student={edit}
          open={open}
          onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}
          onDone={refresh}
          allStudents={students}
        />
      )}
    </div>
  );
}