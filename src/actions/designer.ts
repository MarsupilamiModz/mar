"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { isDesigner } from "@/lib/permissions";
import { slugify } from "@/lib/utils";
import { z } from "zod";

const applySchema = z.object({
  specialty: z.string().min(2).max(80),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
});

export async function getDesignerDashboard() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { designerProfile: true },
  });
  if (!dbUser || (!isDesigner(dbUser.role) && !dbUser.designerProfile)) {
    return fail("Designer access required");
  }

  const [uploads, orders, earnings, downloads] = await Promise.all([
    prisma.mod.findMany({
      where: { authorId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: {
        game: { select: { name: true } },
        _count: { select: { downloads: true, versions: true } },
      },
    }),
    prisma.customOrder.findMany({
      where: { assigneeId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        client: { select: { username: true } },
        _count: { select: { messages: true } },
      },
    }),
    prisma.modPurchase.aggregate({
      where: { mod: { authorId: user.id } },
      _sum: { amountCents: true },
    }),
    prisma.mod.aggregate({
      where: { authorId: user.id },
      _sum: { downloadCount: true },
    }),
  ]);

  return ok({
    profile: dbUser.designerProfile,
    uploads,
    orders,
    totalEarnings: (earnings._sum.amountCents ?? 0) / 100,
    totalDownloads: downloads._sum.downloadCount ?? 0,
  });
}

export async function applyForDesigner(input: z.infer<typeof applySchema>) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const parsed = applySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const existing = await prisma.designerProfile.findUnique({ where: { userId: user.id } });
  if (existing) return fail("Designer profile already exists");

  const base = slugify(user.username);
  let slug = base;
  let i = 0;
  while (await prisma.designerProfile.findUnique({ where: { slug } })) {
    slug = `${base}-${++i}`;
  }

  await prisma.$transaction([
    prisma.designerProfile.create({
      data: {
        userId: user.id,
        slug,
        specialty: parsed.data.specialty,
        portfolioUrl: parsed.data.portfolioUrl || null,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { role: user.role === "USER" || user.role === "PREMIUM" ? "DESIGNER" : user.role },
    }),
  ]);

  revalidatePath("/designer");
  return ok(undefined);
}
