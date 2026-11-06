import { INSIGN_CONFIG } from "./insignMultiChannelApi";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xskruftixchdbrsnitbh.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhza3J1ZnRpeGNoZGJyc25pdGJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjA1MjcxOCwiZXhwIjoyMTA3NjI4NzE4fQ.y_HYIt8cMYrNtWqegYpk7tBViUrxTaVBepfQjlTs7dU";
const SUPABASE_BUCKET = "whatsapp-store";

const META_ACCESS_TOKEN =
  process.env.WHATSAPP_API_TOKEN ||
  process.env.INSIGN_WHATSAPP_TOKEN ||
  "EAAWGpza3ZA9IBSggkTKigXzqveCRKZAkcDVaai6ntCqfcqcW9gLK0Shd39TZAcScEbwxL2A4zmGtV921ji9lL0jN0qNiraCb0PTRBRw7YN7CyZBvGEu2NxUElDexZBknAdCWteDt9O0iB5ynrp5kv3k1zo0o6eRa5oTxqv6aEGnbZCciwpu64Ncr1r9zckrgZDZD";

/**
 * Downloads a media file using Meta Graph API media ID and stores it permanently in Supabase Storage.
 */
export async function downloadAndStoreMetaMedia(mediaId, mimeType = "application/octet-stream", originalFilename = "") {
  if (!mediaId) return null;

  try {
    console.log(`[MediaService] Resolving Meta media ID: ${mediaId}...`);

    // 1. Ask Meta Graph API for media URL
    let downloadUrl = null;
    let resolvedMime = mimeType;
    let fileSize = 0;

    const metaRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: {
        Authorization: `Bearer ${META_ACCESS_TOKEN}`,
      },
      cache: "no-store",
    });

    if (metaRes.ok) {
      const metaData = await metaRes.json();
      downloadUrl = metaData.url;
      resolvedMime = metaData.mime_type || mimeType;
      fileSize = metaData.file_size || 0;
      console.log(`[MediaService] Meta media metadata resolved:`, { downloadUrl: downloadUrl ? "FOUND" : "NOT FOUND", resolvedMime, fileSize });
    } else {
      console.warn(`[MediaService] Meta Graph API query failed (${metaRes.status}):`, await metaRes.text());

      // Try Insign MultiChannel API fallback
      try {
        const insignRes = await fetch(
          `https://multichannel.insignsms.com/api/v1/whatsapp/${INSIGN_CONFIG.wabaId}/media/${mediaId}`,
          {
            headers: {
              Authorization: `Bearer ${INSIGN_CONFIG.apiToken}`,
            },
            cache: "no-store",
          }
        );
        if (insignRes.ok) {
          const insignData = await insignRes.json();
          downloadUrl = insignData.url || insignData.link;
          resolvedMime = insignData.mime_type || resolvedMime;
          console.log(`[MediaService] Insign media URL resolved:`, downloadUrl);
        }
      } catch (insignErr) {
        console.warn(`[MediaService] Insign fallback error:`, insignErr.message);
      }
    }

    if (!downloadUrl) {
      console.warn(`[MediaService] No download URL obtained for mediaId: ${mediaId}`);
      return null;
    }

    // 2. Download the binary stream from lookaside.fbsbx.com
    const mediaFileRes = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${META_ACCESS_TOKEN}`,
        "User-Agent": "MediConnect-WhatsApp/1.0",
      },
    });

    if (!mediaFileRes.ok) {
      console.warn(`[MediaService] Failed to download media binary (${mediaFileRes.status}):`, await mediaFileRes.text());
      return null;
    }

    const buffer = Buffer.from(await mediaFileRes.arrayBuffer());
    if (buffer.length === 0) {
      console.warn(`[MediaService] Downloaded empty buffer for mediaId: ${mediaId}`);
      return null;
    }

    // Derive file extension
    let ext = ".bin";
    if (resolvedMime.includes("jpeg") || resolvedMime.includes("jpg")) ext = ".jpg";
    else if (resolvedMime.includes("png")) ext = ".png";
    else if (resolvedMime.includes("webp")) ext = ".webp";
    else if (resolvedMime.includes("mp4")) ext = ".mp4";
    else if (resolvedMime.includes("ogg") || resolvedMime.includes("opus")) ext = ".ogg";
    else if (resolvedMime.includes("mpeg") || resolvedMime.includes("mp3")) ext = ".mp3";
    else if (resolvedMime.includes("aac")) ext = ".aac";
    else if (resolvedMime.includes("pdf")) ext = ".pdf";

    const cleanBase = (originalFilename || `whatsapp_media_${mediaId}`).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = cleanBase.includes(".") ? cleanBase : `${cleanBase}${ext}`;
    const storagePath = `incoming/${Date.now()}_${filename}`;

    // 3. Upload to Supabase Storage
    const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`;
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": resolvedMime,
        "x-upsert": "true",
      },
      body: buffer,
    });

    if (uploadRes.ok) {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${storagePath}`;
      console.log(`[MediaService] Media successfully uploaded to Supabase Storage: ${publicUrl}`);
      return {
        url: publicUrl,
        type: resolvedMime,
        name: filename,
        size: fileSize || buffer.length,
      };
    } else {
      console.warn(`[MediaService] Supabase upload error (${uploadRes.status}):`, await uploadRes.text());
      // Fallback: Base64 data URL
      const base64 = buffer.toString("base64");
      return {
        url: `data:${resolvedMime};base64,${base64}`,
        type: resolvedMime,
        name: filename,
        size: buffer.length,
      };
    }
  } catch (err) {
    console.error(`[MediaService] Exception downloading/storing media:`, err);
    return null;
  }
}

/**
 * Parses any incoming message payload (Meta WhatsApp Cloud API, Insign, or direct flat object)
 * and resolves its media attachment into a permanent accessible URL.
 */
export async function parseAndStoreIncomingMedia(msg) {
  if (!msg) return null;

  const type = msg.type;
  const isMedia =
    type === "image" ||
    type === "video" ||
    type === "audio" ||
    type === "voice" ||
    type === "document" ||
    type === "sticker";

  const mediaObj =
    msg[type] ||
    msg.image ||
    msg.video ||
    msg.audio ||
    msg.voice ||
    msg.document ||
    msg.media ||
    {};

  const directUrl =
    mediaObj.link ||
    mediaObj.url ||
    mediaObj.file_url ||
    msg.media_url ||
    msg.url ||
    msg.attachment_url;

  const caption = mediaObj.caption || msg.caption || "";
  const mediaId = mediaObj.id || mediaObj.media_id;
  const mimeType =
    mediaObj.mime_type ||
    mediaObj.type ||
    (type === "image"
      ? "image/jpeg"
      : type === "video"
      ? "video/mp4"
      : type === "audio" || type === "voice"
      ? "audio/ogg"
      : type === "document"
      ? "application/pdf"
      : "application/octet-stream");

  const originalName = mediaObj.filename || mediaObj.name || "";

  // 1. If direct public HTTP/HTTPS URL already provided
  if (directUrl && typeof directUrl === "string" && directUrl.startsWith("http")) {
    // If it's not a temporary Facebook lookaside URL, use directly
    if (!directUrl.includes("lookaside.fbsbx.com")) {
      return {
        url: directUrl,
        type: mimeType,
        name: originalName || `whatsapp_${type || "media"}_${Date.now()}`,
        size: mediaObj.file_size || 0,
        caption,
      };
    }
  }

  // 2. If we have a Meta media ID or Facebook temporary download URL
  if (mediaId) {
    const stored = await downloadAndStoreMetaMedia(mediaId, mimeType, originalName);
    if (stored) {
      return {
        ...stored,
        caption,
      };
    }

    // Proxy fallback: route through internal proxy endpoint
    return {
      url: `/api/whatsapp/media?mediaId=${encodeURIComponent(mediaId)}&type=${encodeURIComponent(mimeType)}&name=${encodeURIComponent(originalName || "attachment")}`,
      type: mimeType,
      name: originalName || `whatsapp_${type || "media"}_${mediaId}`,
      size: mediaObj.file_size || 0,
      caption,
    };
  }

  // 3. If directUrl is a Facebook lookaside URL without mediaId
  if (directUrl && typeof directUrl === "string" && directUrl.includes("lookaside.fbsbx.com")) {
    try {
      const res = await fetch(directUrl, {
        headers: {
          Authorization: `Bearer ${META_ACCESS_TOKEN}`,
        },
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const cleanName = `${Date.now()}_incoming_media`;
        const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/incoming/${cleanName}`;
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
          return {
            url: `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/incoming/${cleanName}`,
            type: mimeType,
            name: originalName || cleanName,
            size: buffer.length,
            caption,
          };
        }
      }
    } catch (e) {
      console.warn("[MediaService] Failed to fetch lookaside direct URL:", e.message);
    }
  }

  return null;
}
