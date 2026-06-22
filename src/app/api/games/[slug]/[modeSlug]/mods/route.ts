import { NextRequest, NextResponse } from "next/server";
import { getMods } from "@/lib/data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; modeSlug: string }> }
) {
  const { slug, modeSlug } = await params;
  const sp = request.nextUrl.searchParams;

  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const limit = Math.min(48, Math.max(1, Number(sp.get("limit") ?? 24)));

  const result = await getMods({
    gameSlug: slug,
    modeSlug,
    search: sp.get("q") ?? undefined,
    pricing: sp.get("pricing") ?? undefined,
    categorySlug: sp.get("category") ?? undefined,
    subcategorySlug: sp.get("subcategory") ?? undefined,
    sort: sp.get("sort") ?? undefined,
    verified: sp.get("verified") === "1",
    page,
    limit,
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
