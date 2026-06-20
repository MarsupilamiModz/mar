import { NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getModDependencies } from "@/lib/mod-dependencies";
import { jsonCached, CACHE_PUBLIC_SHORT } from "@/lib/http-cache";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!hasScope(auth.scopes, "mods:read")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const mod = await prisma.mod.findUnique({
    where: { slug, status: "PUBLISHED", visibility: "PUBLIC" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      shortDescription: true,
      pricing: true,
      priceCents: true,
      downloadCount: true,
      averageRating: true,
      supportedVersions: true,
      game: { select: { slug: true, name: true } },
      category: { select: { name: true, slug: true } },
      author: {
        select: {
          username: true,
          displayName: true,
          creatorProfile: { select: { slug: true } },
        },
      },
      tags: { select: { name: true } },
      versions: {
        where: { isArchived: false },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          version: true,
          changelog: true,
          gameVersion: true,
          channel: true,
          isPrimary: true,
          fileSize: true,
          fileName: true,
          downloadCount: true,
          createdAt: true,
        },
      },
    },
  });

  if (!mod) {
    return NextResponse.json({ error: "Mod not found" }, { status: 404 });
  }

  const dependencies = await getModDependencies(mod.id);

  return jsonCached(
    {
      data: {
        ...mod,
        dependencies: dependencies.map((d) => ({
          isRequired: d.isRequired,
          minVersion: d.minVersion,
          notes: d.notes,
          mod: d.dependency,
        })),
      },
    },
    CACHE_PUBLIC_SHORT
  );
}
