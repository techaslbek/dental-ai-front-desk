import { NextResponse, type NextRequest } from "next/server";
import { chatRequestSchema, ChatError, handleChatMessage } from "@/lib/chat/service";

const MAX_BODY_BYTES = 8 * 1024;

// Vercel sets x-forwarded-for; the first entry is the client.
function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "too_large" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const result = await handleChatMessage(parsed.data, clientIp(request));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ChatError) {
      // 429 errors carry a patient-facing message; others are codes.
      return NextResponse.json(
        error.status === 429 ? { error: "limited", reply: error.code } : { error: error.code },
        { status: error.status },
      );
    }
    console.error("chat request failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
