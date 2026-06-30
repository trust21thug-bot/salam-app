import { createAdminClient } from "@/lib/supabase/admin";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tripId = url.searchParams.get("trip_id");
  if (!tripId) return Response.json({ error: "trip_id required" }, { status: 400 });

  const db = createAdminClient();
  const [tripRes, , membersRes] = await Promise.all([
    db.from("trips").select("*").eq("id", tripId).single(),
    db.from("trip_students").select("*, students(*)").eq("trip_id", tripId).eq("allowed", true),
    db.from("school_members").select("*"),
  ]);

  const trip = tripRes.data as any;
  if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });

  const schoolMembers = (membersRes.data ?? []) as any[];
  const manager = schoolMembers.find((m: any) => m.id === trip.manager_id);
  const managerName = manager ? `${manager.first_name} ${manager.last_name}` : "";

  const today = new Date();
  const dayNames = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const monthNames = ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const todayStr = `${dayNames[today.getDay()]} ${today.getDate()} ${monthNames[today.getMonth()]} ${today.getFullYear()}`;

  const ws = process.cwd();
  const templatePath = path.join(ws, "public", "template-mission.docx");
  const outputPdf = path.join(ws, "node_modules", `.mission-${tripId}.pdf`);
  const scriptPath = path.join(ws, "scripts", "generate_mission_pdf.py");
  const pythonExe = "C:\\Program Files\\Python312\\python.exe";

  // Validate paths exist
  const errors: string[] = [];
  if (!fs.existsSync(pythonExe)) errors.push(`Python not found at ${pythonExe}`);
  if (!fs.existsSync(templatePath)) errors.push(`Template not found at ${templatePath}`);
  if (!fs.existsSync(scriptPath)) errors.push(`Script not found at ${scriptPath}`);
  if (errors.length > 0) {
    return Response.json({ error: errors.join("; ") }, { status: 500 });
  }

  try {
    const result = execSync(`"${pythonExe}" "${scriptPath}"`, {
      timeout: 45000,
      cwd: ws,
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        TEMPLATE_PATH: templatePath,
        OUTPUT_PDF: outputPdf,
        MANAGER_NAME: managerName,
        DESTINATION: trip.destination || "",
        TRIP_DATE: trip.date || "",
        PRINT_DATE: todayStr,
      },
      windowsHide: true,
    });
    console.log("PDF script output:", result.toString().trim());
  } catch (e: any) {
    console.error("PDF gen failed:", e.message);
    console.error("STDERR:", e.stderr?.toString() ?? "(none)");
    console.error("STDOUT:", e.stdout?.toString() ?? "(none)");
    return Response.json({
      error: "PDF generation failed",
      detail: e.stderr?.toString()?.substring(0, 500) ?? e.message,
    }, { status: 500 });
  }

  if (!fs.existsSync(outputPdf)) {
    return Response.json({ error: "PDF file not created" }, { status: 500 });
  }

  const pdfBuffer = fs.readFileSync(outputPdf);
  try { fs.unlinkSync(outputPdf); } catch {}

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="mission-${(trip.destination || "").replace(/[^a-zA-Z0-9_\-]/g, "_")}.pdf"`,
    },
  });
}
