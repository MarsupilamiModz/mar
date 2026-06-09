import { NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { listPublicCollections } from "@/lib/collections-data";

type GraphQLBody = { query?: string; variables?: Record<string, unknown> };

async function resolveMods(args: { q?: string; game?: string; page?: number; limit?: number }) {
  const page = args.page ?? 1;
  const limit = Math.min(50, args.limit ?? 20);
  const where = {
    status: "PUBLISHED" as const,
    visibility: "PUBLIC" as const,
    ...(args.game && { game: { slug: args.game } }),
    ...(args.q && {
      OR: [
        { title: { contains: args.q, mode: "insensitive" as const } },
        { slug: { contains: args.q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.mod.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      select: { id: true, slug: true, title: true, downloadCount: true },
    }),
    prisma.mod.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function POST(req: Request) {
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ errors: [{ message: auth.error }] }, { status: auth.status });
  }

  let body: GraphQLBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: [{ message: "Invalid JSON body" }] }, { status: 400 });
  }

  const query = body.query?.trim() ?? "";
  const variables = body.variables ?? {};

  if (query.includes("mods")) {
    if (!hasScope(auth.scopes, "mods:read")) {
      return NextResponse.json({ errors: [{ message: "Insufficient scope" }] }, { status: 403 });
    }
    const result = await resolveMods({
      q: variables.q as string | undefined,
      game: variables.game as string | undefined,
      page: variables.page as number | undefined,
      limit: variables.limit as number | undefined,
    });
    return NextResponse.json({ data: { mods: result } });
  }

  if (query.includes("games")) {
    if (!hasScope(auth.scopes, "games:read")) {
      return NextResponse.json({ errors: [{ message: "Insufficient scope" }] }, { status: 403 });
    }
    const games = await prisma.game.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
    });
    return NextResponse.json({ data: { games } });
  }

  if (query.includes("collections")) {
    if (!hasScope(auth.scopes, "collections:read")) {
      return NextResponse.json({ errors: [{ message: "Insufficient scope" }] }, { status: 403 });
    }
    const page = (variables.page as number) ?? 1;
    const result = await listPublicCollections(page);
    return NextResponse.json({ data: { collections: result } });
  }

  if (query.includes("mod") && variables.slug) {
    if (!hasScope(auth.scopes, "mods:read")) {
      return NextResponse.json({ errors: [{ message: "Insufficient scope" }] }, { status: 403 });
    }
    const mod = await prisma.mod.findUnique({
      where: { slug: variables.slug as string },
      select: { id: true, slug: true, title: true, description: true },
    });
    return NextResponse.json({ data: { mod } });
  }

  return NextResponse.json({
    errors: [{ message: "Unsupported query. Supported: mods, games, collections, mod(slug)" }],
  }, { status: 400 });
}
