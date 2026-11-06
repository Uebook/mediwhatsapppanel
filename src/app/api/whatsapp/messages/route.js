import { NextResponse } from "next/server";
import { messageStore } from "@/lib/messageStore";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mobile = searchParams.get("mobile");

  if (!mobile) {
    const allMessages = await messageStore.getAllMessages();
    return NextResponse.json({
      success: true,
      allMessages,
    });
  }

  const messages = await messageStore.getMessages(mobile);
  return NextResponse.json({
    success: true,
    mobile,
    messages,
  });
}

// POST endpoint to allow simulating or injecting incoming patient replies directly
export async function POST(req) {
  try {
    const body = await req.json();
    const { mobile, text, sender = "patient", media } = body;

    if (!mobile || (!text && !media)) {
      return NextResponse.json(
        { success: false, error: "mobile and text or media are required" },
        { status: 400 }
      );
    }

    const now = Date.now();
    const newMsg = {
      id: "msg-sim-" + now,
      sender,
      text: String(text || "").trim(),
      time: new Date(now).toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
      status: "received",
      rawTimestamp: now,
      media: media || undefined,
      apiResponse: { media: media || undefined },
    };

    await messageStore.addMessage(mobile, newMsg);

    return NextResponse.json({
      success: true,
      message: newMsg,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
