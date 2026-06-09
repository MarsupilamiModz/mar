import { NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!hasScope(auth.scopes, "games:read")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const games = await prisma.game.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      iconUrl: true,
      _count: { select: { mods: { where: { status: "PUBLISHED" } } } },
    },
  });

  return NextResponse.json({ data: games });
}
