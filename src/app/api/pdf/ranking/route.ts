import { createAdminClient } from "@/lib/supabase/admin";

const CIRCLE_COLORS = ["#1b5e20", "#2563eb", "#c8a45c", "#dc2626", "#7c3aed"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "weekly";
  const db = createAdminClient();

  if (type === "general") {
    const { data: rankings } = await db.from("general_rankings").select("*").order("total_score", { ascending: false });
    const { data: students } = await db.from("students").select("*");
    const allRankings = (rankings ?? []) as any[];
    const studentMap: Record<string, any> = {};
    for (const s of (students ?? []) as any[]) studentMap[s.id] = s;

    allRankings.forEach((r, i) => { r.rank_position = i + 1; });

    const rows = allRankings.map((r) => {
      const s = studentMap[r.student_id];
      return `
        <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:15px">${r.rank_position}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:15px">${s?.first_name || ""} ${s?.last_name || ""}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${(r.total_memorization || 0).toFixed(1)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${(r.master_evaluation || 0).toFixed(1)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:15px">${(r.total_score || 0).toFixed(1)}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>جدول الترتيب العام</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0.6cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', sans-serif; font-size: 16px; color: #333; }
    .header { background: linear-gradient(135deg, #1b5e20, #2e7d32); padding: 14px 18px; color: #fff; text-align: center; }
    .header h1 { font-size: 22px; font-weight: 800; }
    .header .divider { height: 2px; background: #c8a45c; width: 50px; margin: 4px auto; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
    th { background: #f0fdf4; padding: 8px 6px; border: 1px solid #ddd; font-weight: 700; font-size: 14px; }
    td { padding: 6px 6px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { text-align: center; padding: 12px; font-size: 11px; color: #999; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>جدول الترتيب العام</h1>
    <div class="divider"></div>
  </div>
  <table>
    <thead><tr><th>الرتبة</th><th>الطالب</th><th>الحفظ الكلي (حزب)</th><th>نسبة الضبط (%)</th><th>المجموع</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">مدرسة السلام القرآنية — تم التوليد ${new Date().toLocaleDateString("ar-SA")}</div>
  ${url.searchParams.get("download") ? `<script>window.onload = () => setTimeout(() => window.print(), 500);</script>` : ""}
</body>
</html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (type === "monthly") {
    const groupId = url.searchParams.get("group_id");
    const weekStart = parseInt(url.searchParams.get("week_start") ?? "1");
    const weekEnd = parseInt(url.searchParams.get("week_end") ?? "5");
    if (!groupId) return Response.json({ error: "group_id required" }, { status: 400 });

    const { data: groups } = await db.from("ranking_groups").select("*").eq("id", groupId);
    const { data: students } = await db.from("students").select("*");
    const group = ((groups ?? []) as any[])[0];
    const studentMap: Record<string, any> = {};
    for (const s of (students ?? []) as any[]) studentMap[s.id] = s;

    const seen = new Set<string>();
    const all: any[] = [];
    for (let w = weekStart; w <= weekEnd; w++) {
      const { data: rankings } = await db.from("weekly_rankings").select("*").eq("group_id", groupId).eq("week_number", w);
      for (const r of (rankings ?? []) as any[]) {
        const key = `${r.student_id}_${r.week_number}`;
        if (!seen.has(key)) { seen.add(key); all.push(r); }
      }
    }

    const grouped: Record<string, any[]> = {};
    for (const r of all) {
      if (!grouped[r.student_id]) grouped[r.student_id] = [];
      grouped[r.student_id].push(r);
    }
    const monthly: any[] = Object.entries(grouped).map(([studentId, rows]) => {
      const total = rows.reduce((s, r) => s + (r.total_score || 0), 0);
      return {
        student_id: studentId,
        total_score: total,
        avg_score: rows.length ? (total / rows.length).toFixed(1) : "0.0",
        weeks_count: rows.length,
        weeks: rows.map((r) => r.week_number).join(", "),
      };
    });
    monthly.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));

    const rows = monthly.map((r, i) => {
      const s = studentMap[r.student_id];
      return `
        <tr>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:15px">${i + 1}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-size:15px">${s?.first_name || ""} ${s?.last_name || ""}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:15px">${(r.total_score || 0).toFixed(1)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${(parseFloat(r.avg_score) || 0).toFixed(1)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${r.weeks_count}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:12px">${r.weeks}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>جدول الترتيب الشهري</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0.6cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', sans-serif; font-size: 16px; color: #333; }
    .header { background: linear-gradient(135deg, #1b5e20, #2e7d32); padding: 14px 18px; color: #fff; text-align: center; }
    .header h1 { font-size: 22px; font-weight: 800; }
    .header .subtitle { font-size: 16px; opacity: 0.9; margin-top: 3px; }
    .header .divider { height: 2px; background: #c8a45c; width: 50px; margin: 4px auto; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
    th { background: #f0fdf4; padding: 8px 6px; border: 1px solid #ddd; font-weight: 700; font-size: 14px; }
    td { padding: 6px 6px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { text-align: center; padding: 12px; font-size: 11px; color: #999; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>جدول الترتيب الشهري</h1>
    <div class="divider"></div>
    <div class="subtitle">${group?.name || ""} — من الأسبوع ${weekStart} إلى ${weekEnd}</div>
  </div>
  <table>
    <thead><tr>
      <th>الرتبة</th><th>الطالب</th><th>المجموع الكلي</th><th>المعدل</th><th>عدد الأسابيع</th><th>الأسابيع</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">مدرسة السلام القرآنية — تم التوليد ${new Date().toLocaleDateString("ar-SA")}</div>
  ${url.searchParams.get("download") ? `<script>window.onload = () => setTimeout(() => window.print(), 500);</script>` : ""}
</body>
</html>`;
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Weekly ranking
  const groupId = url.searchParams.get("group_id");
  const weekNumber = parseInt(url.searchParams.get("week") ?? "1");
  if (!groupId) return Response.json({ error: "group_id required" }, { status: 400 });

  const { data: rankings } = await db.from("weekly_rankings").select("*").eq("group_id", groupId).eq("week_number", weekNumber);
  const { data: groups } = await db.from("ranking_groups").select("*").eq("id", groupId);
  const { data: students } = await db.from("students").select("*");
  const { data: teachers } = await db.from("teachers").select("*");
  const teacherMap: Record<string, string> = {};
  for (const t of (teachers ?? []) as any[]) teacherMap[t.id] = t.full_name;
  const allRankings = (rankings ?? []) as any[];
  const group = ((groups ?? []) as any[])[0];
  const studentMap: Record<string, any> = {};
  for (const s of (students ?? []) as any[]) studentMap[s.id] = s;

  allRankings.sort((a, b) => ((b.total_score || 0) + (b.manual_adjustment || 0)) - ((a.total_score || 0) + (a.manual_adjustment || 0)));
  allRankings.forEach((r, i) => { r.rank_position = i + 1; });

  const rows = allRankings.map((r) => {
    const s = studentMap[r.student_id];
    const circleName = teacherMap[s?.circle_id] || "";
    const circleColor = CIRCLE_COLORS[s?.circle_id?.length % CIRCLE_COLORS.length] || "#666";
    return `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:15px">${r.rank_position}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:15px">${s?.first_name || ""} ${s?.last_name || ""}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px"><span style="color:${circleColor}">${circleName}</span></td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${(Math.min((r.memorization_score || 0) + (r.revision_score || 0), 10)).toFixed(1)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${(r.ward_score || 0).toFixed(1)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${(r.behavior_score || 0).toFixed(1)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:14px">${(r.attendance_score || 0).toFixed(1)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:15px">${((r.total_score || 0) + (r.manual_adjustment || 0)).toFixed(1)}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>جدول الترتيب الأسبوعي</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0.6cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', sans-serif; font-size: 16px; color: #333; }
    .header { background: linear-gradient(135deg, #1b5e20, #2e7d32); padding: 14px 18px; color: #fff; text-align: center; }
    .header h1 { font-size: 22px; font-weight: 800; }
    .header .subtitle { font-size: 16px; opacity: 0.9; margin-top: 3px; }
    .header .divider { height: 2px; background: #c8a45c; width: 50px; margin: 4px auto; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 14px; }
    th { background: #f0fdf4; padding: 8px 6px; border: 1px solid #ddd; font-weight: 700; font-size: 14px; }
    td { padding: 6px 6px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { text-align: center; padding: 12px; font-size: 11px; color: #999; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>جدول الترتيب الأسبوعي</h1>
    <div class="divider"></div>
    <div class="subtitle">${group?.name || ""} — الأسبوع ${weekNumber}</div>
  </div>
  <table>
    <thead><tr>
      <th>الرتبة</th><th>الطالب</th><th>الحلقة</th><th>الحفظ والمراجعة (×5)</th><th>الورد (×4)</th><th>السلوك (×2)</th><th>الحضور (×3)</th><th>المجموع</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">مدرسة السلام القرآنية — تم التوليد ${new Date().toLocaleDateString("ar-SA")}</div>
  ${url.searchParams.get("download") ? `<script>window.onload = () => setTimeout(() => window.print(), 500);</script>` : ""}
</body>
</html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
