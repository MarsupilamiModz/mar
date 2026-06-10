"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionTry, fail, ok, requireActionPermission } from "@/lib/action-utils";
import { invalidatePermissionCache } from "@/lib/permission-store";
import type { Prisma } from "@prisma/client";
import { saveGameCoverOverride } from "@/lib/branding";
import { uploadAsset } from "@/lib/asset-storage";
import { extensionForMime, validateUploadFile } from "@/lib/upload-validation";
import { invalidateBrandingCache } from "@/lib/branding-data";
import {
  getBrandingAssetSettings,
  saveBrandingAssetSettings,
  getHeaderSettings,
  saveHeaderSettings,
  getFooterSettings,
  saveFooterSettings,
  getSeoSettings,
  saveSeoSettings,
  getPageContentStore,
  savePageContentStore,
  syncIconVariantsFromFavicon,
  type BrandingAssetSettings,
  type HeaderSettings,
  type FooterSettings,
  type SeoSettings,
  type PageContentStore,
} from "@/lib/branding-cms";

function revalidateBrandingPaths() {
  invalidateBrandingCache();
  revalidatePath("/");
  revalidatePath("/admin/branding");
}

export async function getAdminBrandingCenter() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const [branding, header, footer, seo, pageContent] = await Promise.all([
    getBrandingAssetSettings(),
    getHeaderSettings(),
    getFooterSettings(),
    getSeoSettings(),
    getPageContentStore(),
  ]);

  return ok({ branding, header, footer, seo, pageContent });
}

export async function getAdminBranding() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await getBrandingAssetSettings());
}

export async function saveAdminBranding(settings: BrandingAssetSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return actionTry(async () => {
    await saveBrandingAssetSettings(settings);
    revalidateBrandingPaths();
  }, "branding:save");
}

export async function saveAdminHeaderSettings(settings: HeaderSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return actionTry(async () => {
    await saveHeaderSettings(settings);
    revalidateBrandingPaths();
  }, "branding:header");
}

export async function saveAdminFooterSettings(settings: FooterSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return actionTry(async () => {
    await saveFooterSettings(settings);
    revalidateBrandingPaths();
  }, "branding:footer");
}

export async function saveAdminSeoSettings(settings: SeoSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return actionTry(async () => {
    await saveSeoSettings(settings);
    revalidateBrandingPaths();
  }, "branding:seo");
}

export async function saveAdminPageContent(store: PageContentStore) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return actionTry(async () => {
    await savePageContentStore(store);
    revalidateBrandingPaths();
  }, "branding:content");
}

const BRANDING_MIMES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

export async function uploadBrandingAsset(formData: FormData) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const file = formData.get("file") as File;
  const assetType = formData.get("type") as string;
  const validation = validateUploadFile(file, {
    maxSizeMb: 5,
    allowedTypes: BRANDING_MIMES,
    label: "Branding asset",
  });
  if (!validation.valid) return fail(validation.error);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadAsset({
      bucket: "mod-images",
      relativePath: `branding/${assetType}-${Date.now()}.${extensionForMime(validation.mime)}`,
      body: buffer,
      contentType: validation.mime,
    });

    let branding = await getBrandingAssetSettings();
    const fieldMap: Record<string, keyof BrandingAssetSettings | "favicon-bundle" | "url-only"> = {
      logo: "logoUrl",
      "logo-dark": "logoDarkUrl",
      favicon: "favicon-bundle",
      loading: "loadingLogoUrl",
      mobile: "mobileIconUrl",
      symbol: "siteSymbolUrl",
      og: "url-only",
    };
    const field = fieldMap[assetType];
    if (field === "favicon-bundle") {
      branding = syncIconVariantsFromFavicon(branding, result.url);
    } else if (field && field !== "url-only") {
      branding = { ...branding, [field]: result.url };
    }

    if (field !== "url-only") {
      await saveBrandingAssetSettings(branding);
    }
    revalidateBrandingPaths();
    return ok({ url: result.url, branding });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Upload failed");
  }
}

export async function removeBrandingAsset(field: keyof BrandingAssetSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(async () => {
    const branding = await getBrandingAssetSettings();
    const cleared = { ...branding, [field]: null };
    if (field === "faviconUrl") {
      cleared.appleTouchIconUrl = null;
      cleared.androidIconUrl = null;
      cleared.pwaIconUrl = null;
    }
    await saveBrandingAssetSettings(cleared);
    revalidateBrandingPaths();
  }, "branding:remove-asset");
}

export async function saveGameCoverAdmin(gameId: string, formData: FormData) {
  const { error } = await requireActionPermission("games.write");
  if (error) return error;

  const accentColor = (formData.get("accentColor") as string) || undefined;
  const backgroundGradient = (formData.get("backgroundGradient") as string) || undefined;
  const file = formData.get("heroBanner") as File | null;

  let heroBannerUrl: string | undefined;
  if (file?.size) {
    const validation = validateUploadFile(file, { maxSizeMb: 5, allowedTypes: ["image/jpeg", "image/png", "image/webp"] });
    if (!validation.valid) return fail(validation.error);
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadAsset({
      bucket: "games",
      relativePath: `${gameId}/hero-${Date.now()}.${extensionForMime(validation.mime)}`,
      body: buffer,
      contentType: validation.mime,
    });
    heroBannerUrl = result.url;
    await prisma.game.update({ where: { id: gameId }, data: { bannerUrl: result.url } });
  }

  await saveGameCoverOverride(gameId, {
    gameId,
    heroBannerUrl,
    accentColor,
    backgroundGradient,
  });

  revalidatePath("/admin/games");
  return ok(undefined);
}

export async function getAdminPermissionGroups() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(async () => {
    let groups = await prisma.permissionGroup.findMany({
      where: { isArchived: false },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    if (groups.length === 0) {
      await prisma.permissionGroup.createMany({
        data: [
          { slug: "staff-full", name: "Staff Full Access", permissions: ["*"], isSystem: true },
          { slug: "creator-standard", name: "Creator Standard", permissions: ["mods.read", "assets.read", "analytics.creator", "licenses.write"], isSystem: true },
          { slug: "partner-standard", name: "Partner Standard", permissions: ["analytics.creator", "coupons.write"], isSystem: true },
        ],
      });
      groups = await prisma.permissionGroup.findMany({
        where: { isArchived: false },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    }
    return groups;
  }, "permissions:list-groups");
}

export async function savePermissionGroup(input: {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  permissions: string[];
  color?: string;
  badge?: string;
  icon?: string;
  hierarchyTier?: string;
  dashboardAccess?: string[];
  sortOrder?: number;
  isArchived?: boolean;
}) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(async () => {
    const data = {
      name: input.name,
      description: input.description,
      permissions: input.permissions as Prisma.InputJsonValue,
      color: input.color,
      badge: input.badge,
      icon: input.icon,
      hierarchyTier: input.hierarchyTier,
      dashboardAccess: (input.dashboardAccess ?? []) as Prisma.InputJsonValue,
      sortOrder: input.sortOrder,
      isArchived: input.isArchived,
    };
    if (input.id) {
      const existing = await prisma.permissionGroup.findUnique({ where: { id: input.id } });
      if (existing?.isSystem) throw new Error("System groups cannot be edited");
      await prisma.permissionGroup.update({
        where: { id: input.id },
        data,
      });
    } else {
      await prisma.permissionGroup.create({
        data: {
          slug: input.slug,
          ...data,
        },
      });
    }
    invalidatePermissionCache();
    revalidatePath("/admin/groups");
  }, "permissions:save-group");
}

export async function duplicatePermissionGroup(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(async () => {
    const group = await prisma.permissionGroup.findUnique({ where: { id } });
    if (!group) throw new Error("Group not found");
    const slug = `${group.slug}-copy-${Date.now().toString(36)}`;
    await prisma.permissionGroup.create({
      data: {
        slug,
        name: `${group.name} (Copy)`,
        description: group.description,
        permissions: group.permissions as Prisma.InputJsonValue,
        color: group.color,
        badge: group.badge,
        icon: group.icon,
        hierarchyTier: group.hierarchyTier,
        dashboardAccess: group.dashboardAccess as Prisma.InputJsonValue,
        sortOrder: group.sortOrder + 1,
      },
    });
    invalidatePermissionCache();
    revalidatePath("/admin/groups");
  }, "permissions:duplicate-group");
}
