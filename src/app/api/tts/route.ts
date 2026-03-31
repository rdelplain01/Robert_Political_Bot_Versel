import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "elevenlabs";

// Initialize ElevenLabs on the Server Side to completely hide ELL_API_KEY
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELL_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: "Text is required" },
        { status: 400 }
      );
    }

    // Default to the user's specific voice ID "Robert"
    const targetVoiceId = voiceId || "JBFqnCBsd6RMkjVDRZzb";

    // Call ElevenLabs
    const audioStream = await elevenlabs.textToSpeech.convert(targetVoiceId, {
      text: text,
      model_id: "eleven_multilingual_v2",
      output_format: "mp3_44100_128",
    });

    // Create a new stream response to send back the binary audio
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of audioStream) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (streamError) {
          controller.error(streamError);
        }
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("TTS API Error:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "Failed to generate TTS" },
      { status: 500 }
    );
  }
}
