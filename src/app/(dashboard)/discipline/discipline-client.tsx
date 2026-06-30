"use client";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import type { Teacher, Student } from "@/types/database";

interface Props {
  teachers: Pick<Teacher, "id" | "full_name">[];
  initialStudents: Pick<Student, "id" | "first_name" | "last_name" | "circle_id">[];
}

const DISCIPLINE_TYPE_LABELS: Record<string, string> = {
  reprimand: "توبيخ",
  praise: "استحسان",
};

const DISCIPLINE_FILTER_OPTS = Object.entries(DISCIPLINE_TYPE_LABELS).map(([k, v]) => ({ label: v, value: k }));

const formatDate = (d: string) => d ? new Date(d).toLocaleDateString("en-GB") : "";

function exportDisciplineToExcel(data: any[], filename: string) {
  import("xlsx").then((XLSX) => {
    const rows = data.map((r) => ({
      الطالب: r.student_name || "",
      النوع: DISCIPLINE_TYPE_LABELS[r.type] || r.type,
      السبب: r.reason || "",
      التاريخ: formatDate(r.record_date),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "الانضباط");
    XLSX.writeFile(wb, filename);
  });
}

export function DisciplineClient({ teachers, initialStudents }: Props) {
  const [circleId, setCircleId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [type, setType] = useState<"reprimand" | "praise">("reprimand");
  const [reason, setReason] = useState("");
  const [records, setRecords] = useState<any[]>([]);

  const nameMap = useMemo(() => new Map(initialStudents.map((s) => [s.id, `${s.first_name} ${s.last_name}`])), [initialStudents]);
  const circleOfStudent = useMemo(() => new Map(initialStudents.map((s) => [s.id, s.circle_id])), [initialStudents]);
  const circleMap = useMemo(() => new Map(teachers.map((t) => [t.id, t.full_name])), [teachers]);
  const circleStudents = useMemo(() => initialStudents.filter((s) => s.circle_id === circleId), [initialStudents, circleId]);

  useEffect(() => { loadRecords(); }, []);

  const loadRecords = async () => {
    const url = circleId
      ? `/api/query?table=discipline_records&student_ids=${circleStudents.map((s) => s.id).join(",")}`
      : `/api/query?table=discipline_records`;
    if (circleId && circleStudents.length === 0) return;
    const res = await fetch(url);
    const all = await res.json();
    setRecords(
      all.map((r: any) => {
        const cId = circleOfStudent.get(r.student_id) || "";
        return { ...r, student_name: nameMap.get(r.student_id) ?? "", circle_id: cId, circle_name: circleMap.get(cId) ?? "" };
      }).sort((a: any, b: any) => b.record_date?.localeCompare(a.record_date ?? "") ?? 0)
    );
  };

  const handleSubmit = async () => {
    if (!studentId) { toast.error("اختر الطالب"); return; }
    if (!reason.trim()) { toast.error("السبب مطلوب"); return; }
    await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "discipline_records", action: "upsert", data: { student_id: studentId, type, reason: reason.trim(), record_date: new Date().toISOString().split("T")[0] } }),
    });
    toast.success("تم التسجيل");
    setReason("");
    loadRecords();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من الحذف؟")) return;
    await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table: "discipline_records", action: "delete", data: { id } }) });
    toast.success("تم الحذف");
    loadRecords();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">التوبيخات والاستحسانات</h2>
      <div className="flex gap-4 flex-wrap items-end">
        <div className="w-64">
          <Select value={circleId} onValueChange={(v) => { setCircleId(v); setStudentId(""); setRecords([]); }}>
            <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
            <SelectContent>
              {teachers.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-64">
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
            <SelectContent>
              {circleStudents.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={type} onValueChange={(v) => setType(v as "reprimand" | "praise")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="reprimand">توبيخ</SelectItem>
              <SelectItem value="praise">استحسان</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Textarea placeholder="سبب التوبيخ أو الاستحسان..." value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button onClick={handleSubmit}>تسجيل</Button>
        <Button variant="outline" onClick={loadRecords}>تحديث</Button>
        <Button variant="outline" onClick={() => exportDisciplineToExcel(records, "الانضباط.xlsx")}>تصدير Excel</Button>
      </div>
      <DataTable
        columns={[
          { key: "student_name", header: "الطالب", filter: { type: "text", placeholder: "بحث بالاسم" } },
          { key: "circle_name", header: "الحلقة", filter: { type: "select", placeholder: "كل الحلقات", options: teachers.map((t: any) => ({ label: t.full_name, value: t.id })), filterValue: (r: any) => r.circle_id || "" } },
          { key: "type", header: "النوع", render: (r: any) => (
            <Badge variant={r.type === "reprimand" ? "destructive" : "secondary"}>
              {DISCIPLINE_TYPE_LABELS[r.type] ?? r.type}
            </Badge>
          ), filter: { type: "select", placeholder: "كل الأنواع", options: DISCIPLINE_FILTER_OPTS } },
          { key: "reason", header: "السبب", filter: { type: "text", placeholder: "بحث بالسبب" } },
          { key: "record_date", header: "التاريخ", render: (r: any) => formatDate(r.record_date) },
          { key: "actions", header: "", render: (r: any) => (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(r.id)}>حذف</Button>
          ) },
        ]}
        data={records}
        keyExtractor={(r: any) => r.id}
      />
    </div>
  );
}
