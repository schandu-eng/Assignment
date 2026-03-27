import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      videoUrl: "/video.mp4",
      backgroundUrl: "/background.jpg",
    },
    {
      headers: {
        "Cache-Control": "no-store, must-revalidate",
      },
    },
  );
}
