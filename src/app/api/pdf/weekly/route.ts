import { createAdminClient } from "@/lib/supabase/admin";
import { calculateMemorizationScore, calculateRevisionScore } from "@/lib/formulas/grading";
import { calculateOverall, getGradeLabel } from "@/lib/formulas/semester";

const DAY_LABELS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const ATTENDANCE_COLORS: Record<string, string> = {
  present: "#16a34a",
  absent: "#ef4444",
  late: "#f59e0b",
  excused_accepted: "#c8a45c",
  excused_rejected: "#dc2626",
};
const ATTENDANCE_LABELS: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused_accepted: "مبرر مقبول",
  excused_rejected: "مبرر غير مقبول",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const studentId = url.searchParams.get("student_id");
  const weekNumber = parseInt(url.searchParams.get("week") ?? "1");
  const notes = url.searchParams.get("notes") || "";
  const db = createAdminClient();

  if (!studentId) return Response.json({ error: "student_id required" }, { status: 400 });

  const { data: s } = await db.from("students").select("*").eq("id", studentId).single();
  const student = s as any;
  if (!student) return Response.json({ error: "Student not found" }, { status: 400 });
  const { data: teacher } = await db.from("teachers").select("*").eq("id", student.circle_id).single();
  const teacherName = (teacher as any)?.full_name || "";

  const { data: rawTracking } = await db.from("weekly_tracking")
    .select("*")
    .eq("student_id", studentId)
    .eq("week_number", weekNumber);
  const tracking = (rawTracking ?? []) as any[];
  const weekData = tracking[0];

  const { data: rawAttendance } = await db.from("attendance_records")
    .select("*")
    .eq("student_id", studentId)
    .eq("week_number", weekNumber)
    .order("day_of_week", { ascending: true });
  const attendance = (rawAttendance ?? []) as any[];

  const requiredMem = student.required_memorization ?? 0.25;
  const requiredRev = student.required_revision ?? 0.25;

  const memScore = weekData ? calculateMemorizationScore(weekData.memorization_amount ?? 0, requiredMem) : 0;
  const revScore = weekData ? calculateRevisionScore(weekData.revision_amount ?? 0, requiredRev) : 0;
  const wardScore = weekData?.ward_score || 0;
  const behScore = weekData?.behavior_score || 0;

  const present = attendance.filter((a: any) => a.status === "present").length;
  const excusedAccepted = attendance.filter((a: any) => a.status === "excused_accepted").length;
  const excusedRejected = attendance.filter((a: any) => a.status === "excused_rejected").length;
  const late = attendance.filter((a: any) => a.status === "late").length;
  const absent = attendance.filter((a: any) => a.status === "absent").length;
  const totalDays = attendance.length;
  const attScore = totalDays > 0 ? (present / totalDays) * 10 : 0;

  const academicLevel = student.academic_level || "";
  const isElementary = academicLevel.includes("ابتدائي");
  const outOf = isElementary ? 10 : 20;
  const overall = calculateOverall(memScore, revScore, wardScore, behScore, attScore, academicLevel);
  const grade = getGradeLabel(overall / (outOf / 10));

  // Attendance table rows
  const attRows = attendance.map((a: any) => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">${DAY_LABELS[a.day_of_week] || "—"}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:center">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ATTENDANCE_COLORS[a.status] || "#ccc"};margin-left:6px;vertical-align:middle"></span>
        ${ATTENDANCE_LABELS[a.status] || a.status}
      </td>
    </tr>
  `).join("");

  const totalAttendances = present + absent + late + excusedAccepted + excusedRejected;

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>التقرير الأسبوعي — ${student.first_name} ${student.last_name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A5 portrait; margin: 0.6cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', sans-serif; font-size: 14px; color: #333; background: #f5f5f5; }
    .page { max-width: 100%; margin: 0; background: #fff; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1b5e20, #2e7d32); padding: 8px 12px; color: #fff; text-align: center; }
    .header h1 { font-size: 16px; font-weight: 800; }
    .header .subtitle { font-size: 12px; opacity: 0.9; font-weight: 500; margin-top: 2px; }
    .header .divider { height: 2px; background: #c8a45c; width: 30px; margin: 3px auto; }
    .body { padding: 6px 10px; }
    .section { margin-bottom: 6px; border: 1px solid #e8f5e9; border-radius: 6px; overflow: hidden; }
    .section-title { background: linear-gradient(135deg, #1b5e20, #2e7d32); color: #fff; padding: 4px 8px; font-size: 12px; font-weight: 700; }
    .section-body { padding: 5px 8px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 2px 0; border-bottom: 1px dashed #e8f5e9; }
    .row:last-child { border-bottom: none; }
    .row .label { color: #555; font-size: 12px; }
    .row .value { font-weight: 700; font-size: 12px; }
    .row .value.gold { color: #c8a45c; }
    .row .value.green { color: #1b5e20; }
    .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
    .score-box { text-align: center; padding: 5px 2px; border-radius: 6px; }
    .score-box .num { font-size: 18px; font-weight: 800; }
    .score-box .lbl { font-size: 10px; color: #555; margin-top: 1px; font-weight: 500; }
    .score-box.green { background: #f0fdf4; }
    .score-box.gold { background: #fefce8; }
    .score-box.blue { background: #eff6ff; }
    .score-box .num.green { color: #1b5e20; }
    .score-box .num.gold { color: #c8a45c; }
    .score-box .num.blue { color: #2563eb; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
    .detail-box { padding: 4px 8px; border-radius: 6px; }
    .detail-box.memo { background: #f0fdf4; }
    .detail-box.rev { background: #eff6ff; }
    .detail-box .dlbl { font-size: 10px; color: #666; }
    .detail-box .dval { font-size: 14px; font-weight: 700; }
    .detail-box .dsub { font-size: 11px; color: #888; }
    table.attendance { width: 100%; border-collapse: collapse; font-size: 12px; }
    table.attendance th { background: #f0fdf4; padding: 4px 8px; border: 1px solid #ddd; font-weight: 700; font-size: 11px; }
    .actions { text-align: center; padding: 6px; }
    .actions button { background: #1b5e20; color: #fff; border: none; padding: 6px 16px; font-size: 13px; border-radius: 6px; cursor: pointer; }
    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; border-radius: 0; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>التقرير الأسبوعي</h1>
      <div class="divider"></div>
      <div class="subtitle">${student.first_name} ${student.last_name} — ${teacherName}</div>
      <div style="margin-top:2px;font-size:11px;opacity:0.75">الأسبوع رقم ${weekNumber}</div>
    </div>

    <div class="body">
      <div class="score-grid">
        <div class="score-box green"><div class="num green">${Math.min(memScore + revScore, 10).toFixed(1)}</div><div class="lbl">الحفظ والمراجعة</div></div>
        <div class="score-box blue"><div class="num blue">${wardScore.toFixed(1)}</div><div class="lbl">الورد</div></div>
        <div class="score-box green"><div class="num green">${behScore.toFixed(1)}</div><div class="lbl">السلوك</div></div>
        <div class="score-box gold"><div class="num gold">${attScore.toFixed(1)}</div><div class="lbl">الحضور</div></div>
      </div>

      <div class="section">
        <div class="section-title">تفاصيل الحفظ والمراجعة</div>
        <div class="section-body">
          <div class="detail-grid">
            <div class="detail-box memo">
              <div class="dlbl">الحفظ</div>
              <div class="dval" style="color:#16a34a">${weekData?.memorization_amount?.toFixed(2) || "0"} حزب</div>
              <div class="dsub">العلامة: ${memScore.toFixed(1)} / 10</div>
            </div>
            <div class="detail-box rev">
              <div class="dlbl">المراجعة</div>
              <div class="dval" style="color:#2563eb">${weekData?.revision_amount?.toFixed(2) || "0"} حزب</div>
              <div class="dsub">العلامة: ${revScore.toFixed(1)} / 10</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">سجل الحضور</div>
        <div class="section-body">
          ${totalAttendances > 0 ? `
          <table class="attendance">
            <thead><tr><th>اليوم</th><th>الحالة</th></tr></thead>
            <tbody>${attRows}</tbody>
          </table>
          ` : `<p style="font-size:12px;color:#999;text-align:center">لا توجد سجلات حضور لهذا الأسبوع</p>`}
          <div style="display:flex;gap:8px;margin-top:6px;font-size:9px;color:#666;flex-wrap:wrap">
            <span>● <span style="color:#16a34a">حاضر</span></span>
            <span>● <span style="color:#c8a45c">مبرر مقبول</span></span>
            <span>● <span style="color:#dc2626">مبرر غير مقبول</span></span>
            <span>● <span style="color:#f59e0b">متأخر</span></span>
            <span>● <span style="color:#ef4444">غائب</span></span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">المعدل العام والتقدير</div>
        <div class="section-body">
          <div class="row">
            <span class="label">المعدل العام</span>
            <span class="value gold" style="font-size:16px">${overall.toFixed(1)} / ${outOf}</span>
          </div>
          <div class="row">
            <span class="label">التقدير</span>
            <span class="value green" style="font-size:14px">${grade}</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <button onclick="window.print()">طباعة / حفظ PDF</button>
      </div>

      <div style="text-align:center;padding:8px;font-size:9px;color:#999">
        مدرسة السلام القرآنية — تم التوليد ${new Date().toLocaleDateString("ar-SA")}
      </div>
    </div>
  </div>

  ${url.searchParams.get("download") ? `<script>window.onload = () => setTimeout(() => window.print(), 500);</script>` : ""}
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
