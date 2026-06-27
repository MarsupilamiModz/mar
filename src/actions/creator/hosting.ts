"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ok, fail, requireActionUser } from "@/lib/action-utils";
import { getHostingPartnerSettings } from "@/lib/hosting/settings";
import { ModCollaboratorRole } from "@prisma/client";
import { z } from "zod";

export async function getCreatorHostingSettings() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return fail("Creator profile required");

  const platformSettings = await getHostingPartnerSettings();
  return ok({ profile, platformSettings });
}

export async function saveCreatorHostingSettings(input: {
  hostingAffiliateLink?: string | null;
  hostingDescription?: string | null;
  hostingBannerUrl?: string | null;
  hostingPartnerEnabled?: boolean;
}) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const settings = await getHostingPartnerSettings();
  if (settings.creatorOnlyGlobal) {
    return fail("Platform only allows global hosting partners.");
  }
  if (!settings.allowCreatorLinks) {
    return fail("Creator hosting links are disabled by the platform.");
  }

  const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return fail("Creator profile required");

  const updated = await prisma.creatorProfile.update({
    where: { id: profile.id },
    data: {
      hostingAffiliateLink: input.hostingAffiliateLink?.trim() || null,
      hostingDescription: input.hostingDescription?.trim() || null,
      hostingBannerUrl: input.hostingBannerUrl?.trim() || null,
      hostingPartnerEnabled: input.hostingPartnerEnabled ?? profile.hostingPartnerEnabled,
    },
  });

  revalidatePath("/creator/hosting");
  return ok(updated);
}

const collaboratorSchema = z.object({
  modId: z.string(),
  userId: z.string(),
  role: z.nativeEnum(ModCollaboratorRole),
  revenueShareBps: z.number().int().min(0).max(10000),
  isPublic: z.boolean().optional(),
});

export async function saveModCollaborator(input: z.infer<typeof collaboratorSchema>) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const parsed = collaboratorSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid input");

  const mod = await prisma.mod.findUnique({ where: { id: parsed.data.modId } });
  if (!mod) return fail("Mod not found");
  if (mod.authorId !== user.id && user.role !== "OWNER" && user.role !== "ADMIN") {
    return fail("Not authorized");
  }

  const existing = await prisma.modCollaborator.findMany({ where: { modId: mod.id } });
  const nextShares = [
    ...existing.filter((c) => c.userId !== parsed.data.userId),
    { userId: parsed.data.userId, revenueShareBps: parsed.data.revenueShareBps },
  ];
  const total = nextShares.reduce((s, c) => s + c.revenueShareBps, 0);
  if (total > 10000) return fail("Total co-creator shares cannot exceed 100%.");

  const record = await prisma.modCollaborator.upsert({
    where: { modId_userId: { modId: mod.id, userId: parsed.data.userId } },
    create: {
      modId: mod.id,
      userId: parsed.data.userId,
      role: parsed.data.role,
      revenueShareBps: parsed.data.revenueShareBps,
      isPublic: parsed.data.isPublic ?? true,
    },
    update: {
      role: parsed.data.role,
      revenueShareBps: parsed.data.revenueShareBps,
      isPublic: parsed.data.isPublic ?? true,
    },
  });

  revalidatePath(`/creator/mods/${mod.slug}`);
  return ok(record);
}

export async function removeModCollaborator(modId: string, userId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return fail("Mod not found");
  if (mod.authorId !== user.id && user.role !== "OWNER" && user.role !== "ADMIN") {
    return fail("Not authorized");
  }

  await prisma.modCollaborator.delete({
    where: { modId_userId: { modId, userId } },
  });
  return ok(true);
}

export async function getModCollaboratorsForEdit(modId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return fail("Mod not found");
  if (mod.authorId !== user.id && user.role !== "OWNER" && user.role !== "ADMIN") {
    return fail("Not authorized");
  }

  const collaborators = await prisma.modCollaborator.findMany({
    where: { modId },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { revenueShareBps: "desc" },
  });

  return ok(collaborators);
}
