import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    // Try saving directly to public folder for local mode
    try {
      const fs = await import("fs") as typeof import("fs");
      const p = await import("path") as typeof import("path");
      const dir = p.join(process.cwd(), "public", "local-storage");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p.join(dir, fileName), buffer);
      return Response.json({ url: `/local-storage/${fileName}` });
    } catch {
      // Fallback to Supabase storage
      const db = createAdminClient();
      const { error } = await db.storage.from("student-photos").upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
      });
      if (error) throw error;
      const { data: urlData } = db.storage.from("student-photos").getPublicUrl(fileName);
      return Response.json({ url: urlData.publicUrl });
    }
  } catch (e: any) {
    console.error("Upload failed:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
