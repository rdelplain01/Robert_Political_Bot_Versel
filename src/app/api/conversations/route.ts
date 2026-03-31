import { NextRequest, NextResponse } from "next/server";
import { chatStore } from "@/lib/chatStore";

// GET /api/conversations?user=<name>  → list conversations for a user
export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user");
  if (!user) {
    return NextResponse.json({ error: "user query param required" }, { status: 400 });
  }

  try {
    await chatStore.ensureSchema();
    await chatStore.finalizeStaleConversations(user);
    const conversations = await chatStore.listConversations(user);
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("List conversations error:", err);
    return NextResponse.json({ error: "Failed to list conversations" }, { status: 500 });
  }
}

// POST /api/conversations  → create a new conversation
// Body: { userName: string, promptSnapshot?: object }
export async function POST(req: NextRequest) {
  try {
    const { userName, promptSnapshot } = await req.json();
    if (!userName) {
      return NextResponse.json({ error: "userName is required" }, { status: 400 });
    }

    await chatStore.ensureSchema();
    const id = await chatStore.createConversation(userName, promptSnapshot);
    return NextResponse.json({ id });
  } catch (err) {
    console.error("Create conversation error:", err);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
