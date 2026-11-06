import { NextResponse } from "next/server";

const INSIGN_API_TOKEN =
  process.env.INSIGN_WHATSAPP_TOKEN ||
  process.env.WHATSAPP_API_TOKEN ||
  "361|qvSlohCNI5loBq7eumrBLvPI68wuTFsSddLe3Mugd7463735";

// GET /api/email/templates -> List all templates from multichannel.insignsms.com
export async function GET() {
  try {
    const url = "https://multichannel.insignsms.com/api/v1/email/listTemplates";
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${INSIGN_API_TOKEN}`,
      },
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

// POST /api/email/templates -> Create a new template on multichannel.insignsms.com
export async function POST(req) {
  try {
    const body = await req.json();
    const { template_name, code_content, type = "html" } = body;

    const url = "https://multichannel.insignsms.com/api/v1/email/template";
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${INSIGN_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_name,
        type,
        code_content,
      }),
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
