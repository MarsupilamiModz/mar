import { NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const auth = await validateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!hasScope(auth.scopes, "downloads:meta")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const modId = searchParams.get("modId");
  const versionId = searchParams.get("versionId");

  if (!modId) {
    return NextResponse.json({ error: "modId required" }, { status: 400 });
  }

  const mod = await prisma.mod.findUnique({
    where: { id: modId, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      pricing: true,
      versions: versionId
        ? {
            where: { id: versionId, isArchived: false },
            take: 1,
            select: {
              id: true,
              version: true,
              fileName: true,
              fileSize: true,
              gameVersion: true,
              channel: true,
              sha256: true,
              downloadCount: true,
            },
          }
        : {
            where: { isPrimary: true, isArchived: false },
            take: 1,
            select: {
              id: true,
              version: true,
              fileName: true,
              fileSize: true,
              gameVersion: true,
              channel: true,
              sha256: true,
              downloadCount: true,
            },
          },
    },
  });

  if (!mod?.versions[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const v = mod.versions[0];
  return NextResponse.json({
    data: {
      modId: mod.id,
      modSlug: mod.slug,
      modTitle: mod.title,
      pricing: mod.pricing,
      version: v,
      downloadUrl: `/api/mods/${mod.id}/download${versionId ? `?versionId=${v.id}` : ""}`,
      clientInstall: {
        modId: mod.id,
        versionId: v.id,
        fileName: v.fileName,
        sha256: v.sha256,
        gameVersion: v.gameVersion,
      },
    },
  });
}
