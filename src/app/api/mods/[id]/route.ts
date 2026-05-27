import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const mod = await prisma.mod.findUnique({
    where: { id: params.id },
    select: { id: true, slug: true, title: true, authorId: true },
  });

  if (!mod) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canView =
    mod.authorId === user.id ||
    hasPermission(user.role, "mods.read");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(mod);
}
