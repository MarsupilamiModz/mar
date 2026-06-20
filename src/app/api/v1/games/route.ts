import { NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { getAllGames } from "@/lib/data";
import { jsonCached, CACHE_PUBLIC_MEDIUM } from "@/lib/http-cache";

export async function GET(req: Request) {
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!hasScope(auth.scopes, "games:read")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const games = await getAllGames();

  return jsonCached(
    {
      data: games.map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        description: g.description,
        iconUrl: g.iconUrl,
        modCount: g._count.mods,
      })),
    },
    CACHE_PUBLIC_MEDIUM
  );
}
