import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { uploadAsset, type AssetBucket } from "@/lib/asset-storage";
import { persistUserAvatarFromBuffer, verifyAvatarStorage } from "@/lib/avatar-persist";
import { bustAvatarUrl } from "@/lib/avatar-url";
import { extensionForMime, validateUploadFile } from "@/lib/upload-validation";
import { getMediaSettings } from "@/lib/media-settings";

const uploadSchema = z.object({
  purpose: z.enum([
    "mod-screenshot",
    "creator-avatar",
    "creator-banner",
    "user-avatar",
    "partner-avatar",
    "partner-banner",
    "partner-logo",
    "designer-avatar",
    "designer-banner",
    "game-asset",
    "ticket-attachment",
  ]),
  modId: z.string().optional(),
  gameId: z.string().optional(),
  assetType: z.enum(["icon", "banner", "cover", "logo", "background"]).optional(),
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

async function canEditMod(userId: string, role: string, authorId: string) {
  if (authorId === userId) return true;
  return hasPermission(role as never, "mods.write") || hasPermission(role as never, "mods.moderate");
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!checkRateLimit(user.id)) {
      return NextResponse.json({ error: "Upload rate limit exceeded. Try again shortly." }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const parsed = uploadSchema.safeParse({
      purpose: formData.get("purpose"),
      modId: formData.get("modId") || undefined,
      gameId: formData.get("gameId") || undefined,
      assetType: formData.get("assetType") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const { purpose, modId, gameId, assetType } = parsed.data;
    const settings = await getMediaSettings();

    let bucket: AssetBucket = "mod-images";
    let relativePath = "";
    let maxSizeMb = settings.maxFileSizeMb;
    let allowedTypes = settings.allowedTypes;

    switch (purpose) {
      case "mod-screenshot": {
        if (!modId) return NextResponse.json({ error: "modId required" }, { status: 400 });
        const mod = await prisma.mod.findUnique({ where: { id: modId } });
        if (!mod) return NextResponse.json({ error: "Mod not found" }, { status: 404 });
        if (!(await canEditMod(user.id, user.role, mod.authorId))) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const count = await prisma.modMedia.count({ where: { modId, mediaType: "IMAGE" } });
        if (count >= settings.maxScreenshots) {
          return NextResponse.json({ error: `Maximum ${settings.maxScreenshots} screenshots` }, { status: 400 });
        }
        bucket = "mod-images";
        const ext = extensionForMime(file.type);
        relativePath = `${mod.slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        break;
      }
      case "creator-banner": {
        bucket = "creator-banners";
        maxSizeMb = 5;
        relativePath = `${user.id}/${Date.now()}.${extensionForMime(file.type)}`;
        break;
      }
      case "partner-avatar":
      case "designer-avatar":
      case "user-avatar":
      case "creator-avatar": {
        bucket = "creator-avatars";
        maxSizeMb = 20;
        allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/avif",
          "image/svg+xml",
        ];
        relativePath = `${user.id}/${Date.now()}.${extensionForMime(file.type)}`;
        break;
      }
      case "partner-banner":
      case "designer-banner": {
        bucket = "creator-banners";
        maxSizeMb = 5;
        relativePath = `${user.id}/${Date.now()}.${extensionForMime(file.type)}`;
        break;
      }
      case "partner-logo": {
        bucket = "creator-avatars";
        maxSizeMb = 2;
        relativePath = `${user.id}/logo-${Date.now()}.${extensionForMime(file.type)}`;
        break;
      }
      case "game-asset": {
        if (!hasPermission(user.role, "games.write")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!gameId || !assetType) {
          return NextResponse.json({ error: "gameId and assetType required" }, { status: 400 });
        }
        bucket = "games";
        relativePath = `${gameId}/${assetType}-${Date.now()}.${extensionForMime(file.type)}`;
        maxSizeMb = 5;
        break;
      }
      case "ticket-attachment": {
        bucket = "tickets";
        maxSizeMb = 10;
        allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
          "application/zip",
          "application/x-zip-compressed",
        ];
        relativePath = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        break;
      }
    }

    const validation = validateUploadFile(file, {
      allowedTypes,
      maxSizeMb,
      label: "Upload",
    });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (
      purpose === "user-avatar" ||
      purpose === "creator-avatar" ||
      purpose === "partner-avatar" ||
      purpose === "designer-avatar"
    ) {
      const avatarResult = await persistUserAvatarFromBuffer(user.id, buffer, validation.mime);
      const verify = await verifyAvatarStorage(user.id);
      if (!verify.ok) {
        return NextResponse.json({ error: verify.detail }, { status: 502 });
      }
      return NextResponse.json({
        url: bustAvatarUrl(avatarResult.displayUrl) ?? avatarResult.displayUrl,
        provider: "r2",
      });
    }

    const uploaded = await uploadAsset({
      bucket,
      relativePath,
      body: buffer,
      contentType: validation.mime,
    });

    if (purpose === "mod-screenshot" && modId) {
      const orderIndex = await prisma.modMedia.count({ where: { modId } });
      const hasFeatured = await prisma.modMedia.count({ where: { modId, isFeatured: true } });
      const media = await prisma.modMedia.create({
        data: {
          modId,
          mediaType: "IMAGE",
          imageUrl: uploaded.url,
          orderIndex,
          isFeatured: hasFeatured === 0,
        },
      });
      return NextResponse.json({
        url: uploaded.url,
        key: uploaded.key,
        mediaId: media.id,
        provider: uploaded.provider,
      });
    }

    if (purpose === "creator-banner") {
      const profile = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
      if (!profile) {
        return NextResponse.json({ error: "Creator profile required" }, { status: 400 });
      }
      await prisma.creatorProfile.update({
        where: { id: profile.id },
        data: { bannerUrl: uploaded.url },
      });
    }

    if (purpose === "partner-banner") {
      const profile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
      if (!profile) return NextResponse.json({ error: "Partner profile required" }, { status: 400 });
      await prisma.partnerProfile.update({ where: { id: profile.id }, data: { bannerUrl: uploaded.url } });
    }

    if (purpose === "partner-logo") {
      const profile = await prisma.partnerProfile.findUnique({ where: { userId: user.id } });
      if (!profile) return NextResponse.json({ error: "Partner profile required" }, { status: 400 });
      await prisma.partnerProfile.update({ where: { id: profile.id }, data: { logoUrl: uploaded.url } });
    }

    if (purpose === "designer-banner") {
      const profile = await prisma.designerProfile.findUnique({ where: { userId: user.id } });
      if (!profile) return NextResponse.json({ error: "Designer profile required" }, { status: 400 });
      await prisma.designerProfile.update({ where: { id: profile.id }, data: { bannerUrl: uploaded.url } });
    }

    if (purpose === "game-asset" && gameId && assetType) {
      const field =
        assetType === "icon"
          ? "iconUrl"
          : assetType === "banner"
            ? "bannerUrl"
            : assetType === "logo"
              ? "logoUrl"
              : assetType === "background"
                ? "backgroundUrl"
                : "coverUrl";
      await prisma.game.update({ where: { id: gameId }, data: { [field]: uploaded.url } });
    }

    return NextResponse.json({
      url: uploaded.url,
      key: uploaded.key,
      provider: uploaded.provider,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[upload]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
