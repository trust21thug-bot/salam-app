import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tripId = url.searchParams.get("trip_id");
  if (!tripId) return Response.json({ error: "trip_id required" }, { status: 400 });

  const db = createAdminClient();

  const { data: trips } = await db.from("trips").select("*").eq("id", tripId);
  const trip = ((trips ?? []) as any[])[0];
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });

  const { data: tripStudents } = await db.from("trip_students").select("*").eq("trip_id", tripId);
  const { data: students } = await db.from("students").select("*");
  const { data: teachers } = await db.from("teachers").select("*");

  const studentMap: Record<string, any> = {};
  for (const s of (students ?? []) as any[]) studentMap[s.id] = s;

  const teacherMap: Record<string, string> = {};
  for (const t of (teachers ?? []) as any[]) teacherMap[t.id] = t.full_name;

  const allowedStudents = (tripStudents ?? []).filter((r: any) => r.allowed);
  const grouped: Record<string, any[]> = {};
  for (const r of allowedStudents) {
    const s = studentMap[r.student_id];
    const circleId = s?.circle_id || "_unknown";
    if (!grouped[circleId]) grouped[circleId] = [];
    grouped[circleId].push({ ...r, student: s });
  }

  let bodyHtml = "";
  for (const [circleId, rows] of Object.entries(grouped)) {
    const teacherName = teacherMap[circleId] || "";
    const rowsHtml = rows.map((r, i) => {
      const s = r.student || { first_name: "", last_name: "", guardian_phone: "" };
      return `
        <tr>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${i + 1}</td>
          <td style="padding:5px 8px;border:1px solid #ddd">${s.first_name}</td>
          <td style="padding:5px 8px;border:1px solid #ddd">${s.last_name}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;direction:ltr;text-align:left">${s.guardian_phone}</td>
          <td style="padding:5px 8px;border:1px solid #ddd;text-align:center">${r.subscription_paid ? "نعم" : "لا"}</td>
        </tr>`;
    }).join("");

    bodyHtml += `
      <div style="margin-bottom:16px">
        <h3 style="background:#1b5e20;color:#fff;padding:8px 12px;margin:0;font-size:16px">${teacherName}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr>
              <th style="background:#f0fdf4;padding:6px 8px;border:1px solid #ddd;font-size:13px">#</th>
              <th style="background:#f0fdf4;padding:6px 8px;border:1px solid #ddd;font-size:13px">الاسم</th>
              <th style="background:#f0fdf4;padding:6px 8px;border:1px solid #ddd;font-size:13px">اللقب</th>
              <th style="background:#f0fdf4;padding:6px 8px;border:1px solid #ddd;font-size:13px">رقم الولي</th>
              <th style="background:#f0fdf4;padding:6px 8px;border:1px solid #ddd;font-size:13px">دفع الاشتراك</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>قائمة التلاميذ المسموح لهم - ${trip.destination}</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 0.6cm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Tajawal', sans-serif; font-size: 16px; color: #333; }
    .header { background: linear-gradient(135deg, #1b5e20, #2e7d32); padding: 14px 18px; color: #fff; text-align: center; }
    .header h1 { font-size: 22px; font-weight: 800; }
    .header .subtitle { font-size: 16px; opacity: 0.9; margin-top: 3px; }
    .header .divider { height: 2px; background: #c8a45c; width: 50px; margin: 4px auto; }
    .info { display: flex; gap: 24px; justify-content: center; padding: 10px; font-size: 14px; background: #f9f9f9; margin-bottom: 12px; }
    th { font-size: 13px; }
    td { padding: 5px 8px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { text-align: center; padding: 12px; font-size: 11px; color: #999; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>قائمة التلاميذ المسموح لهم</h1>
    <div class="divider"></div>
    <div class="subtitle">${trip.destination}</div>
  </div>
  <div class="info">
    <span>التاريخ: ${trip.date}</span>
    ${trip.departure_time ? `<span>وقت الانطلاق: ${trip.departure_time}</span>` : ""}
    ${trip.cost != null ? `<span>التكلفة: ${trip.cost} د.ل</span>` : ""}
    <span>إجمالي المشاركين: ${allowedStudents.length}</span>
  </div>
  ${bodyHtml}
  <div class="footer">مدرسة السلام القرآنية — تم التوليد ${new Date().toLocaleDateString("ar-SA")}</div>
  ${url.searchParams.get("download") ? `<script>window.onload = () => setTimeout(() => window.print(), 500);</script>` : ""}
</body>
</html>`;

  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
