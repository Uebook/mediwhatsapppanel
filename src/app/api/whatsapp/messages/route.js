import { NextResponse } from "next/server";
import { messageStore } from "@/lib/messageStore";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const mobile = searchParams.get("mobile");
  const action = searchParams.get("action");

  if (action === "get_blocked_contacts") {
    const blockedContacts = await messageStore.getBlockedContacts();
    return NextResponse.json({ success: true, blockedContacts });
  }

  if (!mobile) {
    const allMessages = await messageStore.getAllMessages();
    const blockedContacts = await messageStore.getBlockedContacts();
    const reportedContacts = await messageStore.getReportedContacts();
    return NextResponse.json({
      success: true,
      allMessages,
      blockedContacts,
      reportedContacts,
    });
  }

  const messages = await messageStore.getMessages(mobile);
  const isBlocked = await messageStore.isContactBlocked(mobile);
  const isReported = await messageStore.isContactReported(mobile);
  return NextResponse.json({
    success: true,
    mobile,
    messages,
    isBlocked,
    isReported,
  });
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const { mobile } = body;

    if (!mobile) {
      return NextResponse.json(
        { success: false, error: "mobile is required" },
        { status: 400 }
      );
    }

    const cleanNumber = String(mobile).replace(/\D/g, "").slice(-10);
    const updatedCount = await messageStore.markAsRead(cleanNumber);

    return NextResponse.json({
      success: true,
      mobile: cleanNumber,
      markedRead: updatedCount,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// POST endpoint to allow simulating or injecting incoming patient replies directly, and toggling block status
export async function POST(req) {
  try {
    const body = await req.json();

    if (body.action === "toggle_block") {
      const { mobile, blocked } = body;
      const cleanNumber = String(mobile || "").replace(/\D/g, "").slice(-10);
      if (!cleanNumber) {
        return NextResponse.json({ success: false, error: "mobile is required" }, { status: 400 });
      }
      const updatedBlocked = await messageStore.toggleBlock(cleanNumber, Boolean(blocked));
      return NextResponse.json({
        success: true,
        mobile: cleanNumber,
        isBlocked: updatedBlocked,
      });
    }

    if (body.action === "report_contact") {
      const { mobile, reason, details, reportedBy, alsoBlock } = body;
      const cleanNumber = String(mobile || "").replace(/\D/g, "").slice(-10);
      if (!cleanNumber) {
        return NextResponse.json({ success: false, error: "mobile is required" }, { status: 400 });
      }
      const report = await messageStore.recordReport({
        phoneNumber: cleanNumber,
        reason,
        details,
        reportedBy,
        alsoBlock,
      });
      return NextResponse.json({
        success: true,
        mobile: cleanNumber,
        report,
        isBlocked: Boolean(alsoBlock),
      });
    }

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
