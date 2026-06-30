import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { createAdminClient } from "@/lib/supabase/admin";

const MONTH_NAMES = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

interface RunInfo {
  full: string;
  text: string;
  hasDrawing: boolean;
}

function replaceInParagraphs(xml: string, placeholder: string, replacement: string): string {
  const textboxes: { id: string; content: string }[] = [];
  let counter = 0;
  const noTx = xml.replace(/<w:txbxContent[\s\S]*?<\/w:txbxContent>/g, (m) => {
    const id = `__TXB_${counter++}__`;
    textboxes.push({ id, content: m });
    return id;
  });

  const result = noTx.replace(/(<w:p[\s\S]*?<\/w:p>)/g, (pTag) => {
    if (pTag.includes("__TXB_")) return pTag;

    const runs: RunInfo[] = [];
    const runRegex = /<w:r[\s>][\s\S]*?<\/w:r>/g;
    let rm: RegExpExecArray | null;
    while ((rm = runRegex.exec(pTag)) !== null) {
      const txtMatch = /<w:t[^>]*>([^<]*)<\/w:t>/.exec(rm[0]);
      runs.push({
        full: rm[0],
        text: txtMatch ? txtMatch[1] : "",
        hasDrawing: /<w:drawing/.test(rm[0]),
      });
    }

    const combined = runs.map((r) => r.text).join("");
    const phIdx = combined.indexOf(placeholder);
    if (phIdx === -1) return pTag;

    const phEnd = phIdx + placeholder.length;
    let acc = 0;
    let firstMerge = -1;
    let lastMerge = -1;
    for (let i = 0; i < runs.length; i++) {
      const runStart = acc;
      const runEnd = acc + runs[i].text.length;
      if (runStart < phEnd && runEnd > phIdx) {
        if (firstMerge === -1) firstMerge = i;
        lastMerge = i;
      }
      acc += runs[i].text.length;
    }

    if (firstMerge === -1) return pTag;

    const before = pTag.slice(0, pTag.search(/<w:r[\s>]/));
    const after = pTag.slice(pTag.lastIndexOf("</w:r>") + "</w:r>".length);
    const newRunContent = runs
      .map((r, i) => {
        if (i < firstMerge || i > lastMerge) return r.full;
        if (i === firstMerge)
          return r.full.replace(/(<w:t[^>]*>)[^<]*(<\/w:t>)/, `$1${replacement}$2`);
        return "";
      })
      .join("");
    return before + newRunContent + after;
  });

  let final = result;
  for (const tb of textboxes) {
    final = final.replace(tb.id, tb.content);
  }
  return final;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tripId = url.searchParams.get("trip_id");

  if (!tripId) {
    return NextResponse.json({ error: "trip_id is required" }, { status: 400 });
  }

  const db = createAdminClient();
  const [tripRes, tripStudentsRes, membersRes] = await Promise.all([
    db.from("trips").select("*").eq("id", tripId).single(),
    db.from("trip_students").select("*, students(*)").eq("trip_id", tripId).eq("allowed", true),
    db.from("school_members").select("*"),
  ]);

  const tripData = tripRes.data as any;
  if (!tripData) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const schoolMembers = (membersRes.data ?? []) as any[];

  const manager = schoolMembers.find((m: any) => m.id === tripData.manager_id);
  const managerName = manager ? `${manager.first_name} ${manager.last_name}` : "______________";

  const todayDate = formatDate(new Date().toISOString());
  const tripDate = formatDate(tripData.date);

  const templatePath = path.join(process.cwd(), "public", "template-mission.docx");
  if (!fs.existsSync(templatePath)) {
    return NextResponse.json({ error: "Template not found" }, { status: 500 });
  }

  const templateBuffer = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(templateBuffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    return NextResponse.json({ error: "Invalid template: missing document.xml" }, { status: 500 });
  }
  let xml = await docFile.async("string");

  function esc(s: string) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  xml = replaceInParagraphs(xml, "يوم الطباعة", esc(todayDate));
  xml = replaceInParagraphs(xml, "الوجهة", esc(tripData.destination));
  xml = replaceInParagraphs(xml, "تاريخ الرحلة", esc(tripDate));
  xml = replaceInParagraphs(xml, "مدير الرحلة", esc(managerName));

  zip.file("word/document.xml", xml);

  const modifiedBuffer = await zip.generateAsync({ type: "nodebuffer" });

  const filename = `تكليف بمهمة - ${tripData.destination}.docx`;
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(new Uint8Array(modifiedBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
    },
  });
}
