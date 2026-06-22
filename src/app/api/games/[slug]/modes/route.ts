import { NextRequest, NextResponse } from "next/server";
import { getGameModesByGameSlug } from "@/lib/game-modes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const modes = await getGameModesByGameSlug(slug);
  return NextResponse.json(
    { modes },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
  );
}
