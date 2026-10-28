import { NextResponse, type NextRequest } from "next/server";
import { ChatError, historyRequestSchema, loadConversation } from "@/lib/chat/service";

export async function POST(request: NextRequest) {
  const parsed = historyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const result = await loadConversation(parsed.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ChatError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("chat history failed", error instanceof Error ? error.message.slice(0, 200) : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
