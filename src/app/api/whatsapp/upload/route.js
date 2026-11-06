import { NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xskruftixchdbrsnitbh.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhza3J1ZnRpeGNoZGJyc25pdGJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA1MjcxOCwiZXhwIjoyMTA3NjI4NzE4fQ.y_HYIt8cMYrNtWqegYpk7tBViUrxTaVBepfQjlTs7dU";
const SUPABASE_BUCKET = "whatsapp-store";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const originalName = file.name || "attachment";
    const mimeType = file.type || "application/octet-stream";
    const fileSize = file.size || buffer.length;

    // Sanitize filename
    const cleanFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `attachments/${Date.now()}_${cleanFileName}`;

    try {
      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`;
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": mimeType,
          "x-upsert": "true",
        },
        body: buffer,
      });

      if (uploadRes.ok) {
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${storagePath}`;
        return NextResponse.json({
          success: true,
          url: publicUrl,
          name: originalName,
          type: mimeType,
          size: fileSize,
        });
      }
    } catch (storageErr) {
      console.warn("Storage upload warning:", storageErr.message);
    }

    // Fallback: Data URL
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      success: true,
      url: dataUrl,
      name: originalName,
      type: mimeType,
      size: fileSize,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
