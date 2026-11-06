import { NextResponse } from "next/server";
import { getDeliveryReport } from "@/lib/insignMultiChannelApi";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const messageId = searchParams.get("messageId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");

    const data = await getDeliveryReport({ messageId, from, to, status });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
