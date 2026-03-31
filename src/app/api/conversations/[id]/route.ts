import { NextRequest, NextResponse } from "next/server";
import { chatStore } from "@/lib/chatStore";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/conversations/[id]  → get all messages for a conversation
export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const conversationId = Number(id);
  if (isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  try {
    const messages = await chatStore.getMessages(conversationId);
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Get messages error:", err);
    return NextResponse.json({ error: "Failed to get messages" }, { status: 500 });
  }
}

// PATCH /api/conversations/[id]  → end / finalize a conversation
// Body: { trigger: string, title?: string }
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const conversationId = Number(id);
  if (isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  try {
    const { trigger, title } = await req.json();
    const kept = await chatStore.endConversation(conversationId, trigger || "manual", title);
    return NextResponse.json({ kept });
  } catch (err) {
    console.error("End conversation error:", err);
    return NextResponse.json({ error: "Failed to end conversation" }, { status: 500 });
  }
}

// DELETE /api/conversations/[id] → delete a conversation
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const conversationId = Number(id);
  if (isNaN(conversationId)) {
    return NextResponse.json({ error: "Invalid conversation id" }, { status: 400 });
  }

  try {
    await chatStore.deleteConversation(conversationId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("Delete conversation error:", err);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
