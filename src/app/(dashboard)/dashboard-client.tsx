"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DAY_LABELS } from "@/lib/utils";
import type { Teacher, AssistantTeacher, Attendant } from "@/types/database";
import { getTeacherTime, getTeacherDays } from "@/types/database";
import { usePrayerTimes } from "@/lib/hooks/use-prayer-times";

interface Props {
  stats: { studentCount: number; teacherCount: number; groupCount: number };
  teachers: Teacher[];
  assistants: AssistantTeacher[];
  attendants: Attendant[];
}

const ALL_DAYS = [5, 6, 0, 1, 2, 3, 4];
const DAY_NAMES = ALL_DAYS.map((d) => DAY_LABELS[d]);

const TEACHER_COLORS = [
  "#4A6FA5", "#D4756B", "#5B8C5A", "#B5814A", "#6B5B95",
  "#C75050", "#4A8C8C", "#B56576", "#82B366", "#BE7C4A",
  "#5F9EA0", "#CD5C5C", "#6B8E23", "#8B5A2B", "#2E8B57",
  "#8B7D6B", "#A0522D", "#4682B4", "#8FBC8F", "#B8860B",
];

const COLORS = {
  ink: "#1C1A14",
  gold: "#7C5C1E",
  goldLight: "#B8922E",
  goldBright: "#D4A843",
  ivory: "#F7F2E7",
  deepParch: "#D9CBA8",
  olive: "#4A5E2F",
  amBg: "#FBF6E8",
  amBorder: "#C4962A",
  amText: "#7C5C1E",
  pmBg: "#F0F4E8",
  pmBorder: "#4A5E2F",
  pmText: "#3A4A24",
  evBg: "#F8EDE4",
  evBorder: "#8B3A1A",
  evText: "#6B2A10",
};

function extractStart(raw: string): string {
  const m = raw.match(/^من (.+) إلى/);
  return m ? m[1].trim() : raw;
}

function getPeriod(time: string): "am" | "pm" | "ev" {
  const start = extractStart(time);
  if (/فجر|شروق/.test(start)) return "am";
  if (/ظهر|عصر/.test(start)) return "pm";
  if (/مغرب|عشاء/.test(start)) return "ev";
  const h = parseInt(start.split(":")[0]);
  if (isNaN(h)) return "am";
  if (h < 12) return "am";
  if (h < 17) return "pm";
  return "ev";
}

function periodStyle(period: "am" | "pm" | "ev") {
  if (period === "am") return { bg: COLORS.amBg, border: COLORS.amBorder, text: COLORS.amText };
  if (period === "pm") return { bg: COLORS.pmBg, border: COLORS.pmBorder, text: COLORS.pmText };
  return { bg: COLORS.evBg, border: COLORS.evBorder, text: COLORS.evText };
}

function periodLabel(period: "am" | "pm" | "ev") {
  if (period === "am") return { label: "صباحي", color: COLORS.amBorder };
  if (period === "pm") return { label: "نهاري", color: COLORS.pmBorder };
  return { label: "مسائي", color: COLORS.evBorder };
}

function StatCard({ title, value, icon, subtitle }: { title: string; value: number; icon: string; subtitle?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-muted-foreground font-medium">{title}</CardTitle>
          <span className="text-lg opacity-60">{icon}</span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-primary tracking-tight">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardClient({ stats, teachers, assistants, attendants }: Props) {
  const router = useRouter();
  const { names: prayerNames, clockMap: prayerClockMap } = usePrayerTimes();

  const teacherMap = useMemo(() => {
    const map = new Map<string, Teacher>();
    for (const t of teachers) map.set(t.id, t);
    return map;
  }, [teachers]);

  const assistantMap = useMemo(() => {
    const map = new Map<string, AssistantTeacher[]>();
    for (const a of assistants) {
      const list = map.get(a.teacher_id) ?? [];
      list.push(a);
      map.set(a.teacher_id, list);
    }
    return map;
  }, [assistants]);

  const teacherColorMap = useMemo(() => {
    const map = new Map<string, string>();
    teachers.forEach((t, i) => map.set(t.full_name, TEACHER_COLORS[i % TEACHER_COLORS.length]));
    return map;
  }, [teachers]);

  const slots = useMemo(() => {
    const map = new Map<string, {
      time: string;
      cells: { day: number; entries: { teacherName: string; asstNames: string[] }[] }[];
    }>();

    for (const t of teachers) {
      const assts = assistantMap.get(t.id) ?? [];
      const days = getTeacherDays(t);
      for (const d of days) {
        if (!ALL_DAYS.includes(d)) continue;
        const time = getTeacherTime(t, d);
        if (!time) continue;
        if (!map.has(time)) {
          map.set(time, {
            time,
            cells: ALL_DAYS.map((day) => ({ day, entries: [] })),
          });
        }
        const cell = map.get(time)!.cells.find((c) => c.day === d)!;
        const asstNames = assts.filter((a) => getTeacherDays(a).includes(d) && getTeacherTime(a, d)).map((a) => a.full_name);
        cell.entries.push({ teacherName: t.full_name, asstNames });
      }
    }

    const toMinutes = (s: string): number => {
      const m = s.match(/^(\d{1,2}):(\d{2})$/);
      if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
      const clock = prayerClockMap[s];
      if (clock) {
        const cm = clock.match(/^(\d{1,2}):(\d{2})$/);
        if (cm) return parseInt(cm[1]) * 60 + parseInt(cm[2]);
      }
      return 1e9;
    };
    return [...map.values()].sort((a, b) => {
      return toMinutes(extractStart(a.time)) - toMinutes(extractStart(b.time));
    });
  }, [teachers, assistantMap, prayerClockMap]);

  const handleSeed = async () => {
    await fetch("/api/seed", { method: "POST" });
    router.refresh();
  };

  const handleImport = async () => {
    try {
      const res = await fetch("/api/import-excel", { method: "POST" });
      const data = await res.json();
      if (data.ok) toast.success(`تم استيراد ${data.imported} طالبًا من ${data.teachers} حلقة`);
      else toast.error(data.error || "فشل الاستيراد");
    } catch {
      toast.error("فشل الاتصال");
    }
    router.refresh();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold">لوحة التحكم</h2>
          <p className="text-sm text-muted-foreground mt-1">نظرة عامة على بيانات المدرسة</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSeed} variant="outline" size="sm">تعبئة بيانات اختبار</Button>
          <Button onClick={handleImport} size="sm">استيراد قائمة الطلبة</Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard title="الطلبة المسجلون" value={stats.studentCount} icon="👤" subtitle="إجمالي الطلبة في جميع الحلقات" />
        <StatCard title="الأساتذة" value={stats.teacherCount} icon="👨‍🏫" subtitle="مشرفو الحلقات" />
        <StatCard title="مجموعات الترتيب" value={stats.groupCount} icon="🏆" subtitle="مجموعات التراتيب" />
      </div>

      {/* ========== جدول توقيت الدراسة ========== */}
      <Card className="overflow-hidden border-0 shadow-lg" style={{ background: COLORS.ivory }}>
        <CardHeader className="pb-4" style={{ background: COLORS.ink }}>
          <CardTitle className="text-xl font-bold" style={{ color: COLORS.goldBright }}>
            جدول توقيت الدراسة
          </CardTitle>
          <p className="text-xs mt-0.5" style={{ color: "rgba(212,168,67,0.55)" }}>
            الدورة القرآنية
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          {/* Header */}
          <div className="grid min-w-[800px]" style={{ gridTemplateColumns: "160px repeat(7, 1fr)" }}>
            <div
              className="text-sm font-bold p-3 sticky right-0"
              style={{ background: COLORS.ink, color: COLORS.goldBright, textAlign: "right", paddingRight: 16, borderBottom: `2px solid ${COLORS.gold}` }}
            >
              الفترة
            </div>
            {DAY_NAMES.map((name) => (
              <div
                key={name}
                className="text-sm font-bold p-3 text-center"
                style={{ background: COLORS.ink, color: COLORS.goldBright, borderLeft: "0.5px solid rgba(212,168,67,0.12)", borderBottom: `2px solid ${COLORS.gold}` }}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Rows */}
          {slots.length === 0 ? (
            <div className="text-center py-12 text-sm" style={{ color: COLORS.goldLight }}>
              لا توجد بيانات
            </div>
          ) : slots.map((slot, idx) => {
            const period = getPeriod(slot.time);
            const ps = periodStyle(period);
            const isLast = idx === slots.length - 1;
            return (
              <div key={slot.time} className="grid min-w-[800px]" style={{ gridTemplateColumns: "160px repeat(7, 1fr)" }}>
                <div
                  className="text-sm font-bold p-4 flex items-center justify-end text-right leading-relaxed"
                  style={{
                    background: ps.bg,
                    color: ps.text,
                    borderRight: `4px solid ${ps.border}`,
                    borderBottom: isLast ? "none" : "0.5px solid var(--border)",
                    borderLeft: "0.5px solid var(--border)",
                  }}
                >
                  {slot.time}
                </div>
                {slot.cells.map((cell) => (
                  <div
                    key={cell.day}
                    className="p-3 flex flex-col items-end justify-start gap-2 leading-relaxed"
                    style={{
                      background: ps.bg,
                      minHeight: 80,
                      borderBottom: isLast ? "none" : "0.5px solid var(--border)",
                      borderLeft: "0.5px solid rgba(217,203,168,0.45)",
                    }}
                  >
                    {cell.entries.length > 0
                      ? cell.entries.map((e, ei) => {
                          const tc = teacherColorMap.get(e.teacherName) ?? ps.text;
                          return (
                            <div key={ei} className="text-sm font-semibold text-right w-full rounded px-1.5 py-0.5 mb-0.5" style={{ background: tc + "44", color: tc, borderRight: `3px solid ${tc}` }}>
                              {e.asstNames.length > 0
                                ? `${e.teacherName} مع ${e.asstNames.join(" و ")}`
                                : e.teacherName}
                            </div>
                          );
                        })
                      : <span className="text-xs" style={{ color: "#ccc" }}>—</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs" style={{ color: COLORS.gold }}>
        {(["am", "pm", "ev"] as const).map((p) => {
          const pl = periodLabel(p);
          return (
            <div key={p} className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-sm" style={{ background: pl.color }} />
              <span>{pl.label}</span>
            </div>
          );
        })}
      </div>

      {/* ========== جدول المداومين ========== */}
      {attendants.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: COLORS.deepParch }} />
            <span className="text-xs font-semibold tracking-wider" style={{ color: COLORS.gold }}>جدول المداومين</span>
            <div className="flex-1 h-px" style={{ background: COLORS.deepParch }} />
          </div>
          <Card className="overflow-hidden border-0 shadow-md" style={{ background: COLORS.ivory }}>
            <div className="overflow-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b" style={{ background: COLORS.ink }}>
                    <th className="text-right p-3 font-bold" style={{ color: COLORS.goldBright }}>الاسم</th>
                    <th className="text-center p-3 font-bold" style={{ color: COLORS.goldBright }}>الرقم</th>
                    {DAY_NAMES.map((d) => (
                      <th key={d} className="text-center p-3 font-bold" style={{ color: COLORS.goldBright }}>{d}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendants.map((a, idx) => (
                    <tr key={a.id} style={{ background: idx % 2 === 1 ? "rgba(0,0,0,0.02)" : "transparent", borderBottom: `0.5px solid ${COLORS.deepParch}` }}>
                      <td className="p-3 font-semibold" style={{ color: COLORS.ink }}>{a.full_name}</td>
                      <td className="p-3 text-center" dir="ltr" style={{ color: COLORS.goldLight }}>{a.attendant_number || "—"}</td>
                      {ALL_DAYS.map((d) => (
                        <td key={d} className="p-3 text-center" style={{ color: COLORS.olive }}>
                          {a.duty_days.includes(d) ? "✓" : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ========== أرقام المدرسين ========== */}
      {(teachers.length > 0 || assistants.length > 0) && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: COLORS.deepParch }} />
            <span className="text-xs font-semibold tracking-wider" style={{ color: COLORS.gold }}>أرقام المدرسين</span>
            <div className="flex-1 h-px" style={{ background: COLORS.deepParch }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {teachers.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 p-2.5 rounded-md"
                style={{ background: COLORS.ivory, border: `1px solid ${COLORS.deepParch}` }}
              >
                <div
                  className="size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: "rgba(74,94,47,0.12)", color: COLORS.olive }}
                >
                  {t.full_name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[10px] font-semibold px-1.5 rounded-sm inline-block mb-0.5"
                    style={{ background: "rgba(74,94,47,0.1)", color: COLORS.olive }}
                  >
                    مدرس
                  </div>
                  <div className="text-xs font-semibold truncate" style={{ color: COLORS.ink }}>{t.full_name}</div>
                  {t.phone && <div className="text-[10px]" dir="ltr" style={{ color: COLORS.goldLight }}>{t.phone}</div>}
                </div>
              </div>
            ))}
            {assistants.filter((a) => a.phone).map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 p-2.5 rounded-md"
                style={{ background: COLORS.ivory, border: `1px solid ${COLORS.deepParch}` }}
              >
                <div
                  className="size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: "rgba(74,94,47,0.12)", color: COLORS.olive }}
                >
                  {a.full_name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[10px] font-semibold px-1.5 rounded-sm inline-block mb-0.5"
                    style={{ background: "rgba(124,92,30,0.1)", color: COLORS.gold }}
                  >
                    مساعد
                  </div>
                  <div className="text-xs font-semibold truncate" style={{ color: COLORS.ink }}>{a.full_name}</div>
                  <div className="text-[10px]" dir="ltr" style={{ color: COLORS.goldLight }}>{a.phone}</div>
                </div>
              </div>
            ))}
            {attendants.filter((a) => a.attendant_number).map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 p-2.5 rounded-md"
                style={{ background: COLORS.ivory, border: `1px solid ${COLORS.deepParch}` }}
              >
                <div
                  className="size-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  style={{ background: "rgba(74,94,47,0.12)", color: COLORS.olive }}
                >
                  {a.full_name.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div
                    className="text-[10px] font-semibold px-1.5 rounded-sm inline-block mb-0.5"
                    style={{ background: "rgba(128,90,150,0.1)", color: "#6B5B95" }}
                  >
                    مداوم
                  </div>
                  <div className="text-xs font-semibold truncate" style={{ color: COLORS.ink }}>{a.full_name}</div>
                  <div className="text-[10px]" dir="ltr" style={{ color: COLORS.goldLight }}>{a.attendant_number}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
