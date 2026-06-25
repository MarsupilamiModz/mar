"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionOwner, requireActionUser } from "@/lib/action-utils";
import { hasPermission } from "@/lib/permissions";
import { getSignedDownloadUrl } from "@/lib/r2";
import { resolveAssetUrl } from "@/lib/assets";
import { registerMediaFromSession } from "@/lib/media-files";
import { getPreviewLimitSeconds, isAudioFileName, MAX_PREVIEW_BYTES } from "@/lib/sound";
import { fileSizeNumber } from "@/lib/file-size";
import { probeAudioFromStorage } from "@/lib/audio-probe";
import { mimeFromFileName } from "@/lib/sound-storage";
import { pickPrismaModelFields } from "@/lib/prisma-schema";
import { z } from "zod";

function resolveDurationSeconds(
  clientDuration?: number,
  serverDuration?: number | null
): number | undefined {
  if (clientDuration != null && clientDuration > 0) return clientDuration;
  if (serverDuration != null && serverDuration > 0) return serverDuration;
  return undefined;
}

const soundProfileSchema = z.object({
  artist: z.string().max(120).optional(),
  audioCategory: z.enum([
    "ENGINE_SOUNDS",
    "WEAPON_SOUNDS",
    "SIRENS",
    "UI_SOUNDS",
    "AMBIENT_SOUNDS",
    "RADIO_PACKS",
    "VOICE_PACKS",
    "EFFECTS",
    "MUSIC_PACKS",
    "CUSTOM_AUDIO",
  ]),
  durationSeconds: z.number().int().min(0).max(86400).optional(),
  bpm: z.number().int().min(0).max(999).optional(),
  genre: z.string().max(80).optional(),
  previewType: z.enum(["FULL", "SECONDS_30", "SECONDS_60", "CUSTOM"]),
  previewCustomSeconds: z.number().int().min(5).max(600).optional(),
  waveformPeaks: z.array(z.number()).max(500).optional(),
});

async function canEditMod(userId: string, role: string, authorId: string) {
  if (authorId === userId) return true;
  return hasPermission(role as never, "mods.write") || hasPermission(role as never, "mods.moderate");
}

export async function updateSoundProfile(
  modId: string,
  input: z.infer<typeof soundProfileSchema>
) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({
    where: { id: modId },
    include: { soundProfile: true },
  });
  if (!mod) return fail("Product not found");
  if (mod.productType !== "SOUND") return fail("Not a sound product");
  if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

  const parsed = soundProfileSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  await prisma.soundProfile.upsert({
    where: { modId },
    create: {
      modId,
      ...parsed.data,
      waveformPeaks: parsed.data.waveformPeaks as Prisma.InputJsonValue,
    },
    update: {
      ...parsed.data,
      waveformPeaks: parsed.data.waveformPeaks as Prisma.InputJsonValue,
    },
  });

  revalidatePath(`/mods/${mod.slug}`);
  revalidatePath(`/creator/mods/${modId}`);
  return ok(undefined);
}

export async function attachSoundPreviewFromSession(
  modId: string,
  sessionId: string,
  meta?: {
    durationSeconds?: number;
    waveformPeaks?: number[];
  }
) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const session = await prisma.storageUploadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id || session.purpose !== "sound-preview") {
    return fail("Invalid preview upload session");
  }
  if (session.status !== "COMPLETED") return fail("Upload not completed");
  if (!session.modId || session.modId !== modId) return fail("Mod mismatch");

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return fail("Product not found");
  if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");
  if (!isAudioFileName(session.fileName)) return fail("Invalid audio format");
  if (fileSizeNumber(session.fileSize) > MAX_PREVIEW_BYTES) return fail("Preview file too large");

  const sessionMeta = (session.metadata ?? {}) as Record<string, string>;
  const soundFileId = sessionMeta.soundFileId ?? null;
  const fileSize = fileSizeNumber(session.fileSize);
  const mimeType = session.contentType || mimeFromFileName(session.fileName);

  const audioMeta = await probeAudioFromStorage(
    session.fileKey,
    session.fileName,
    mimeType,
    fileSize
  );

  const durationSeconds = resolveDurationSeconds(
    meta?.durationSeconds,
    audioMeta.durationSeconds
  );

  await registerMediaFromSession(session, "SOUND_PREVIEW", user.id, modId);

  const soundExtras = pickPrismaModelFields("SoundProfile", {
    previewFileId: soundFileId,
    previewMimeType: audioMeta.mimeType || mimeType,
    previewBitrateKbps: audioMeta.bitrateKbps ?? undefined,
    uploadedById: user.id,
  });

  const createData = pickPrismaModelFields("SoundProfile", {
    modId,
    previewFileKey: session.fileKey,
    previewFileName: session.fileName,
    previewFileSize: session.fileSize,
    previewDurationSeconds: durationSeconds,
    durationSeconds: durationSeconds,
    previewScanStatus: "PENDING",
    waveformPeaks: meta?.waveformPeaks as Prisma.InputJsonValue,
    ...soundExtras,
  });

  const updateData = pickPrismaModelFields("SoundProfile", {
    previewFileKey: session.fileKey,
    previewFileName: session.fileName,
    previewFileSize: session.fileSize,
    previewDurationSeconds: durationSeconds,
    durationSeconds: durationSeconds ?? undefined,
    previewScanStatus: "PENDING",
    waveformPeaks: meta?.waveformPeaks as Prisma.InputJsonValue,
    ...soundExtras,
  });

  await prisma.soundProfile.upsert({
    where: { modId },
    create: createData as Prisma.SoundProfileUncheckedCreateInput,
    update: updateData as Prisma.SoundProfileUncheckedUpdateInput,
  });

  revalidatePath(`/mods/${mod.slug}`);
  return ok(undefined);
}

export async function attachSoundCoverFromSession(modId: string, sessionId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const session = await prisma.storageUploadSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== user.id || session.purpose !== "sound-cover") {
    return fail("Invalid cover upload session");
  }
  if (session.status !== "COMPLETED") return fail("Upload not completed");
  if (!session.modId || session.modId !== modId) return fail("Mod mismatch");

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod || !(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

  const mediaFile = await registerMediaFromSession(session, "SOUND_COVER", user.id, modId);
  const coverPublicUrl = mediaFile.publicUrl;

  await prisma.soundProfile.upsert({
    where: { modId },
    create: { modId, coverImageKey: coverPublicUrl },
    update: { coverImageKey: coverPublicUrl },
  });

  revalidatePath(`/mods/${mod.slug}`);
  return ok({ coverUrl: coverPublicUrl });
}

export async function getSoundStreamInfo(modId: string) {
  const mod = await prisma.mod.findUnique({
    where: { id: modId },
    include: { soundProfile: true },
  });
  if (!mod || mod.productType !== "SOUND" || !mod.soundProfile?.previewFileKey) {
    return fail("Sound preview not available");
  }

  if (mod.status !== "PUBLISHED") {
    return fail("Sound is not published");
  }

  const approvedStatuses = ["MANUALLY_APPROVED", "VIRUS_TOTAL_VERIFIED"];
  if (!approvedStatuses.includes(mod.soundProfile.approvalStatus)) {
    return fail("Sound pending security approval");
  }

  const { ensureSoundProfileMetadata } = await import("@/lib/audio-probe");
  await ensureSoundProfileMetadata(modId);
  const profile =
    (await prisma.soundProfile.findUnique({ where: { modId } })) ?? mod.soundProfile;

  const durationSeconds =
    profile.previewDurationSeconds ??
    profile.durationSeconds ??
    null;

  const limit = getPreviewLimitSeconds(
    profile.previewType,
    profile.previewCustomSeconds,
    durationSeconds
  );

  if (!profile.previewFileKey) {
    return fail("Sound preview file missing");
  }

  const previewFileKey = profile.previewFileKey;
  const url = await getSignedDownloadUrl(previewFileKey, 600);
  const previewFileName = previewFileKey.split("/").pop() ?? "preview.mp3";

  return ok({
    modId: mod.id,
    slug: mod.slug,
    title: mod.title,
    artist: profile.artist,
    coverUrl: profile.coverImageKey ? resolveAssetUrl(profile.coverImageKey) : null,
    streamUrl: url,
    playbackUrl: `/api/sounds/${modId}/audio`,
    contentType: mimeFromFileName(previewFileName),
    previewFileName,
    durationSeconds,
    previewLimitSeconds: limit,
    waveformPeaks: (profile.waveformPeaks as number[] | null) ?? null,
    approvalStatus: profile.approvalStatus,
  });
}

export async function recordSoundPlay(modId: string, ipHash?: string) {
  try {
    const auth = await requireActionUser();
    const userId = auth.user?.id;
    await prisma.$transaction([
      prisma.soundPlay.create({
        data: { modId, userId, ipHash },
      }),
      prisma.soundProfile.updateMany({
        where: { modId },
        data: { playCount: { increment: 1 } },
      }),
    ]);
  } catch {
    await prisma.$transaction([
      prisma.soundPlay.create({ data: { modId, ipHash } }),
      prisma.soundProfile.updateMany({
        where: { modId },
        data: { playCount: { increment: 1 } },
      }),
    ]);
  }
  return ok(undefined);
}

export async function getOwnerSoundAnalytics() {
  const { error } = await requireActionOwner();
  if (error) return error;

  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const [topPlayed, playAgg, playsLast7Days, topDownloads, pendingReview, invalidAudio] = await Promise.all([
    prisma.mod.findMany({
      where: { productType: "SOUND", status: "PUBLISHED", soundProfile: { isNot: null } },
      orderBy: { soundProfile: { playCount: "desc" } },
      take: 10,
      select: {
        id: true,
        title: true,
        slug: true,
        downloadCount: true,
        author: { select: { username: true, displayName: true } },
        soundProfile: { select: { playCount: true, durationSeconds: true, previewDurationSeconds: true } },
      },
    }),
    prisma.soundProfile.aggregate({ _sum: { playCount: true }, _count: { id: true } }),
    prisma.soundPlay.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.mod.findMany({
      where: { productType: "SOUND", status: "PUBLISHED" },
      orderBy: { downloadCount: "desc" },
      take: 5,
      select: { title: true, slug: true, downloadCount: true },
    }),
    prisma.soundProfile.count({
      where: { approvalStatus: { in: ["PENDING_REVIEW", "REVIEW_REQUIRED"] } },
    }),
    prisma.soundProfile.count({
      where: {
        OR: [
          { AND: [{ durationSeconds: null }, { previewDurationSeconds: null }] },
          { previewScanStatus: "FAILED" },
        ],
      },
    }),
  ]);

  const totalPlays = playAgg._sum.playCount ?? 0;
  const soundCount = playAgg._count.id;

  return ok({
    totalPlays,
    soundCount,
    playsLast7Days,
    avgPlaysPerSound: soundCount > 0 ? Math.round(totalPlays / soundCount) : 0,
    pendingReview,
    invalidAudio,
    topPlayed: topPlayed.map((m) => ({
      id: m.id,
      title: m.title,
      slug: m.slug,
      plays: m.soundProfile?.playCount ?? 0,
      downloads: m.downloadCount,
      author: m.author.displayName ?? m.author.username,
      durationSeconds: m.soundProfile?.previewDurationSeconds ?? m.soundProfile?.durationSeconds ?? null,
    })),
    topDownloads,
  });
}

export async function getCreatorSoundAnalytics(userId: string) {
  const sounds = await prisma.mod.findMany({
    where: { authorId: userId, productType: "SOUND" },
    include: {
      soundProfile: { select: { playCount: true, audioCategory: true } },
      _count: { select: { downloads: true, favorites: true } },
    },
    orderBy: { downloadCount: "desc" },
  });

  const totalPlays = sounds.reduce((s, m) => s + (m.soundProfile?.playCount ?? 0), 0);
  const totalDownloads = sounds.reduce((s, m) => s + m.downloadCount, 0);

  return {
    totalPlays,
    totalDownloads,
    totalLikes: sounds.reduce((s, m) => s + m._count.favorites, 0),
    conversionRate: totalPlays > 0 ? Math.round((totalDownloads / totalPlays) * 100) : 0,
    topSounds: sounds.slice(0, 10).map((m) => ({
      id: m.id,
      title: m.title,
      slug: m.slug,
      plays: m.soundProfile?.playCount ?? 0,
      downloads: m.downloadCount,
    })),
  };
}
