import type { MediaEntityType } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  extractStoragePathFromUrl,
  isLikelyStorageKey,
  normalizeStoragePath,
  registerMediaFile,
  resolveMediaPublicUrl,
} from "@/lib/media-files";
import { buildAssetPublicUrl } from "@/lib/assets";

export type MediaRepairResult = {
  scanned: number;
  repaired: number;
  missing: number;
  errors: string[];
  details: { type: string; id: string; action: string }[];
};

async function upsertMediaRecord(
  storagePath: string,
  publicUrl: string,
  entityType: MediaEntityType,
  entityId: string,
  uploadedById: string,
  originalName: string,
  mimeType: string
) {
  await registerMediaFile({
    storagePath,
    originalName,
    mimeType,
    fileSize: 0,
    entityType,
    entityId,
    uploadedById,
  }).catch(() => undefined);

  await prisma.mediaFile.updateMany({
    where: { storagePath },
    data: { publicUrl },
  });
}

function repairStoredUrl(stored: string): { storagePath: string; publicUrl: string } | null {
  if (!stored?.trim()) return null;
  const trimmed = stored.trim();

  if (isLikelyStorageKey(trimmed)) {
    const storagePath = normalizeStoragePath(trimmed);
    return { storagePath, publicUrl: buildAssetPublicUrl(storagePath) };
  }

  const extracted = extractStoragePathFromUrl(trimmed);
  if (extracted) {
    const storagePath = normalizeStoragePath(extracted);
    const publicUrl = resolveMediaPublicUrl(trimmed) ?? buildAssetPublicUrl(storagePath);
    return { storagePath, publicUrl };
  }

  return null;
}

export async function repairModMediaUrls(): Promise<MediaRepairResult> {
  const result: MediaRepairResult = { scanned: 0, repaired: 0, missing: 0, errors: [], details: [] };
  const items = await prisma.modMedia.findMany({
    where: { mediaType: "IMAGE", imageUrl: { not: null } },
    include: { mod: { select: { id: true, authorId: true } } },
  });

  for (const item of items) {
    if (!item.imageUrl) continue;
    result.scanned++;
    const fixed = repairStoredUrl(item.imageUrl);
    if (!fixed) {
      result.missing++;
      continue;
    }
    if (item.imageUrl !== fixed.publicUrl) {
      await prisma.modMedia.update({ where: { id: item.id }, data: { imageUrl: fixed.publicUrl } });
      await upsertMediaRecord(
        fixed.storagePath,
        fixed.publicUrl,
        "MOD_SCREENSHOT",
        item.modId,
        item.mod.authorId,
        fixed.storagePath.split("/").pop() ?? "screenshot",
        "image/jpeg"
      );
      result.repaired++;
      result.details.push({ type: "mod_media", id: item.id, action: "url_rebuilt" });
    }
  }

  const legacy = await prisma.modScreenshot.findMany({ include: { mod: { select: { authorId: true } } } });
  for (const shot of legacy) {
    result.scanned++;
    const fixed = repairStoredUrl(shot.url);
    if (!fixed) {
      result.missing++;
      continue;
    }
    if (shot.url !== fixed.publicUrl) {
      await prisma.modScreenshot.update({ where: { id: shot.id }, data: { url: fixed.publicUrl } });
      result.repaired++;
      result.details.push({ type: "mod_screenshot", id: shot.id, action: "url_rebuilt" });
    }
    const existing = await prisma.modMedia.count({ where: { modId: shot.modId, imageUrl: fixed.publicUrl } });
    if (existing === 0) {
      await prisma.modMedia.create({
        data: {
          modId: shot.modId,
          mediaType: "IMAGE",
          imageUrl: fixed.publicUrl,
          orderIndex: shot.sortOrder,
          isFeatured: shot.sortOrder === 0,
        },
      });
      result.repaired++;
      result.details.push({ type: "mod_screenshot", id: shot.id, action: "synced_to_mod_media" });
    }
  }

  return result;
}

export async function repairUserAvatars(): Promise<MediaRepairResult> {
  const result: MediaRepairResult = { scanned: 0, repaired: 0, missing: 0, errors: [], details: [] };
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { avatarUrl: { not: null } },
        { avatarOriginalUrl: { not: null } },
        { avatar256Url: { not: null } },
      ],
    },
    select: {
      id: true,
      avatarUrl: true,
      avatarOriginalUrl: true,
      avatar256Url: true,
      avatar128Url: true,
      avatar64Url: true,
    },
  });

  for (const user of users) {
    const source =
      user.avatarUrl ?? user.avatar256Url ?? user.avatar128Url ?? user.avatarOriginalUrl;
    if (!source) continue;
    result.scanned++;
    const fixed = repairStoredUrl(source);
    if (!fixed) {
      result.missing++;
      continue;
    }
    const needsUpdate =
      user.avatarUrl !== fixed.publicUrl ||
      user.avatar256Url !== fixed.publicUrl ||
      user.avatar128Url !== fixed.publicUrl ||
      user.avatar64Url !== fixed.publicUrl ||
      user.avatarOriginalUrl !== fixed.publicUrl;

    if (needsUpdate) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          avatarUrl: fixed.publicUrl,
          avatar256Url: fixed.publicUrl,
          avatar128Url: fixed.publicUrl,
          avatar64Url: fixed.publicUrl,
          avatarOriginalUrl: fixed.publicUrl,
        },
      });
      await upsertMediaRecord(
        fixed.storagePath,
        fixed.publicUrl,
        "USER_AVATAR",
        user.id,
        user.id,
        "avatar",
        "image/jpeg"
      );
      result.repaired++;
      result.details.push({ type: "user_avatar", id: user.id, action: "url_rebuilt" });
    }
  }

  return result;
}

export async function repairCreatorProfiles(): Promise<MediaRepairResult> {
  const result: MediaRepairResult = { scanned: 0, repaired: 0, missing: 0, errors: [], details: [] };
  const profiles = await prisma.creatorProfile.findMany({
    where: { bannerUrl: { not: null } },
    select: { id: true, userId: true, bannerUrl: true },
  });

  for (const profile of profiles) {
    if (!profile.bannerUrl) continue;
    result.scanned++;
    const fixed = repairStoredUrl(profile.bannerUrl);
    if (!fixed) {
      result.missing++;
      continue;
    }
    if (profile.bannerUrl !== fixed.publicUrl) {
      await prisma.creatorProfile.update({
        where: { id: profile.id },
        data: { bannerUrl: fixed.publicUrl },
      });
      result.repaired++;
      result.details.push({ type: "creator_banner", id: profile.id, action: "url_rebuilt" });
    }
  }

  return result;
}

export async function repairPartnerProfiles(): Promise<MediaRepairResult> {
  const result: MediaRepairResult = { scanned: 0, repaired: 0, missing: 0, errors: [], details: [] };
  const profiles = await prisma.partnerProfile.findMany({
    select: { id: true, userId: true, bannerUrl: true, logoUrl: true },
  });

  for (const profile of profiles) {
    for (const [field, value] of [
      ["bannerUrl", profile.bannerUrl],
      ["logoUrl", profile.logoUrl],
    ] as const) {
      if (!value) continue;
      result.scanned++;
      const fixed = repairStoredUrl(value);
      if (!fixed) {
        result.missing++;
        continue;
      }
      if (value !== fixed.publicUrl) {
        await prisma.partnerProfile.update({
          where: { id: profile.id },
          data: { [field]: fixed.publicUrl },
        });
        result.repaired++;
        result.details.push({ type: `partner_${field}`, id: profile.id, action: "url_rebuilt" });
      }
    }
  }

  return result;
}

export async function repairTeamMembers(): Promise<MediaRepairResult> {
  const result: MediaRepairResult = { scanned: 0, repaired: 0, missing: 0, errors: [], details: [] };
  const members = await prisma.teamMember.findMany({
    select: { id: true, avatarUrl: true, bannerUrl: true },
  });

  for (const member of members) {
    for (const [field, value] of [
      ["avatarUrl", member.avatarUrl],
      ["bannerUrl", member.bannerUrl],
    ] as const) {
      if (!value) continue;
      result.scanned++;
      const fixed = repairStoredUrl(value);
      if (!fixed) {
        result.missing++;
        continue;
      }
      if (value !== fixed.publicUrl) {
        await prisma.teamMember.update({
          where: { id: member.id },
          data: { [field]: fixed.publicUrl },
        });
        result.repaired++;
        result.details.push({ type: `team_${field}`, id: member.id, action: "url_rebuilt" });
      }
    }
  }

  return result;
}

export async function repairDesignerProfiles(): Promise<MediaRepairResult> {
  const result: MediaRepairResult = { scanned: 0, repaired: 0, missing: 0, errors: [], details: [] };
  const profiles = await prisma.designerProfile.findMany({
    select: { id: true, avatarUrl: true, bannerUrl: true },
  });

  for (const profile of profiles) {
    for (const [field, value] of [
      ["avatarUrl", profile.avatarUrl],
      ["bannerUrl", profile.bannerUrl],
    ] as const) {
      if (!value) continue;
      result.scanned++;
      const fixed = repairStoredUrl(value);
      if (!fixed) {
        result.missing++;
        continue;
      }
      if (value !== fixed.publicUrl) {
        await prisma.designerProfile.update({
          where: { id: profile.id },
          data: { [field]: fixed.publicUrl },
        });
        result.repaired++;
        result.details.push({ type: `designer_${field}`, id: profile.id, action: "url_rebuilt" });
      }
    }
  }

  return result;
}

export async function repairGameMedia(): Promise<MediaRepairResult> {
  const result: MediaRepairResult = { scanned: 0, repaired: 0, missing: 0, errors: [], details: [] };
  const games = await prisma.game.findMany({
    select: { id: true, iconUrl: true, bannerUrl: true, coverUrl: true },
  });

  for (const game of games) {
    for (const [field, value] of [
      ["iconUrl", game.iconUrl],
      ["bannerUrl", game.bannerUrl],
      ["coverUrl", game.coverUrl],
    ] as const) {
      if (!value) continue;
      result.scanned++;
      const fixed = repairStoredUrl(value);
      if (!fixed) {
        result.missing++;
        continue;
      }
      if (value !== fixed.publicUrl) {
        await prisma.game.update({
          where: { id: game.id },
          data: { [field]: fixed.publicUrl },
        });
        result.repaired++;
        result.details.push({ type: `game_${field}`, id: game.id, action: "url_rebuilt" });
      }
    }
  }

  return result;
}

export async function repairSoundPreviews(): Promise<MediaRepairResult> {
  const result: MediaRepairResult = { scanned: 0, repaired: 0, missing: 0, errors: [], details: [] };
  const profiles = await prisma.soundProfile.findMany({
    include: { mod: { select: { id: true, authorId: true } } },
  });

  for (const profile of profiles) {
    if (profile.coverImageKey) {
      result.scanned++;
      const fixed = repairStoredUrl(profile.coverImageKey);
      if (!fixed) {
        result.missing++;
      } else if (profile.coverImageKey !== fixed.publicUrl) {
        await prisma.soundProfile.update({
          where: { id: profile.id },
          data: { coverImageKey: fixed.publicUrl },
        });
        await upsertMediaRecord(
          fixed.storagePath,
          fixed.publicUrl,
          "SOUND_COVER",
          profile.modId,
          profile.mod.authorId,
          profile.coverImageKey.split("/").pop() ?? "cover",
          "image/jpeg"
        );
        result.repaired++;
        result.details.push({ type: "sound_cover", id: profile.modId, action: "url_rebuilt" });
      }
    }

    if (profile.previewFileKey) {
      result.scanned++;
      const key = normalizeStoragePath(profile.previewFileKey);
      const existing = await prisma.mediaFile.findUnique({ where: { storagePath: key } });
      if (!existing) {
        await registerMediaFile({
          storagePath: key,
          originalName: profile.previewFileName ?? "preview",
          mimeType: "audio/mpeg",
          fileSize: profile.previewFileSize ?? 0,
          entityType: "SOUND_PREVIEW",
          entityId: profile.modId,
          uploadedById: profile.mod.authorId,
        }).catch((err) => {
          result.errors.push(String(err));
        });
        result.repaired++;
        result.details.push({ type: "sound_preview", id: profile.modId, action: "media_record_created" });
      }
    }
  }

  return result;
}

export async function runFullMediaRepair() {
  const [modMedia, avatars, sounds, creators, partners, team, designers, games] = await Promise.all([
    repairModMediaUrls(),
    repairUserAvatars(),
    repairSoundPreviews(),
    repairCreatorProfiles(),
    repairPartnerProfiles(),
    repairTeamMembers(),
    repairDesignerProfiles(),
    repairGameMedia(),
  ]);

  return {
    modMedia,
    avatars,
    sounds,
    creators,
    partners,
    team,
    designers,
    games,
    totalScanned:
      modMedia.scanned +
      avatars.scanned +
      sounds.scanned +
      creators.scanned +
      partners.scanned +
      team.scanned +
      designers.scanned +
      games.scanned,
    totalRepaired:
      modMedia.repaired +
      avatars.repaired +
      sounds.repaired +
      creators.repaired +
      partners.repaired +
      team.repaired +
      designers.repaired +
      games.repaired,
    totalMissing:
      modMedia.missing +
      avatars.missing +
      sounds.missing +
      creators.missing +
      partners.missing +
      team.missing +
      designers.missing +
      games.missing,
    errors: [
      ...modMedia.errors,
      ...avatars.errors,
      ...sounds.errors,
      ...creators.errors,
      ...partners.errors,
      ...team.errors,
      ...designers.errors,
      ...games.errors,
    ],
  };
}

export async function scanMissingMediaFiles() {
  const missing: { type: string; id: string; value: string }[] = [];

  const modMedia = await prisma.modMedia.findMany({
    where: { mediaType: "IMAGE", OR: [{ imageUrl: null }, { imageUrl: "" }] },
    select: { id: true, imageUrl: true },
  });
  for (const m of modMedia) {
    missing.push({ type: "mod_media", id: m.id, value: m.imageUrl ?? "" });
  }

  const users = await prisma.user.findMany({
    where: { avatarUrl: { not: null } },
    select: { id: true, avatarUrl: true },
  });
  for (const u of users) {
    if (u.avatarUrl && !resolveMediaPublicUrl(u.avatarUrl)) {
      missing.push({ type: "user_avatar", id: u.id, value: u.avatarUrl });
    }
  }

  return { count: missing.length, items: missing.slice(0, 100) };
}
