import { NextResponse } from "next/server";
import { validateApiKey, hasScope } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const auth = await validateApiKey(_req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!hasScope(auth.scopes, "creators:read")) {
    return NextResponse.json({ error: "Insufficient scope" }, { status: 403 });
  }

  const creator = await prisma.creatorProfile.findFirst({
    where: { OR: [{ slug: params.slug }, { user: { username: params.slug } }] },
    select: {
      slug: true,
      description: true,
      isVerified: true,
      followerCount: true,
      totalDownloads: true,
      user: { select: { username: true, displayName: true, avatarUrl: true } },
      userId: true,
    },
  });

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  const mods = await prisma.mod.findMany({
    where: { authorId: creator.userId, status: "PUBLISHED" },
    take: 20,
    select: { slug: true, title: true, downloadCount: true },
    orderBy: { downloadCount: "desc" },
  });

  return NextResponse.json({
    data: {
      slug: creator.slug,
      displayName: creator.user.displayName ?? creator.user.username,
      bio: creator.description,
      isVerified: creator.isVerified,
      followerCount: creator.followerCount,
      modCount: mods.length,
      user: creator.user,
      mods,
    },
  });
}
