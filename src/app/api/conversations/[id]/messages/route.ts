import { NextRequest, NextResponse } from "next/server";
import { chatStore } from "@/lib/chatStore";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/conversations/[id]/messages  → append a message
// Body: { role: string, content: string }
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const conversationId = Number(id);
  if (isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  try {
    const { role, content } = await req.json();
    if (!role || !content) {
      return NextResponse.json({ error: "role and content are required" }, { status: 400 });
    }

    await chatStore.appendMessage(conversationId, role, content);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Append message error:", err);
    return NextResponse.json({ error: "Failed to append message" }, { status: 500 });
  }
}
