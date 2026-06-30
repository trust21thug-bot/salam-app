import { createAdminClient } from "@/lib/supabase/admin";

function excelSerialToDate(serial: number): string {
  const utcDays = serial - 25569;
  const utcMs = utcDays * 86400000;
  const date = new Date(utcMs);
  return date.toISOString().split("T")[0];
}

async function loadExcel() {
  const XLSX = await import("xlsx");
  const fs = await import("fs") as typeof import("fs");
  const path = await import("path") as typeof import("path");

  let excelPath: string | null = null;
  const candidates = [
    path.join(process.cwd(), "قائمة الطلبة (2).xlsx"),
    path.join(process.cwd(), "قائمة الطلبة.xlsx"),
  ];
  const allFiles = fs.readdirSync(process.cwd()).filter((f: string) => f.endsWith(".xlsx") && f.includes("قائمة"));
  if (allFiles.length > 0) candidates.push(path.join(process.cwd(), allFiles[0]));

  for (const c of candidates) {
    if (fs.existsSync(c)) { excelPath = c; break; }
  }

  if (!excelPath) {
    return { error: "لم يتم العثور على ملف Excel للقائمة في " + process.cwd() };
  }
  const fileBuffer = fs.readFileSync(excelPath);
  const wb = XLSX.read(fileBuffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
  return { rows, fs, path };
}

export async function POST() {
  try {
    const loaded = await loadExcel();
    if ("error" in loaded) {
      return Response.json({ error: loaded.error }, { status: 404 });
    }
    const { rows } = loaded;
    const db = createAdminClient();

  const circleNames = new Set<string>();
  const studentRows: any[][] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r && r[1] && r[1] !== "الإسم" && r[1] !== "") {
      if (r[4]) circleNames.add(r[4]);
      studentRows.push(r);
    }
  }

  interface TeacherRecord {
    id: string;
    full_name: string;
  }

  const teacherMap = new Map<string, TeacherRecord>();
  for (const name of circleNames) {
    const { data: existing } = await db.from("teachers").select("id, full_name").eq("full_name", name).maybeSingle();
    if (existing) {
      teacherMap.set(name, existing as TeacherRecord);
    } else {
      const teacherRecord = {
        full_name: name,
        teaching_days: [0, 1, 2, 3, 4],
        teaching_time: "08:00",
        required_memorization: 0.25,
        required_revision: 0.25,
      };
      const { data: created } = await db.from("teachers").upsert(teacherRecord).select().single() as any;
      teacherMap.set(name, created as TeacherRecord);
    }
  }

  let imported = 0;
  const errors: string[] = [];

  for (const r of studentRows) {
    const firstName = r[1]?.trim();
    const lastName = r[2]?.trim();
    const circleName = r[4];
    const phone = r[8]?.toString().trim();
    const birthDateRaw = r[9];

    if (!firstName) continue;

    let birthDate = "";
    if (typeof birthDateRaw === "number" && birthDateRaw > 10000) {
      birthDate = excelSerialToDate(birthDateRaw);
    } else if (typeof birthDateRaw === "string" && birthDateRaw) {
      birthDate = birthDateRaw;
    }

    let academicLevel = "";
    const rawLevel = r[10] || "";
    if (rawLevel) {
      const levelMap: Record<string, string> = {
        "الأولى ابتدائي": "1-ابتدائي", "الثانية ابتدائي": "2-ابتدائي", "الثالثة ابتدائي": "3-ابتدائي",
        "الرابعة ابتدائي": "4-ابتدائي", "الخامسة ابتدائي": "5-ابتدائي",
        "الأولى متوسط": "1-متوسط", "الثانية متوسط": "2-متوسط", "الثالثة متوسط": "3-متوسط", "الرابعة متوسط": "4-متوسط",
        "الأولى ثانوي": "1-ثانوي", "الثانية ثانوي": "2-ثانوي", "الثالثة ثانوي": "3-ثانوي",
      };
      academicLevel = levelMap[rawLevel] || rawLevel;
    }

    const illness = r[14]?.toString().trim() || "";
    const circleId = teacherMap.get(circleName)?.id || "";

    try {
      await db.from("students").upsert({
        first_name: firstName,
        last_name: lastName || "",
        birth_date: birthDate || "",
        guardian_phone: phone || "",
        circle_id: circleId,
        academic_level: academicLevel,
        illness: illness || null,
        classification: "public_circle",
        file_status: null,
        sibling_id: null,
      });
      imported++;
    } catch (e: any) {
      errors.push(`${firstName} ${lastName}: ${e.message}`);
    }
  }

  return Response.json({
    ok: true,
    imported,
    teachers: teacherMap.size,
    errors: errors.slice(0, 10),
    totalErrors: errors.length,
  });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}