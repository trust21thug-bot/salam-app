import { createAdminClient } from "@/lib/supabase/admin";
import fs from "fs";
import path from "path";
import { getAge, CLASSIFICATION_LABELS, ACADEMIC_LEVELS, FILE_STATUS_LABELS } from "@/lib/utils";

async function imageToBase64(url: string): Promise<string | null> {
  try {
    if (url.startsWith("http")) {
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      return `data:${res.headers.get("content-type") || "image/jpeg"};base64,${buf.toString("base64")}`;
    }
    if (url.startsWith("/local-storage/")) {
      const filePath = path.join(process.cwd(), "public", url);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        const buf = fs.readFileSync(filePath);
        return `data:${mime};base64,${buf.toString("base64")}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function memoCurveSvg(data: any[]): string {
  if (data.length < 2) return "";
  const sorted = [...data].sort((a, b) => (a.week_number || 0) - (b.week_number || 0));
  const values = sorted.map((t) => t.memorization_amount || 0);
  const cumulative: number[] = [];
  let sum = 0;
  for (const v of values) { sum += v; cumulative.push(sum); }
  const max = Math.max(...cumulative, 1);
  const w = 280, h = 80, pad = 4;
  const xStep = (w - pad * 2) / (cumulative.length - 1 || 1);
  const pts = cumulative.map((v, i) => `${pad + i * xStep},${h - pad - ((v / max) * (h - pad * 2))}`).join(" ");
  const circles = cumulative.map((v, i) =>
    `<circle cx="${pad + i * xStep}" cy="${h - pad - ((v / max) * (h - pad * 2))}" r="3" fill="#16a34a" />`
  ).join("");
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;max-height:90px;">
    <rect x="0" y="0" width="${w}" height="${h}" fill="#f0fdf4" rx="6" />
    <polyline points="${pts}" fill="none" stroke="#16a34a" stroke-width="2" stroke-linejoin="round" />
    ${circles}
    <text x="${w - pad}" y="${h - 2}" text-anchor="end" font-size="8" fill="#6b7280">${max.toFixed(1)}</text>
    <text x="${pad}" y="${h - 2}" text-anchor="start" font-size="8" fill="#6b7280">0</text>
  </svg>`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const [student, records, tracking, discipline, generalRanking, weeklyRankings] = await Promise.all([
    db.from("students").select("*").eq("id", id).single(),
    db.from("attendance_records").select("*").eq("student_id", id),
    db.from("weekly_tracking").select("*").eq("student_id", id).order("week_number"),
    db.from("discipline_records").select("*").eq("student_id", id).order("record_date", { ascending: false }),
    db.from("general_rankings").select("*").eq("student_id", id).single(),
    db.from("weekly_rankings").select("*").eq("student_id", id).order("week_number", { ascending: false }),
  ]);

  if (!student.data) {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  const s = student.data as any;
  const { data: teacher } = await db.from("teachers").select("*").eq("id", s.circle_id).single();
  const teacherName = (teacher as any)?.full_name || "—";
  const photoUrl = s.photo_url && !s.photo_url.startsWith("blob:") ? s.photo_url : null;
  const photoDataUrl = photoUrl ? await imageToBase64(photoUrl) : null;
  const photoTag = photoDataUrl
    ? `<img src="${photoDataUrl}" class="photo" />`
    : photoUrl
      ? `<img src="${photoUrl}" class="photo" />`
      : `<div class="photo-placeholder">${s.first_name?.charAt(0) || "?"}</div>`;

  const present = (records.data ?? []).filter((r: any) => r.status === "present").length;
  const absent = (records.data ?? []).filter((r: any) => r.status === "absent").length;
  const late = (records.data ?? []).filter((r: any) => r.status === "late").length;
  const excused = (records.data ?? []).filter((r: any) => r.status === "excused_accepted" || r.status === "excused_rejected").length;
  const totalSessions = (records.data ?? []).length;
  const attendanceRate = totalSessions > 0 ? Math.round(((present + excused) / totalSessions) * 100) : 0;

  const sortedTracking = [...(tracking.data ?? [])].sort((a: any, b: any) => (a.week_number || 0) - (b.week_number || 0));
  const totalMem = sortedTracking.reduce((s: number, t: any) => s + (t.memorization_amount || 0), 0);
  const totalRev = sortedTracking.reduce((s: number, t: any) => s + (t.revision_amount || 0), 0);
  const latestTrack = sortedTracking[sortedTracking.length - 1];
  const latestWard = latestTrack?.ward_score || 0;
  const latestBehavior = latestTrack?.behavior_score || 0;

  const reprimandCount = (discipline.data ?? []).filter((d: any) => d.type === "reprimand").length;
  const praiseCount = (discipline.data ?? []).filter((d: any) => d.type === "praise").length;

  const gr = generalRanking.data as any;
  const wrList = weeklyRankings.data as any[] || [];
  const latestWr = wrList[0];
  const sortedWr = [...wrList].sort((a, b) => (a.week_number || 0) - (b.week_number || 0));
  const monthlyWeeks = sortedWr.slice(-4);
  const monthlyAvg = monthlyWeeks.length
    ? (monthlyWeeks.reduce((s: number, w: any) => s + (w.total_score || 0), 0) / monthlyWeeks.length).toFixed(1)
    : null;

  const memoCurve = memoCurveSvg(sortedTracking);

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>السيرة الذاتية - ${s.first_name} ${s.last_name}</title>
  <style>
    @page { size: A5; margin: 0.8cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Traditional Arabic', 'Noto Naskh Arabic', 'Arial', serif; font-size: 13px; line-height: 1.7; color: #1a1a1a; background: #f8fafc; }
    .page { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; border: 2px solid #e8f5e9; }
    .title-area { text-align: center; padding: 14px 0 6px; }
    .title-area h1 { font-size: 22px; color: #1b5e20; }
    .title-area p { color: #c8a45c; font-size: 13px; }
    .title-divider { width: 64px; height: 2px; background: #c8a45c; margin: 6px auto 0; }
    .header { padding: 20px 24px; display: flex; align-items: center; gap: 16px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
    .header h2 { font-size: 18px; color: #1b5e20; }
    .header .sub { font-size: 13px; color: #4b5563; }
    .photo { width: 96px; height: 112px; object-fit: cover; border: 2px solid #1b5e20; flex-shrink: 0; }
    .photo-placeholder { width: 96px; height: 112px; background: #e8f5e9; display: flex; align-items: center; justify-content: center; font-size: 28px; color: #4b5563; border: 2px solid #1b5e20; flex-shrink: 0; }
    .badge-green { display: inline-block; font-size: 11px; padding: 1px 8px; border-radius: 3px; background: #1b5e20; color: #fff; }
    .badge-gold { display: inline-block; font-size: 11px; padding: 1px 8px; border-radius: 3px; background: #c8a45c; color: #fff; }
    .badge-light { display: inline-block; font-size: 11px; padding: 1px 8px; border-radius: 3px; background: #e8f5e9; color: #1b5e20; }
    .body { padding: 20px 24px; background: #fafdf8; }
    .section { border: 1px solid #e8f5e9; border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
    .section-header { padding: 8px 14px; font-size: 13px; font-weight: bold; color: #fff; background: linear-gradient(135deg, #1b5e20, #2e7d32); }
    .section-body { padding: 12px 14px; }
    .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #e8f5e9; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .row .label { color: #4b5563; }
    .row .value { font-weight: 500; color: #1a1a1a; }
    .row .value-highlight { font-weight: 700; color: #c8a45c; }
    .stats-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 10px; }
    .stat-box { text-align: center; padding: 8px; border-radius: 8px; }
    .stat-box .num { font-size: 16px; font-weight: bold; color: #1b5e20; }
    .stat-box .lbl { font-size: 10px; color: #6b7280; }
    .attendance-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .attendance-bar-track { flex: 1; height: 8px; border-radius: 4px; background: #e8f5e9; }
    .attendance-bar-fill { height: 8px; border-radius: 4px; }
    .attendance-rate { font-size: 13px; font-weight: bold; color: #1b5e20; }
    .att-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; text-align: center; font-size: 11px; }
    .att-grid .num { font-weight: bold; }
    .att-grid .lbl { color: #6b7280; }
    .disc-grid { display: flex; gap: 12px; margin-bottom: 8px; }
    .disc-box { flex: 1; text-align: center; padding: 6px; border-radius: 6px; font-size: 12px; }
    .disc-box .num { font-weight: bold; font-size: 14px; }
    .disc-item { display: flex; align-items: center; gap: 6px; font-size: 11px; padding: 4px 0; border-bottom: 1px dashed #e8f5e9; }
    .disc-item:last-child { border-bottom: none; }
    .disc-tag { padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: 500; }
    .footer { text-align: center; padding: 8px; font-size: 9px; color: #6b7280; background: #f0fdf4; }
    @media print { body { background: #fff; } .page { border: none; border-radius: 0; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="title-area">
      <h1>السيرة الذاتية للطالب</h1>
      <p>مدرسة السلام القرآنية</p>
      <div class="title-divider"></div>
    </div>

    <div class="header">
      ${photoTag}
      <div>
        <h2>${s.first_name} ${s.last_name}</h2>
        <div class="sub">حلقة: ${teacherName} | ${getAge(s.birth_date)} سنة</div>
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
          <span class="badge-green">${CLASSIFICATION_LABELS[s.classification] || s.classification || ""}</span>
          ${s.file_status ? `<span class="badge-gold">حالة الملف: ${FILE_STATUS_LABELS[s.file_status] || s.file_status}</span>` : ""}
          ${s.academic_level ? `<span class="badge-light">${ACADEMIC_LEVELS[s.academic_level] || s.academic_level}</span>` : ""}
          ${s.total_memorization ? `<span class="badge-light">الحفظ: ${s.total_memorization} حزب</span>` : ""}
          ${s.master_evaluation != null ? `<span class="badge-light">الضبط: ${s.master_evaluation}%</span>` : ""}
          ${gr?.rank_position ? `<span class="badge-gold">الترتيب العام: #${gr.rank_position}</span>` : ""}
          ${monthlyAvg !== null ? `<span class="badge-green">الشهري: ${monthlyAvg}</span>` : ""}
        </div>
      </div>
    </div>

    <div class="body">

      ${sortedTracking.length >= 2 ? `
      <div class="section">
        <div class="section-header">📈 منحنى الحفظ</div>
        <div class="section-body">
          ${memoCurve}
          <div class="stats-3">
            <div class="stat-box" style="background:#f0fdf4;"><div class="num">${totalMem.toFixed(2)}</div><div class="lbl">إجمالي الحفظ</div></div>
            <div class="stat-box" style="background:#fefce8;"><div class="num">${totalRev.toFixed(2)}</div><div class="lbl">إجمالي المراجعة</div></div>
            <div class="stat-box" style="background:#eff6ff;"><div class="num">${sortedTracking.length}</div><div class="lbl">عدد الأسابيع</div></div>
          </div>
        </div>
      </div>` : ""}

      <div class="section">
        <div class="section-header">📚 الأداء الأكاديمي</div>
        <div class="section-body">
          ${row("إجمالي الحفظ", `${totalMem.toFixed(2)} حزب`, true)}
          ${row("إجمالي المراجعة", `${totalRev.toFixed(2)} حزب`)}
          ${s.total_memorization ? row("مقدار الحفظ الكلي", `${s.total_memorization} حزب`, true) : ""}
          ${s.master_evaluation != null ? row("نسبة ضبط الحفظ", `${s.master_evaluation}%`, true) : ""}
          ${row("آخر ورد", `${latestWard}/10`)}
          ${row("آخر سلوك", `${latestBehavior}/10`)}
        </div>
      </div>

      <div class="section">
        <div class="section-header">✅ الحضور</div>
        <div class="section-body">
          <div class="attendance-bar">
            <div class="attendance-bar-track">
              <div class="attendance-bar-fill"
                style="width:${attendanceRate}%;background:${attendanceRate >= 80 ? "#16a34a" : attendanceRate >= 60 ? "#c8a45c" : "#ef4444"};">
              </div>
            </div>
            <span class="attendance-rate">${attendanceRate}%</span>
          </div>
          <div class="att-grid">
            <div><div class="num" style="color:#16a34a">${present}</div><div class="lbl">حاضر</div></div>
            <div><div class="num" style="color:#ef4444">${absent}</div><div class="lbl">غائب</div></div>
            <div><div class="num" style="color:#c8a45c">${late}</div><div class="lbl">متأخر</div></div>
            <div><div class="num" style="color:#6b7280">${excused}</div><div class="lbl">مبرر</div></div>
            <div><div class="num">${totalSessions}</div><div class="lbl">إجمالي</div></div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">⭐ الانضباط</div>
        <div class="section-body">
          <div class="disc-grid">
            <div class="disc-box" style="background:#fef2f2;"><div class="num" style="color:#dc2626">${reprimandCount}</div>توبيخ</div>
            <div class="disc-box" style="background:#f0fdf4;"><div class="num" style="color:#16a34a">${praiseCount}</div>استحسان</div>
          </div>
          ${(discipline.data ?? []).slice(0, 4).map((d: any) => `
          <div class="disc-item">
            <span class="disc-tag ${d.type === "reprimand" ? "badge-red" : "badge-ok"}"
              style="${d.type === "reprimand" ? "background:#fef2f2;color:#dc2626" : "background:#f0fdf4;color:#16a34a"}">
              ${d.type === "reprimand" ? "توبيخ" : "استحسان"}
            </span>
            <span>${d.reason}</span>
          </div>`).join("")}
        </div>
      </div>

      <div class="section">
        <div class="section-header">📋 معلومات شخصية</div>
        <div class="section-body">
          ${row("تاريخ الميلاد", s.birth_date || "—")}
          ${row("المستوى الدراسي", ACADEMIC_LEVELS[s.academic_level] || s.academic_level || "—")}
          ${row("هاتف الولي", s.guardian_phone || "—")}
          ${row("التصنيف", CLASSIFICATION_LABELS[s.classification] || s.classification || "—")}
          ${s.illness ? row("مرض", s.illness) : ""}
        </div>
      </div>

    </div>

    <div class="footer">
      تم التوليد من نظام إدارة مدرسة السلام — ${new Date().toLocaleDateString("ar-SA")}
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function row(label: string, value: string, highlight = false): string {
  return `<div class="row"><span class="label">${label}</span><span class="value${highlight ? "-highlight" : ""}">${value}</span></div>`;
}
