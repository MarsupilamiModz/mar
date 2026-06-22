import { NextRequest, NextResponse } from "next/server";
import { getGameModePickerBundle } from "@/lib/game-modes";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const bundle = await getGameModePickerBundle(slug);
  return NextResponse.json(bundle, {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
  });
}
