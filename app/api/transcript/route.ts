import { readFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { transcriptFromJson } from "@/lib/transcript";

export async function GET() {
  try {
    const path = join(process.cwd(), "public", "data", "transcript.json");
    const raw = await readFile(path, "utf-8");
    const data = JSON.parse(raw) as unknown;
    const transcript = transcriptFromJson(data);
    return NextResponse.json({ transcript });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to load transcript" },
      { status: 500 },
    );
  }
}
