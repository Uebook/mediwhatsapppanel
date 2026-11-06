import { NextResponse } from "next/server";
import { downloadAndStoreMetaMedia } from "@/lib/whatsappMediaService";

const META_ACCESS_TOKEN =
  process.env.WHATSAPP_API_TOKEN ||
  process.env.INSIGN_WHATSAPP_TOKEN ||
  "EAAWGpza3ZA9IBSggkTKigXzqveCRKZAkcDVaai6ntCqfcqcW9gLK0Shd39TZAcScEbwxL2A4zmGtV921ji9lL0jN0qNiraCb0PTRBRw7YN7CyZBvGEu2NxUElDexZBknAdCWteDt9O0iB5ynrp5kv3k1zo0o6eRa5oTxqv6aEGnbZCciwpu64Ncr1r9zckrgZDZD";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const mediaId = searchParams.get("mediaId");
    const mimeType = searchParams.get("type") || "application/octet-stream";
    const filename = searchParams.get("name") || "whatsapp_attachment";

    if (!mediaId) {
      return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
    }

    // First attempt to download and store into Supabase Storage
    const stored = await downloadAndStoreMetaMedia(mediaId, mimeType, filename);
    if (stored && stored.url && stored.url.startsWith("http")) {
      // Redirect directly to the permanent public CDN / Supabase URL
      return NextResponse.redirect(stored.url, 307);
    }

    // Direct proxy fallback from Meta Graph API
    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${META_ACCESS_TOKEN}`,
      },
    });

    if (!metaRes.ok) {
      return NextResponse.json({ error: "Media not found on Meta servers" }, { status: 404 });
    }

    const metaData = await metaRes.json();
    const downloadUrl = metaData.url;
    const finalMime = metaData.mime_type || mimeType;

    if (!downloadUrl) {
      return NextResponse.json({ error: "Download URL missing from Meta response" }, { status: 404 });
    }

    const binaryRes = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${META_ACCESS_TOKEN}`,
        "User-Agent": "MediConnect-WhatsApp/1.0",
      },
    });

    if (!binaryRes.ok) {
      return NextResponse.json({ error: "Failed to download media binary" }, { status: binaryRes.status });
    }

    const arrayBuffer = await binaryRes.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": finalMime,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (err) {
    console.error("[GET /api/whatsapp/media] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
