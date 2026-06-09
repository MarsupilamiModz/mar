import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const modIds = Array.isArray(body.modIds) ? (body.modIds as string[]) : [];
  if (modIds.length === 0) {
    return NextResponse.json({ error: "modIds required" }, { status: 400 });
  }

  await prisma.modFavorite.createMany({
    data: modIds.map((modId) => ({ modId, userId: user.id })),
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, count: modIds.length });
}
