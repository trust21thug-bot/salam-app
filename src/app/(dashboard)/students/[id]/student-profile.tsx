"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { getAge, CLASSIFICATION_LABELS, ACADEMIC_LEVELS, FILE_STATUS_LABELS } from "@/lib/utils";

interface Props {
  data: {
    student: any;
    records: any[];
    tracking: any[];
    discipline: any[];
    generalRanking: any | null;
    schoolYear?: any[];
    siblings?: any[];
  };
}

function formatDate(d: Date): string {
  const months = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

function MemoCurve({ data, startDate }: { data: any[]; startDate?: Date | null }) {
  if (data.length < 2) return null;
  const sorted = [...data].sort((a, b) => (a.week_number || 0) - (b.week_number || 0));
  const values = sorted.map((t) => t.memorization_amount || 0);
  const cumulative: number[] = [];
  let sum = 0;
  for (const v of values) { sum += v; cumulative.push(sum); }
  const max = Math.max(...cumulative, 1);
  const w = 360, h = 100, padTop = 8, padBottom = 24, padSide = 8;
  const chartH = h - padTop - padBottom;
  const xStep = (w - padSide * 2) / (cumulative.length - 1 || 1);
  const pts = cumulative.map((v, i) => `${padSide + i * xStep},${padTop + chartH - ((v / max) * chartH)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" style={{ maxHeight: 110 }}>
      <rect x={0} y={0} width={w} height={h} fill="#f0fdf4" rx={6} />
      <polyline points={pts} fill="none" stroke="#16a34a" strokeWidth={2} strokeLinejoin="round" />
      {cumulative.map((v, i) => (
        <circle key={i} cx={padSide + i * xStep} cy={padTop + chartH - ((v / max) * chartH)} r={3} fill="#16a34a" />
      ))}
      <text x={w - padSide} y={padTop + 2} textAnchor="end" fontSize={8} fill="#6b7280">{max.toFixed(1)}</text>
      <text x={padSide} y={padTop + 2} textAnchor="start" fontSize={8} fill="#6b7280">0</text>
      {startDate && sorted.map((t, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + (t.week_number - 1) * 7);
        const label = i % 2 === 0 ? formatDate(d) : "";
        return label ? (
          <text key={i} x={padSide + i * xStep} y={h - 4} textAnchor="middle" fontSize={7} fill="#6b7280">
            {label}
          </text>
        ) : null;
      })}
    </svg>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-dashed border-green-100 last:border-0">
      <span className="text-sm" style={{ color: "#4b5563" }}>{label}</span>
      <span className={`text-sm font-medium ${highlight ? "text-amber-700" : ""}`}>{value}</span>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #e8f5e9" }}>
      <div className="px-4 py-2" style={{ background: "linear-gradient(135deg, #1b5e20, #2e7d32)", color: "#fff" }}>
        <span className="text-sm font-bold">{icon ? `${icon} ` : ""}{title}</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center p-3 rounded-lg" style={{ background: color || "#f0fdf4" }}>
      <div className="text-lg font-bold" style={{ color: "#1b5e20" }}>{value}</div>
      <div className="text-xs" style={{ color: "#6b7280" }}>{label}</div>
    </div>
  );
}

export function StudentProfile({ data }: Props) {
  const { student, records, tracking, discipline, generalRanking, schoolYear, siblings } = data;
  const sy = (schoolYear ?? []) as any[];
  const startDate = sy?.[0]?.start_date ? new Date(sy[0].start_date) : null;

  const sortedWr = useMemo(() =>
    [...(data as any).weeklyRankings || []].sort((a: any, b: any) => (a.week_number || 0) - (b.week_number || 0)),
    [data]
  );
  const monthlyWeeks = sortedWr.slice(-4);
  const monthlyAvg = monthlyWeeks.length
    ? (monthlyWeeks.reduce((s: number, w: any) => s + (w.total_score || 0), 0) / monthlyWeeks.length).toFixed(1)
    : null;

  const reprimandCount = discipline.filter((d: any) => d.type === "reprimand").length;
  const praiseCount = discipline.filter((d: any) => d.type === "praise").length;

  const sortedTracking = useMemo(() =>
    [...tracking].sort((a: any, b: any) => (a.week_number || 0) - (b.week_number || 0)),
    [tracking]
  );

  const totalMemorization = sortedTracking.reduce((s: number, t: any) => s + (t.memorization_amount || 0), 0);
  const totalRevision = sortedTracking.reduce((s: number, t: any) => s + (t.revision_amount || 0), 0);

  const latestTrack = sortedTracking[sortedTracking.length - 1];
  const latestWard = latestTrack?.ward_score || 0;
  const latestBehavior = latestTrack?.behavior_score || 0;

  const present = records.filter((r: any) => r.status === "present").length;
  const absent = records.filter((r: any) => r.status === "absent").length;
  const late = records.filter((r: any) => r.status === "late").length;
  const excused = records.filter((r: any) => r.status === "excused_accepted" || r.status === "excused_rejected").length;
  const totalSessions = records.length;
  const attendanceRate = totalSessions > 0 ? Math.round(((present + excused) / totalSessions) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold" style={{ color: "#1b5e20" }}>السيرة الذاتية للطالب</h1>
        <p className="text-sm" style={{ color: "#c8a45c" }}>مدرسة السلام القرآنية</p>
        <div className="w-16 h-0.5 mx-auto mt-2" style={{ background: "#c8a45c" }} />
      </div>

      <div className="rounded-xl overflow-hidden mb-6" style={{ border: "2px solid #e8f5e9" }}>
        {/* Header */}
        <div className="p-6 flex items-center gap-5" style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
          {(() => {
            const isValidPhotoUrl = student.photo_url && !student.photo_url.startsWith("blob:");
            return isValidPhotoUrl ? (
              <img src={student.photo_url} alt={student.first_name}
                className="w-24 h-28 object-cover border-2" style={{ borderColor: "#1b5e20" }}
                onError={(e) => { (e.target as HTMLElement).style.display = "none"; }} />
            ) : (
              <div className="w-24 h-28 flex items-center justify-center text-3xl font-bold border-2"
                style={{ background: "#e8f5e9", color: "#4b5563", borderColor: "#1b5e20" }}>
                {student.first_name?.charAt(0) || "?"}
              </div>
            );
          })()}
          <div className="flex-1">
            <h2 className="text-xl font-bold" style={{ color: "#1b5e20" }}>{student.first_name} {student.last_name}</h2>
            <p className="text-sm" style={{ color: "#4b5563" }}>
              حلقة: {student.teachers?.full_name || "—"} | {getAge(student.birth_date)} سنة
            </p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1b5e20", color: "#fff" }}>
                {CLASSIFICATION_LABELS[student.classification as string]}
              </span>
              {student.file_status ? (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#c8a45c", color: "#fff" }}>
                  حالة الملف: {FILE_STATUS_LABELS[student.file_status] || student.file_status}
                </span>
              ) : null}
              {student.academic_level ? (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#e8f5e9", color: "#1b5e20" }}>
                  {ACADEMIC_LEVELS[student.academic_level] || student.academic_level}
                </span>
              ) : null}
              {student.total_memorization ? (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#e8f5e9", color: "#1b5e20" }}>
                  الحفظ: {student.total_memorization} حزب
                </span>
              ) : null}
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: student.insurance ? "#16a34a" : "#ef4444", color: "#fff" }}>
                {student.insurance ? "مؤمن عليه" : "غير مؤمن"}
              </span>
              {student.master_evaluation != null ? (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#e8f5e9", color: "#1b5e20" }}>
                  الضبط: {student.master_evaluation}%
                </span>
              ) : null}
              {generalRanking?.rank_position ? (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#c8a45c", color: "#fff" }}>
                  الترتيب العام: #{generalRanking.rank_position}
                </span>
              ) : null}
              {monthlyAvg !== null ? (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#1b5e20", color: "#fff" }}>
                  الشهري: {monthlyAvg}
                </span>
              ) : null}
            </div>
          </div>
          <Button variant="outline" size="sm" asChild
            style={{ borderColor: "#1b5e20", color: "#1b5e20" }}>
            <a href={`/api/pdf/cv/${student.id}`} target="_blank">PDF</a>
          </Button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5" style={{ background: "#fafdf8" }}>

          {/* 1. Memorization Curve - Most Important */}
          {sortedTracking.length >= 2 && (
            <Section title="منحنى الحفظ" icon="📈">
              <MemoCurve data={sortedTracking} startDate={startDate} />
              <div className="grid grid-cols-3 gap-3 mt-3">
                <StatBox label="إجمالي الحفظ" value={`${totalMemorization.toFixed(2)}`} color="#f0fdf4" />
                <StatBox label="إجمالي المراجعة" value={`${totalRevision.toFixed(2)}`} color="#fefce8" />
                <StatBox label="عدد الأسابيع" value={`${sortedTracking.length}`} color="#eff6ff" />
              </div>
            </Section>
          )}

          {/* 2. Academic Performance */}
          <Section title="الأداء الأكاديمي" icon="📚">
            <div className="space-y-1">
              <Row label="إجمالي الحفظ" value={`${totalMemorization.toFixed(2)} حزب`} highlight />
              <Row label="إجمالي المراجعة" value={`${totalRevision.toFixed(2)} حزب`} />
              {student.total_memorization ? <Row label="مقدار الحفظ الكلي" value={`${student.total_memorization} حزب`} highlight /> : null}
              {student.master_evaluation != null ? <Row label="نسبة ضبط الحفظ" value={`${student.master_evaluation}%`} highlight /> : null}
              <Row label="آخر ورد" value={`${latestWard}/10`} />
              <Row label="آخر سلوك" value={`${latestBehavior}/10`} />
              {generalRanking?.rank_position && <Row label="الترتيب العام" value={`#${generalRanking.rank_position}`} highlight />}
              {generalRanking?.total_score != null && <Row label="النقاط" value={`${generalRanking.total_score}`} />}
            </div>
          </Section>

          {/* 3. Attendance */}
          <Section title="الحضور" icon="✅">
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 rounded-full" style={{ background: "#e8f5e9" }}>
                  <div className="h-2 rounded-full" style={{ width: `${attendanceRate}%`, background: attendanceRate >= 80 ? "#16a34a" : attendanceRate >= 60 ? "#c8a45c" : "#ef4444" }} />
                </div>
                <span className="text-sm font-bold" style={{ color: "#1b5e20" }}>{attendanceRate}%</span>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2 text-center text-xs">
              <div><span className="font-bold" style={{ color: "#16a34a" }}>{present}</span><br /><span style={{ color: "#6b7280" }}>حاضر</span></div>
              <div><span className="font-bold" style={{ color: "#ef4444" }}>{absent}</span><br /><span style={{ color: "#6b7280" }}>غائب</span></div>
              <div><span className="font-bold" style={{ color: "#c8a45c" }}>{late}</span><br /><span style={{ color: "#6b7280" }}>متأخر</span></div>
              <div><span className="font-bold" style={{ color: "#6b7280" }}>{excused}</span><br /><span style={{ color: "#6b7280" }}>مبرر</span></div>
              <div><span className="font-bold">{totalSessions}</span><br /><span style={{ color: "#6b7280" }}>إجمالي</span></div>
            </div>
          </Section>

          {/* 4. Discipline */}
          <Section title="الانضباط" icon="⭐">
            <div className="flex gap-4 mb-3">
              <div className="flex-1 text-center p-2 rounded" style={{ background: "#fef2f2" }}>
                <span className="font-bold" style={{ color: "#dc2626" }}>{reprimandCount}</span>
                <span className="text-xs mr-1" style={{ color: "#6b7280" }}>توبيخ</span>
              </div>
              <div className="flex-1 text-center p-2 rounded" style={{ background: "#f0fdf4" }}>
                <span className="font-bold" style={{ color: "#16a34a" }}>{praiseCount}</span>
                <span className="text-xs mr-1" style={{ color: "#6b7280" }}>استحسان</span>
              </div>
            </div>
            {discipline.slice(0, 4).map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-dashed border-green-100 last:border-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${d.type === "reprimand" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                  {d.type === "reprimand" ? "توبيخ" : "استحسان"}
                </span>
                <span className="flex-1" style={{ color: "#374151" }}>{d.reason}</span>
              </div>
            ))}
          </Section>

          {/* 5. Personal Info */}
          <Section title="معلومات شخصية" icon="📋">
            <div className="space-y-1">
              <Row label="تاريخ الميلاد" value={student.birth_date || "—"} />
              <Row label="المستوى الدراسي" value={ACADEMIC_LEVELS[student.academic_level] || student.academic_level || "—"} />
              <Row label="هاتف الولي" value={student.guardian_phone || "—"} />
              <Row label="التصنيف" value={CLASSIFICATION_LABELS[student.classification as string] || student.classification || "—"} />
              {student.illness && <Row label="مرض" value={student.illness} />}
              {student.neighborhood && <Row label="الحي" value={student.neighborhood} />}
              <Row label="يذهب بمفرده" value={student.goes_alone ? "نعم" : "لا"} />
              {student.problem_days && <Row label="الأيام المشكلة" value={student.problem_days} />}
              {student.notes && <Row label="ملاحظات" value={student.notes} />}
              {(siblings?.length ?? 0) > 0 && (
                <Row label="الإخوة في المدرسة" value={siblings!.map((s: any) => `${s.first_name} ${s.last_name}`).join("، ")} />
              )}
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="p-3 text-center text-[10px]" style={{ background: "#f0fdf4", color: "#6b7280" }}>
          تم التوليد من نظام إدارة مدرسة السلام — {new Date().toLocaleDateString("ar-SA")}
        </div>
      </div>
    </div>
  );
}
