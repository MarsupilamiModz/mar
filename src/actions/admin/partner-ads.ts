"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { ok, fail, requireActionUser } from "@/lib/action-utils";
import { createAuditLog } from "@/lib/audit";
import { slugify } from "@/lib/utils";
import {
  getHostingPartnerSettings,
  saveHostingPartnerSettings,
  type HostingPartnerSettings,
} from "@/lib/hosting/settings";
import { getHostingAnalyticsSummary } from "@/lib/hosting/resolve";
import { HostingBannerSize } from "@prisma/client";
import { z } from "zod";

async function requireHostingAdmin() {
  const { user, error } = await requireActionUser();
  if (error) return { user: null as never, error };
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return { user: null as never, error: fail("Admin access required") };
  }
  return { user, error: null };
}

export async function getPartnerAdsCenterData() {
  const { error } = await requireHostingAdmin();
  if (error) return error;

  const [partners, games, settings, analytics, banners] = await Promise.all([
    prisma.hostingPartner.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.game.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        hostingPartner: { include: { partner: { select: { id: true, name: true } } } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    getHostingPartnerSettings(),
    getHostingAnalyticsSummary(),
    prisma.hostingPartnerBanner.findMany({
      include: { partner: { select: { id: true, name: true } }, game: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  return ok({ partners, games, settings, analytics, banners });
}

const partnerSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(80).optional(),
  description: z.string().max(5000).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  affiliateUrl: z.string().url(),
  trackingId: z.string().max(120).optional(),
  apiProvider: z.string().max(80).optional(),
  isActive: z.boolean().optional(),
  isGlobal: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function saveHostingPartner(input: z.infer<typeof partnerSchema> & { id?: string }) {
  const { user, error } = await requireHostingAdmin();
  if (error) return error;

  const parsed = partnerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.errors[0]?.message ?? "Invalid input");

  const slug = parsed.data.slug?.trim() || slugify(parsed.data.name);
  const data = {
    name: parsed.data.name.trim(),
    slug,
    description: parsed.data.description?.trim() || null,
    logoUrl: parsed.data.logoUrl || null,
    websiteUrl: parsed.data.websiteUrl || null,
    affiliateUrl: parsed.data.affiliateUrl.trim(),
    trackingId: parsed.data.trackingId?.trim() || null,
    apiProvider: parsed.data.apiProvider?.trim() || null,
    isActive: parsed.data.isActive ?? true,
    isGlobal: parsed.data.isGlobal ?? false,
    sortOrder: parsed.data.sortOrder ?? 0,
  };

  const record = input.id
    ? await prisma.hostingPartner.update({ where: { id: input.id }, data })
    : await prisma.hostingPartner.create({ data });

  if (data.isGlobal) {
    await prisma.hostingPartner.updateMany({
      where: { id: { not: record.id }, isGlobal: true },
      data: { isGlobal: false },
    });
  }

  await createAuditLog({
    actorId: user.id,
    action: input.id ? "hosting.partner.update" : "hosting.partner.create",
    entityType: "HostingPartner",
    entityId: record.id,
  });

  revalidatePath("/admin/partner-ads");
  return ok(record);
}

export async function deleteHostingPartner(id: string) {
  const { user, error } = await requireHostingAdmin();
  if (error) return error;

  await prisma.hostingPartner.delete({ where: { id } });
  await createAuditLog({
    actorId: user.id,
    action: "hosting.partner.delete",
    entityType: "HostingPartner",
    entityId: id,
  });
  revalidatePath("/admin/partner-ads");
  return ok(true);
}

export async function setGameHostingPartner(gameId: string, partnerId: string | null) {
  const { user, error } = await requireHostingAdmin();
  if (error) return error;

  if (!partnerId) {
    await prisma.gameHostingPartner.deleteMany({ where: { gameId } });
  } else {
    await prisma.gameHostingPartner.upsert({
      where: { gameId },
      create: { gameId, partnerId },
      update: { partnerId },
    });
  }

  await createAuditLog({
    actorId: user.id,
    action: "hosting.game.partner.set",
    entityType: "Game",
    entityId: gameId,
    metadata: { partnerId },
  });

  revalidatePath("/admin/partner-ads");
  return ok(true);
}

export async function savePartnerAdsSettings(settings: HostingPartnerSettings) {
  const { user, error } = await requireHostingAdmin();
  if (error) return error;

  try {
    const saved = await saveHostingPartnerSettings(settings);
    await createAuditLog({
      actorId: user.id,
      action: "hosting.settings.save",
      entityType: "SiteSetting",
      entityId: "hosting_partner_settings",
    });
    revalidatePath("/admin/partner-ads");
    return ok(saved);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to save settings");
  }
}

export async function saveHostingBanner(input: {
  id?: string;
  partnerId: string;
  size: HostingBannerSize;
  imageUrl: string;
  webpUrl?: string | null;
  avifUrl?: string | null;
  targetUrl?: string | null;
  gameId?: string | null;
  modId?: string | null;
  collectionId?: string | null;
  creatorId?: string | null;
  isActive?: boolean;
}) {
  const { user, error } = await requireHostingAdmin();
  if (error) return error;

  const data = {
    partnerId: input.partnerId,
    size: input.size,
    imageUrl: input.imageUrl,
    webpUrl: input.webpUrl ?? null,
    avifUrl: input.avifUrl ?? null,
    targetUrl: input.targetUrl ?? null,
    gameId: input.gameId ?? null,
    modId: input.modId ?? null,
    collectionId: input.collectionId ?? null,
    creatorId: input.creatorId ?? null,
    isActive: input.isActive ?? true,
  };

  const record = input.id
    ? await prisma.hostingPartnerBanner.update({ where: { id: input.id }, data })
    : await prisma.hostingPartnerBanner.create({ data });

  await createAuditLog({
    actorId: user.id,
    action: "hosting.banner.save",
    entityType: "HostingPartnerBanner",
    entityId: record.id,
  });

  revalidatePath("/admin/partner-ads");
  return ok(record);
}

export async function deleteHostingBanner(id: string) {
  const { error } = await requireHostingAdmin();
  if (error) return error;
  await prisma.hostingPartnerBanner.delete({ where: { id } });
  revalidatePath("/admin/partner-ads");
  return ok(true);
}
