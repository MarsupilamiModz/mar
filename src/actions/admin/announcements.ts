"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { getCurrentUser } from "@/lib/auth";
import {
  announcementVisibleTo,
} from "@/lib/announcement-targeting";

const schema = z.object({
  title: z.string().min(2).max(120),
  content: z.string().min(2).max(5000),
  link: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean(),
  endsAt: z.string().optional(),
  visibilityTargets: z.array(z.string()).optional(),
});

async function buildViewerContext() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [creator, partner, subscription] = await Promise.all([
    prisma.creatorProfile.findUnique({
      where: { userId: user.id },
      select: { isVerified: true },
    }),
    prisma.partnerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    }),
    prisma.subscription.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
      include: { plan: { select: { slug: true } } },
    }),
  ]);

  const planSlug = subscription?.plan?.slug ?? "";
  return {
    role: user.role,
    isCreator: !!creator || user.role === "CREATOR",
    isVerifiedCreator: !!creator?.isVerified,
    isPartner: !!partner || user.role === "PARTNER",
    hasPremium: planSlug.includes("premium"),
    hasPremiumLite: planSlug.includes("lite"),
    hasPremiumMax: planSlug.includes("max"),
    permissionGroupId: user.permissionGroupId,
  };
}

export async function getActiveAnnouncements() {
  const now = new Date();
  const viewer = await buildViewerContext();

  const items = await prisma.announcement.findMany({
    where: {
      isActive: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return items.filter((item) =>
    announcementVisibleTo(item.visibilityTargets, viewer)
  ).slice(0, 3);
}

export async function listAnnouncements() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const items = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
  return ok(items);
}

export async function createAnnouncement(input: z.infer<typeof schema>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const targets = parsed.data.visibilityTargets?.length
    ? parsed.data.visibilityTargets
    : ["everyone"];

  const item = await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      link: parsed.data.link || null,
      isActive: parsed.data.isActive,
      endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      visibilityTargets: targets,
    },
  });
  revalidatePath("/");

  void import("@/lib/translation-worker").then(({ scheduleEntityTranslation }) =>
    scheduleEntityTranslation({
      entityType: "Announcement",
      entityId: item.id,
      fields: { title: item.title, content: item.content },
    })
  );

  return ok(item);
}

export async function updateAnnouncement(
  id: string,
  input: Partial<z.infer<typeof schema>>
) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  await prisma.announcement.update({
    where: { id },
    data: {
      ...(input.title && { title: input.title }),
      ...(input.content && { content: input.content }),
      ...(input.link !== undefined && { link: input.link || null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.endsAt !== undefined && {
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      }),
      ...(input.visibilityTargets && { visibilityTargets: input.visibilityTargets }),
    },
  });
  revalidatePath("/");
  return ok(undefined);
}

export async function toggleAnnouncement(id: string, isActive: boolean) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await prisma.announcement.update({ where: { id }, data: { isActive } });
  revalidatePath("/");
  return ok(undefined);
}

export async function deleteAnnouncement(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await prisma.announcement.delete({ where: { id } });
  revalidatePath("/");
  return ok(undefined);
}
