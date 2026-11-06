import { NextResponse } from "next/server";

const INSIGN_API_TOKEN =
  process.env.INSIGN_WHATSAPP_TOKEN ||
  process.env.WHATSAPP_API_TOKEN ||
  "361|qvSlohCNI5loBq7eumrBLvPI68wuTFsSddLe3Mugd7463735";

// POST /api/email/send -> Send Email via multichannel.insignsms.com
export async function POST(req) {
  try {
    const body = await req.json();
    const url = "https://multichannel.insignsms.com/api/v1/email/sendEmail";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INSIGN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
