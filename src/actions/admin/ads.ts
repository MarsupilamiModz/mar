"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import {
  DEFAULT_AD_SETTINGS,
  saveAdSettings,
  seedDefaultAdPlacements,
  seedDefaultAdProviders,
  type AdProviderSettings,
} from "@/lib/ads";
import type { AdFormat, AdProviderType, Prisma } from "@prisma/client";
import { getAdSettings } from "@/lib/ads";
import { getAdSenseReadinessReport } from "@/lib/ads-readiness";
import {
  getSiteVerificationSettings,
  saveSiteVerificationSettings,
  type SiteVerificationSettings,
} from "@/lib/site-verification";
import {
  getHeadScriptsSettings,
  saveHeadScriptsSettings,
  type HeadScriptsSettings,
} from "@/lib/head-scripts";
import { writeAdsTxtFile } from "@/lib/ads-txt-file";
import { DEFAULT_ADSENSE_CLIENT_ID } from "@/lib/adsense-config";

export async function getAdminAdDashboard() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  await seedDefaultAdProviders();
  await seedDefaultAdPlacements();

  await prisma.adProviderConfig.upsert({
    where: { type: "ADSENSE" },
    create: {
      type: "ADSENSE",
      name: "Google AdSense",
      isEnabled: true,
      config: { adsenseClientId: DEFAULT_ADSENSE_CLIENT_ID },
    },
    update: { isEnabled: true },
  });

  const [settings, placements, providers, totals, readiness, verification, headScripts] =
    await Promise.all([
      getAdSettings(),
      prisma.adPlacement.findMany({ orderBy: [{ location: "asc" }, { sortOrder: "asc" }] }),
      prisma.adProviderConfig.findMany({ orderBy: { type: "asc" } }),
      prisma.adPlacement.aggregate({ _sum: { impressions: true, clicks: true } }),
      getAdSenseReadinessReport(),
      getSiteVerificationSettings(),
      getHeadScriptsSettings(),
    ]);

  return ok({
    settings,
    placements,
    providers,
    totalImpressions: totals._sum.impressions ?? 0,
    totalClicks: totals._sum.clicks ?? 0,
    readiness,
    verification,
    headScripts,
  });
}

export async function saveAdminAdSettings(settings: AdProviderSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const merged = { ...DEFAULT_AD_SETTINGS, ...settings };
  await saveAdSettings(merged);
  try {
    writeAdsTxtFile(merged);
  } catch (err) {
    console.error("[ads] ads.txt write failed", err);
  }
  const readiness = await getAdSenseReadinessReport();
  revalidatePath("/admin/ads");
  revalidatePath("/", "layout");
  return ok({ readiness });
}

export async function saveAdminSiteVerification(settings: SiteVerificationSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await saveSiteVerificationSettings(settings);
  revalidatePath("/admin/ads");
  revalidatePath("/", "layout");
  return ok(undefined);
}

export async function saveAdminHeadScripts(settings: HeadScriptsSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await saveHeadScriptsSettings(settings);
  revalidatePath("/admin/ads");
  revalidatePath("/admin/branding");
  revalidatePath("/", "layout");
  return ok(undefined);
}

export async function getAdminAdSenseStatus() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await getAdSenseReadinessReport());
}

export async function saveAdProvider(input: {
  type: AdProviderType;
  name: string;
  config: Record<string, unknown>;
  scriptHtml?: string;
  isEnabled: boolean;
}) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const data = {
    type: input.type,
    name: input.name,
    config: input.config as Prisma.InputJsonValue,
    scriptHtml: input.scriptHtml,
    isEnabled: input.isEnabled,
  };

  await prisma.adProviderConfig.upsert({
    where: { type: input.type },
    create: data,
    update: data,
  });
  revalidatePath("/admin/ads");
  return ok(undefined);
}

export async function saveAdPlacement(input: {
  id?: string;
  slug: string;
  name: string;
  location: string;
  format: AdFormat;
  provider: AdProviderType;
  providerConfig?: Record<string, unknown>;
  customHtml?: string;
  imageUrl?: string;
  linkUrl?: string;
  width?: number;
  height?: number;
  isEnabled?: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
  scheduleStart?: string;
  scheduleEnd?: string;
  sortOrder?: number;
}) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const data = {
    slug: input.slug,
    name: input.name,
    location: input.location,
    format: input.format,
    provider: input.provider,
    providerConfig: input.providerConfig as Prisma.InputJsonValue | undefined,
    customHtml: input.customHtml || null,
    imageUrl: input.imageUrl || null,
    linkUrl: input.linkUrl || null,
    width: input.width ?? null,
    height: input.height ?? null,
    isEnabled: input.isEnabled ?? true,
    mobileOnly: input.mobileOnly ?? false,
    desktopOnly: input.desktopOnly ?? false,
    scheduleStart: input.scheduleStart ? new Date(input.scheduleStart) : null,
    scheduleEnd: input.scheduleEnd ? new Date(input.scheduleEnd) : null,
    sortOrder: input.sortOrder ?? 0,
  };

  if (input.id) {
    await prisma.adPlacement.update({ where: { id: input.id }, data });
  } else {
    const exists = await prisma.adPlacement.findUnique({ where: { slug: input.slug } });
    if (exists) return fail("Slug already exists");
    await prisma.adPlacement.create({ data });
  }

  revalidatePath("/admin/ads");
  return ok(undefined);
}

export async function deleteAdPlacement(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await prisma.adPlacement.delete({ where: { id } });
  revalidatePath("/admin/ads");
  return ok(undefined);
}

export async function toggleAdPlacement(id: string, isEnabled: boolean) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await prisma.adPlacement.update({ where: { id }, data: { isEnabled } });
  revalidatePath("/admin/ads");
  return ok(undefined);
}
