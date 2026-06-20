import { prisma } from "@/lib/db";
import { buildAssetPublicUrl } from "@/lib/assets";
import { revalidatePath, revalidateTag } from "next/cache";
import { registerMediaFromSession } from "@/lib/media-files";
import { isAdmin, hasPermission } from "@/lib/permissions";
import { CACHE_TAGS } from "@/lib/cache";
import { locales } from "@/i18n/config";
import {
  getBrandingAssetSettings,
  saveBrandingAssetSettings,
  syncIconVariantsFromFavicon,
  type BrandingAssetSettings,
} from "@/lib/branding-cms";
import { invalidateBrandingCache } from "@/lib/branding-data";

export type UploadPurpose =
  | "mod-version"
  | "mod-screenshot"
  | "sound-preview"
  | "sound-cover"
  | "creator-portfolio"
  | "creator-banner"
  | "creator-avatar"
  | "collection-cover"
  | "user-avatar"
  | "partner-avatar"
  | "partner-banner"
  | "partner-logo"
  | "designer-avatar"
  | "designer-banner"
  | "game-asset"
  | "ticket-attachment"
  | "chat-attachment"
  | "branding-asset"
  | "team-avatar"
  | "team-banner";

export async function finalizeUploadSession(sessionId: string, userId: string) {
  const session = await prisma.storageUploadSession.findUnique({
    where: { id: sessionId },
  });
  if (!session || session.userId !== userId) {
    throw new Error("Upload session not found");
  }
  if (session.status !== "IN_PROGRESS") {
    throw new Error("Upload already finalized");
  }

  const publicUrl = buildAssetPublicUrl(session.fileKey);
  const meta = (session.metadata ?? {}) as Record<string, string>;
  let mediaId: string | undefined;

  switch (session.purpose as UploadPurpose) {
    case "mod-screenshot": {
      if (!session.modId) break;
      const mediaFile = await registerMediaFromSession(
        session,
        "MOD_SCREENSHOT",
        userId,
        session.modId
      );
      const orderIndex = await prisma.modMedia.count({ where: { modId: session.modId } });
      const hasFeatured = await prisma.modMedia.count({
        where: { modId: session.modId, isFeatured: true },
      });
      const media = await prisma.modMedia.create({
        data: {
          modId: session.modId,
          mediaType: "IMAGE",
          imageUrl: mediaFile.publicUrl,
          orderIndex,
          isFeatured: hasFeatured === 0,
        },
      });
      mediaId = media.id;
      const mod = await prisma.mod.findUnique({ where: { id: session.modId }, select: { slug: true } });
      if (mod) {
        revalidateTag(CACHE_TAGS.mod(mod.slug));
        revalidateTag(CACHE_TAGS.mods);
        for (const locale of locales) {
          revalidatePath(`/${locale}/mods/${mod.slug}`);
        }
      }
      break;
    }
    case "collection-cover": {
      const collectionId = meta.collectionId;
      if (collectionId) {
        const [collection, actor] = await Promise.all([
          prisma.modCollection.findUnique({
            where: { id: collectionId },
            select: { ownerId: true },
          }),
          prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
        ]);
        if (!collection || !actor) {
          throw new Error("Collection not found");
        }
        if (collection.ownerId !== userId && !isAdmin(actor.role)) {
          throw new Error("Permission denied for this collection");
        }
        await prisma.modCollection.update({
          where: { id: collectionId },
          data: { coverUrl: publicUrl },
        });
      }
      break;
    }
    case "user-avatar":
    case "creator-avatar":
    case "partner-avatar": {
      const mediaFile = await registerMediaFromSession(session, "USER_AVATAR", userId, userId);
      await prisma.user.update({
        where: { id: userId },
        data: {
          avatarUrl: mediaFile.publicUrl,
          avatar256Url: mediaFile.publicUrl,
          avatar128Url: mediaFile.publicUrl,
          avatar64Url: mediaFile.publicUrl,
          avatarOriginalUrl: mediaFile.publicUrl,
        },
      });
      revalidatePath("/", "layout");
      break;
    }
    case "creator-banner": {
      const profile = await prisma.creatorProfile.findUnique({ where: { userId } });
      if (profile) {
        await prisma.creatorProfile.update({ where: { id: profile.id }, data: { bannerUrl: publicUrl } });
      }
      break;
    }
    case "partner-banner": {
      const profile = await prisma.partnerProfile.findUnique({ where: { userId } });
      if (profile) {
        await prisma.partnerProfile.update({ where: { id: profile.id }, data: { bannerUrl: publicUrl } });
      }
      break;
    }
    case "partner-logo": {
      const profile = await prisma.partnerProfile.findUnique({ where: { userId } });
      if (profile) {
        await prisma.partnerProfile.update({ where: { id: profile.id }, data: { logoUrl: publicUrl } });
      }
      break;
    }
    case "designer-avatar":
    case "designer-banner": {
      const profile = await prisma.designerProfile.findUnique({ where: { userId } });
      if (profile) {
        if (session.purpose === "designer-banner") {
          await prisma.designerProfile.update({ where: { id: profile.id }, data: { bannerUrl: publicUrl } });
        } else {
          const mediaFile = await registerMediaFromSession(session, "USER_AVATAR", userId, userId);
          await prisma.designerProfile.update({ where: { id: profile.id }, data: { avatarUrl: mediaFile.publicUrl } });
          await prisma.user.update({ where: { id: userId }, data: { avatarUrl: mediaFile.publicUrl } });
        }
      } else if (session.purpose === "designer-avatar") {
        const mediaFile = await registerMediaFromSession(session, "USER_AVATAR", userId, userId);
        await prisma.user.update({ where: { id: userId }, data: { avatarUrl: mediaFile.publicUrl } });
      }
      break;
    }
    case "game-asset": {
      const gameId = meta.gameId;
      const assetType = meta.assetType as "icon" | "banner" | "cover" | undefined;
      if (gameId && assetType) {
        const field = assetType === "icon" ? "iconUrl" : assetType === "banner" ? "bannerUrl" : "coverUrl";
        const game = await prisma.game.update({ where: { id: gameId }, data: { [field]: publicUrl } });
        revalidatePath(`/games/${game.slug}`);
        revalidatePath("/admin/games");
      }
      break;
    }
    case "branding-asset": {
      const assetType = meta.assetType;
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
      const field = assetType ? fieldMap[assetType] : undefined;
      if (field === "favicon-bundle") {
        branding = syncIconVariantsFromFavicon(branding, publicUrl);
      } else if (field && field !== "url-only") {
        branding = { ...branding, [field]: publicUrl };
      }
      if (field !== "url-only") {
        await saveBrandingAssetSettings(branding);
      }
      invalidateBrandingCache();
      revalidatePath("/", "layout");
      break;
    }
    case "team-avatar":
    case "team-banner": {
      const teamMemberId = meta.teamMemberId;
      if (teamMemberId) {
        const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
        if (!actor || (!isAdmin(actor.role) && !hasPermission(actor.role, "users.write"))) {
          throw new Error("Permission denied for team media upload");
        }
        const field = session.purpose === "team-banner" ? "bannerUrl" : "avatarUrl";
        await prisma.teamMember.update({
          where: { id: teamMemberId },
          data: { [field]: publicUrl },
        });
        revalidatePath("/admin/team");
        revalidatePath("/team");
      }
      break;
    }
    case "creator-portfolio":
    case "creator-banner":
    case "creator-avatar":
    case "ticket-attachment":
    case "chat-attachment":
    default:
      break;
  }

  await prisma.storageUploadSession.update({
    where: { id: sessionId },
    data: { status: "COMPLETED" },
  });

  return {
    url: publicUrl,
    key: session.fileKey,
    purpose: session.purpose,
    mediaId,
  };
}
