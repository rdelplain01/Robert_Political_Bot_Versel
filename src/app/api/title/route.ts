import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// POST /api/title — generate a short title for a conversation
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ title: "New chat" });
    }

    // Take only the first few messages for context (keep tokens low)
    const snippet = messages.slice(0, 6).map((m: { role: string; content: string }) =>
      `${m.role}: ${m.content.slice(0, 200)}`
    ).join("\n");

    const response = await openai.chat.completions.create({
      model: "grok-3-mini-fast",
      messages: [
        {
          role: "system",
          content: "You are a title generator. Given a conversation snippet, produce a short, descriptive title (3-6 words max). Return ONLY the title text, nothing else. No quotes, no punctuation at the end.",
        },
        {
          role: "user",
          content: `Generate a short title for this conversation:\n\n${snippet}`,
        },
      ],
      max_tokens: 20,
      temperature: 0.3,
    });

    const title = response.choices[0]?.message?.content?.trim() || "New chat";
    return NextResponse.json({ title });
  } catch (error) {
    console.error("Title generation error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ title: "New chat" });
  }
}
