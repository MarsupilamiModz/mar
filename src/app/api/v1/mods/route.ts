import { NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!hasScope(auth.scopes, "mods:read")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const search = searchParams.get("q")?.trim();
  const gameSlug = searchParams.get("game");

  const where = {
    status: "PUBLISHED" as const,
    visibility: "PUBLIC" as const,
    ...(gameSlug && { game: { slug: gameSlug } }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [mods, total] = await Promise.all([
    prisma.mod.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { downloadCount: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        shortDescription: true,
        pricing: true,
        downloadCount: true,
        averageRating: true,
        game: { select: { slug: true, name: true } },
        author: { select: { username: true, displayName: true } },
        versions: {
          where: { isPrimary: true, isArchived: false },
          take: 1,
          select: {
            id: true,
            version: true,
            gameVersion: true,
            channel: true,
            fileSize: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.mod.count({ where }),
  ]);

  return NextResponse.json({
    data: mods,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}
