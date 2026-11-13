import { NextResponse } from "next/server";
import { messageStore } from "@/lib/messageStore";

const INSIGN_API_TOKEN =
  process.env.INSIGN_WHATSAPP_TOKEN ||
  process.env.WHATSAPP_API_TOKEN ||
  "361|qvSlohCNI5loBq7eumrBLvPI68wuTFsSddLe3Mugd7463735";

const PHONE_NUMBER_ID =
  process.env.INSIGN_WHATSAPP_PHONE_NUMBER_ID ||
  process.env.WHATSAPP_PHONE_NUMBER_ID ||
  "1355499557651351";

export async function POST(req) {
  try {
    const body = await req.json();
    const { to, message, templateName, templateParams, language = "en_US", agentName = "Super Admin", media } = body;

    if (!to) {
      return NextResponse.json(
        { success: false, error: "Recipient phone number is required" },
        { status: 400 }
      );
    }

    // Format phone number with country code (international format without +)
    let formattedNumber = String(to).replace(/\D/g, "");
    if (formattedNumber.length === 10) {
      formattedNumber = "91" + formattedNumber;
    }

    // Endpoint from multichannel.insignsms.com documentation
    const url = `https://multichannel.insignsms.com/api/v1/whatsapp/${PHONE_NUMBER_ID}/messages`;

    let payload;
    let textBody = message || (media?.name ? `[Attachment: ${media.name}]` : "");

    let resolvedParams = Array.isArray(templateParams) ? [...templateParams] : [];
    if (templateName && templateName !== "custom") {
      let components = [];

      if (templateName === "navratri_post") {
        resolvedParams = []; // navratri_post requires 0 body parameters on Meta
        components.push({
          type: "header",
          parameters: [
            {
              type: "image",
              image: {
                link: media?.url || "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800",
              },
            },
          ],
        });
      } else if (templateName === "mediconnect_test_message") {
        if (resolvedParams.length < 2) {
          const p1 = resolvedParams[0] || body.contactName || body.patientName || "Valued Patient";
          const p2 = resolvedParams[1] || "MC-" + Math.floor(100000 + Math.random() * 900000);
          resolvedParams = [p1, p2];
        }
      }

      if (resolvedParams.length > 0) {
        components.push({
          type: "body",
          parameters: resolvedParams.map((p) => ({
            type: "text",
            text: String(p),
          })),
        });
      }

      textBody = `[Template: ${templateName}]` + (resolvedParams.length > 0 ? ` (${resolvedParams.join(", ")})` : "");
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedNumber,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          ...(components.length > 0 ? { components } : {}),
        },
      };
    } else if (media && media.url && media.url.startsWith("http")) {
      const isImg = (media.type || "").startsWith("image/");
      const isVideo = (media.type || "").startsWith("video/");
      const isAudio = (media.type || "").startsWith("audio/");

      if (isImg) {
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedNumber,
          type: "image",
          image: {
            link: media.url,
            ...(message ? { caption: message } : {}),
          },
        };
      } else if (isVideo) {
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedNumber,
          type: "video",
          video: {
            link: media.url,
            ...(message ? { caption: message } : {}),
          },
        };
      } else if (isAudio) {
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedNumber,
          type: "audio",
          audio: {
            link: media.url,
          },
        };
      } else {
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedNumber,
          type: "document",
          document: {
            link: media.url,
            filename: media.name || "document.pdf",
            ...(message ? { caption: message } : {}),
          },
        };
      }
    } else {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedNumber,
        type: "text",
        text: {
          preview_url: false,
          body: message || (media?.url ? `Attachment: ${media.name || 'File'} - ${media.url}` : "Hello from MediConnect Support"),
        },
      };
    }

    console.log(`[INSIGN MULTICHANNEL] Dispatching to ${formattedNumber} via ${url}...`);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INSIGN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));
    console.log("[INSIGN MULTICHANNEL] Status:", res.status, "Response:", result);

    const hasError =
      !res.ok ||
      result.error ||
      result.success === false ||
      result.message === "Unauthenticated." ||
      !result.messages;

    if (hasError) {
      const errorMessage =
        result.error?.message ||
        result.message ||
        (result.error ? JSON.stringify(result.error) : "InsignSMS API rejected message dispatch");

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          statusCode: res.status,
          apiResponse: result,
        },
        { status: res.status >= 400 ? res.status : 400 }
      );
    }

    const messageId = result.messages?.[0]?.id || "wamid.out." + Date.now();

    const now = Date.now();
    const istTime = new Date(now).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    // Store outgoing message in message store only on verified success
    const sentRecord = {
      id: messageId,
      sender: "agent",
      agentName: agentName || "Super Admin",
      text: textBody,
      time: istTime,
      status: "sent",
      rawTimestamp: now,
      media: media || undefined,
      apiResponse: { ...result, media: media || undefined },
    };

    await messageStore.addMessage(formattedNumber, sentRecord);

    return NextResponse.json({
      success: true,
      messageId,
      result,
    });
  } catch (err) {
    console.error("[INSIGN MULTICHANNEL] Exception:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
