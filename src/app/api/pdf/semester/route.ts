import { createAdminClient } from "@/lib/supabase/admin";
import { calculateOverall, getGradeLabel } from "@/lib/formulas/semester";
import { calculateMemorizationScore, calculateRevisionScore } from "@/lib/formulas/grading";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const weekStart = parseInt(url.searchParams.get("start") ?? "1");
  const weekEnd = parseInt(url.searchParams.get("end") ?? "13");
  const studentId = url.searchParams.get("student_id");
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
    .gte("week_number", weekStart)
    .lte("week_number", weekEnd);
  const tracking = (rawTracking ?? []) as any[];
  const sortedTracking = [...tracking].sort((a, b) => (a.week_number || 0) - (b.week_number || 0));

  const { data: sy } = await db.from("school_year").select("start_date").single();
  const schoolStart = (sy as any)?.start_date ? new Date((sy as any).start_date) : null;

  const { data: rawAttendance } = await db.from("attendance_records")
    .select("*")
    .eq("student_id", studentId)
    .gte("week_number", weekStart)
    .lte("week_number", weekEnd);
  const attendance = (rawAttendance ?? []) as any[];

  const requiredMem = student.required_memorization ?? 0.25;
  const requiredRev = student.required_revision ?? 0.25;

  const avgMem = tracking.length ? tracking.reduce((s, t: any) => s + calculateMemorizationScore(t.memorization_amount ?? 0, requiredMem), 0) / tracking.length : 0;
  const avgRev = tracking.length ? tracking.reduce((s, t: any) => s + calculateRevisionScore(t.revision_amount ?? 0, requiredRev), 0) / tracking.length : 0;
  const avgWard = tracking.length ? tracking.reduce((s, t: any) => s + (t.ward_score || 0), 0) / tracking.length : 0;
  const avgBeh = tracking.length ? tracking.reduce((s, t: any) => s + (t.behavior_score || 0), 0) / tracking.length : 0;
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
  const overall = calculateOverall(avgMem, avgRev, avgWard, avgBeh, attScore, academicLevel);
  const grade = getGradeLabel(overall / (outOf / 10));

  // Memorization curve SVG
  const memoCurveSvg = (() => {
    if (sortedTracking.length < 2) return "";
    const values = sortedTracking.map((t: any) => t.memorization_amount || 0);
    const cumulative: number[] = [];
    let sum = 0;
    for (const v of values) { sum += v; cumulative.push(sum); }
    const max = Math.max(...cumulative, 1);
    const months = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const formatDate = (d: Date) => `${d.getDate()} ${months[d.getMonth()]}`;
    const w = 540, h = 140, padTop = 8, padBottom = 24, padSide = 10;
    const chartH = h - padTop - padBottom;
    const xStep = (w - padSide * 2) / (cumulative.length - 1 || 1);
    const pts = cumulative.map((v, i) => `${padSide + i * xStep},${padTop + chartH - ((v / max) * chartH)}`).join(" ");
    const dateLabels = schoolStart ? sortedTracking.map((t: any, i: number) => {
      if (i % 2 !== 0) return "";
      const d = new Date(schoolStart);
      d.setDate(d.getDate() + (t.week_number - 1) * 7);
      return `<text x="${padSide + i * xStep}" y="${h - 4}" text-anchor="middle" font-size="10" fill="#6b7280">${formatDate(d)}</text>`;
    }).filter(Boolean).join("") : "";
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto">
      <rect x="0" y="0" width="${w}" height="${h}" fill="#f0fdf4" rx="6"/>
      <polyline points="${pts}" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linejoin="round"/>
      ${cumulative.map((v, i) => `<circle cx="${padSide + i * xStep}" cy="${padTop + chartH - ((v / max) * chartH)}" r="4" fill="#16a34a"/>`).join("")}
      <text x="${w - padSide}" y="${padTop + 2}" text-anchor="end" font-size="11" fill="#6b7280">${max.toFixed(1)}</text>
      <text x="${padSide}" y="${padTop + 2}" text-anchor="start" font-size="11" fill="#6b7280">0</text>
      ${dateLabels}
    </svg>`;
  })();


  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>التقرير الفصلي — ${student.first_name} ${student.last_name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A5 portrait; margin: 0.6cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', sans-serif; font-size: 20px; color: #333; background: #f5f5f5; }
    .page { max-width: 100%; margin: 0; background: #fff; }
    .header { background: linear-gradient(135deg, #1b5e20, #2e7d32); padding: 12px 16px; color: #fff; text-align: center; }
    .header h1 { font-size: 22px; margin-bottom: 2px; font-weight: 800; }
    .header .subtitle { font-size: 16px; opacity: 0.9; font-weight: 500; }
    .header .divider { height: 2px; background: #c8a45c; width: 50px; margin: 4px auto; }
    .body { padding: 10px 14px; }
    .section { margin-bottom: 10px; border: 1px solid #e8f5e9; border-radius: 8px; overflow: hidden; }
    .section-title { background: linear-gradient(135deg, #1b5e20, #2e7d32); color: #fff; padding: 8px 12px; font-size: 16px; font-weight: 700; }
    .section-body { padding: 8px 12px; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed #e8f5e9; }
    .row:last-child { border-bottom: none; }
    .row .label { color: #555; font-size: 15px; }
    .row .value { font-weight: 700; font-size: 15px; }
    .row .value.gold { color: #c8a45c; }
    .row .value.green { color: #1b5e20; }
    .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
    .score-box { text-align: center; padding: 8px 4px; border-radius: 8px; }
    .score-box .num { font-size: 26px; font-weight: 800; }
    .score-box .lbl { font-size: 13px; color: #555; margin-top: 2px; font-weight: 500; }
    .score-box.green { background: #f0fdf4; }
    .score-box.gold { background: #fefce8; }
    .score-box.blue { background: #eff6ff; }
    .score-box .num.green { color: #1b5e20; }
    .score-box .num.gold { color: #c8a45c; }
    .score-box .num.blue { color: #2563eb; }
    .chart { max-width: 100%; margin: 0 auto; }
    .att-bar { display: flex; height: 20px; border-radius: 10px; overflow: hidden; margin-top: 6px; }
    .att-bar .seg-present { background: #16a34a; }
    .att-bar .seg-excused { background: #c8a45c; }
    .att-bar .seg-late { background: #f59e0b; }
    .att-bar .seg-absent { background: #ef4444; }
    .att-bar .seg-rejected { background: #dc2626; }
    .note-area { width: 100%; min-height: 50px; padding: 8px 10px; border: 1px solid #e8f5e9; border-radius: 8px; font-family: 'Tajawal', sans-serif; font-size: 16px; resize: vertical; }
    .note-area:focus { outline: none; border-color: #1b5e20; }
    .actions { text-align: center; padding: 10px; }
    .actions button { background: #1b5e20; color: #fff; border: none; padding: 10px 24px; font-size: 16px; border-radius: 8px; cursor: pointer; }
    @media print {
      body { background: #fff; }
      .page { box-shadow: none; margin: 0; border-radius: 0; }
      .actions { display: none; }
      .note-area { border: none; background: #f9f9f9; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>التقرير الفصلي</h1>
      <div class="divider"></div>
      <div class="subtitle">${student.first_name} ${student.last_name} — ${teacherName}</div>
      <div style="margin-top:4px;font-size:14px;opacity:0.75">الأسبوع ${weekStart} إلى الأسبوع ${weekEnd}</div>
    </div>

    <div class="body">
      <div class="score-grid">
        <div class="score-box green"><div class="num green">${avgMem.toFixed(1)}</div><div class="lbl">الحفظ (x5)</div></div>
        <div class="score-box blue"><div class="num blue">${avgWard.toFixed(1)}</div><div class="lbl">الورد (x4)</div></div>
        <div class="score-box green"><div class="num green">${avgBeh.toFixed(1)}</div><div class="lbl">السلوك (x2)</div></div>
        <div class="score-box gold"><div class="num gold">${attScore.toFixed(1)}</div><div class="lbl">الحضور (x3)</div></div>
      </div>

      <div class="section">
        <div class="section-title">المعدل العام والتقدير</div>
        <div class="section-body">
          <div class="row">
            <span class="label">المعدل العام</span>
            <span class="value gold" style="font-size:22px">${overall.toFixed(1)} / ${outOf}</span>
          </div>
          <div class="row">
            <span class="label">التقدير</span>
            <span class="value green" style="font-size:20px">${grade}</span>
          </div>
          <div class="row">
            <span class="label">عدد الأسابيع</span>
            <span class="value">${tracking.length}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">الحضور والغياب</div>
        <div class="section-body">
          <div class="row"><span class="label">عدد أيام الحضور</span><span class="value green">${present}</span></div>
          <div class="row"><span class="label">الغياب غير المبرر</span><span class="value" style="color:#ef4444">${absent}</span></div>
          <div class="row"><span class="label">الغياب المبرر (تبرير مقبول)</span><span class="value" style="color:#c8a45c">${excusedAccepted}</span></div>
          <div class="row"><span class="label">الغياب المبرر (تبرير غير مقبول)</span><span class="value" style="color:#dc2626">${excusedRejected}</span></div>
          <div class="row"><span class="label">عدد التأخرات</span><span class="value" style="color:#f59e0b">${late}</span></div>
          <div class="row"><span class="label">علامة الحضور</span><span class="value gold">${attScore.toFixed(1)} / 10</span></div>
          ${totalDays > 0 ? `<div class="att-bar">
            <div class="seg-present" style="width:${(present / totalDays) * 100}%"></div>
            <div class="seg-excused" style="width:${(excusedAccepted / totalDays) * 100}%"></div>
            <div class="seg-rejected" style="width:${(excusedRejected / totalDays) * 100}%"></div>
            <div class="seg-late" style="width:${(late / totalDays) * 100}%"></div>
            <div class="seg-absent" style="width:${(absent / totalDays) * 100}%"></div>
          </div>` : ""}
          <div style="display:flex;gap:10px;margin-top:6px;font-size:12px;color:#666;flex-wrap:wrap">
            <span>■ <span style="color:#16a34a">حضور</span></span>
            <span>■ <span style="color:#c8a45c">مبرر مقبول</span></span>
            <span>■ <span style="color:#dc2626">مبرر غير مقبول</span></span>
            <span>■ <span style="color:#f59e0b">تأخر</span></span>
            <span>■ <span style="color:#ef4444">غياب</span></span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">منحنى الحفظ</div>
        <div class="section-body">
          ${memoCurveSvg}
        </div>
      </div>

      <div class="section">
        <div class="section-title">ملاحظة الأستاذ</div>
        <div class="section-body">
          <textarea class="note-area" id="teacherNotes" placeholder="أدخل ملاحظات الأستاذ هنا..." oninput="updateNotes()">${notes}</textarea>
        </div>
      </div>

      <div class="actions">
        <button onclick="window.print()">طباعة / حفظ PDF</button>
      </div>

    </div>
  </div>

  <script>
    function updateNotes() {
      const val = document.getElementById('teacherNotes').value;
      const url = new URL(window.location.href);
      url.searchParams.set('notes', val);
      window.history.replaceState({}, '', url);
    }
    ${url.searchParams.get("download") ? `window.onload = () => setTimeout(() => window.print(), 500);` : ""}
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
