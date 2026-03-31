import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

// Initialize OpenAI client pointing to xAI's API
// This runs securely on the Node.js server
const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    // Call Grok API
    const response = await openai.chat.completions.create({
      model: "grok-4-1-fast-reasoning", // You can change this if the model ID changes
      messages: messages,
    });

    const aiMessage = response.choices[0]?.message;

    if (!aiMessage) {
      throw new Error("No message returned from API");
    }

    return NextResponse.json({ message: aiMessage });
  } catch (error) {
    console.error("Chat API Error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Failed to generate chat response" },
      { status: 500 }
    );
  }
}
