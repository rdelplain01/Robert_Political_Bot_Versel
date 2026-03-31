import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Note: Ensure the `Beliefs` and `SliderPrompts` folders exist at the root level of your project!

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const name = searchParams.get("name");
  const value = searchParams.get("value");

  if (!type) {
    return NextResponse.json({ error: "Missing type parameter" }, { status: 400 });
  }

  try {
    const rootPath = process.cwd();
    let filePath = "";

    if (type === "belief") {
      if (!value) return NextResponse.json({ error: "Missing value" }, { status: 400 });
      filePath = path.join(rootPath, "Beliefs", `${value}.txt`);
    } else if (type === "slider") {
      if (!name || !value) return NextResponse.json({ error: "Missing name or value" }, { status: 400 });
      filePath = path.join(rootPath, "SliderPrompts", name, `${value}.txt`);
    } else if (type === "template") {
      // Load the overall expression template from the Python implementation's "Prompt/expresivness.txt"
      // Wait, we need to bring Prompt/expresivness.txt over.
      filePath = path.join(rootPath, "Prompt", "expresivness.txt");
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Read the file content
    const content = await fs.readFile(filePath, "utf-8");
    return NextResponse.json({ content });

  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ content: "" }); // Send empty if not found, like Python gracefully handled
    }
    console.error("Error reading file:", err);
    return NextResponse.json({ error: "Failed to read file" }, { status: 500 });
  }
}
