import { NextRequest, NextResponse } from "next/server";
import { getGameModePickerBundle } from "@/lib/game-modes";
import { timedApi } from "@/lib/monitoring/perf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const start = Date.now();
  const bundle = await timedApi(`GET /api/games/${slug}/modes`, () =>
    getGameModePickerBundle(slug)
  );
  const duration = Date.now() - start;
  return NextResponse.json(bundle, {
    headers: {
      "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300",
      "Server-Timing": `app;dur=${duration}`,
    },
  });
}
