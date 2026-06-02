"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { actionTry, fail, ok, requireActionPermission } from "@/lib/action-utils";
import { invalidatePermissionCache } from "@/lib/permission-store";
import type { Prisma } from "@prisma/client";
import { DEFAULT_BRANDING, saveBrandingSettings, saveGameCoverOverride, type BrandingSettings } from "@/lib/branding";
import { uploadAsset } from "@/lib/asset-storage";
import { extensionForMime, validateUploadFile } from "@/lib/upload-validation";
import { getBrandingSettings } from "@/lib/branding";

export async function getAdminBranding() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await getBrandingSettings());
}

export async function saveAdminBranding(settings: BrandingSettings) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return actionTry(async () => {
    await saveBrandingSettings({ ...DEFAULT_BRANDING, ...settings });
    revalidatePath("/");
    revalidatePath("/admin/branding");
  }, "branding:save");
}

export async function uploadBrandingAsset(formData: FormData) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const file = formData.get("file") as File;
  const assetType = formData.get("type") as string;
  const validation = validateUploadFile(file, {
    maxSizeMb: 2,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/x-icon", "image/vnd.microsoft.icon"],
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

    const branding = await getBrandingSettings();
    const fieldMap: Record<string, keyof BrandingSettings> = {
      logo: "logoUrl",
      "logo-dark": "logoDarkUrl",
      favicon: "faviconUrl",
      loading: "loadingLogoUrl",
      mobile: "mobileIconUrl",
      og: "ogImageUrl",
    };
    const field = fieldMap[assetType];
    if (field) {
      await saveBrandingSettings({ ...branding, [field]: result.url });
    }

    revalidatePath("/admin/branding");
    return ok({ url: result.url });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Upload failed");
  }
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
    let groups = await prisma.permissionGroup.findMany({ orderBy: { name: "asc" } });
    if (groups.length === 0) {
      await prisma.permissionGroup.createMany({
        data: [
          { slug: "staff-full", name: "Staff Full Access", permissions: ["*"], isSystem: true },
          { slug: "creator-standard", name: "Creator Standard", permissions: ["mods.read", "assets.read", "analytics.creator", "licenses.write"], isSystem: true },
          { slug: "partner-standard", name: "Partner Standard", permissions: ["analytics.creator", "coupons.write"], isSystem: true },
        ],
      });
      groups = await prisma.permissionGroup.findMany({ orderBy: { name: "asc" } });
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
}) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(async () => {
    if (input.id) {
      const existing = await prisma.permissionGroup.findUnique({ where: { id: input.id } });
      if (existing?.isSystem) throw new Error("System groups cannot be edited");
      await prisma.permissionGroup.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
          permissions: input.permissions as Prisma.InputJsonValue,
        },
      });
    } else {
      await prisma.permissionGroup.create({
        data: {
          slug: input.slug,
          name: input.name,
          description: input.description,
          permissions: input.permissions as Prisma.InputJsonValue,
        },
      });
    }
    invalidatePermissionCache();
    revalidatePath("/admin/groups");
  }, "permissions:save-group");
}
