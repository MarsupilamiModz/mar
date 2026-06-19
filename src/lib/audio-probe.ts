import "server-only";

import { prisma } from "@/lib/db";
import { getObjectBufferFromR2 } from "@/lib/r2";
import { parseAudioMetadata, mimeFromAudioFileName } from "@/lib/audio-metadata";
import { estimateBitrateKbps } from "@/lib/sound-storage";

const MAX_PROBE_BYTES = 8 * 1024 * 1024;

export async function probeAudioFromStorage(
  fileKey: string,
  fileName: string,
  contentType?: string | null,
  fileSizeBytes?: number | null
) {
  try {
    const buffer = await getObjectBufferFromR2(fileKey);
    const slice = buffer.subarray(0, Math.min(buffer.length, MAX_PROBE_BYTES));
    const meta = parseAudioMetadata(slice, fileName, contentType);
    if (!meta.durationSeconds && fileSizeBytes && meta.bitrateKbps) {
      meta.durationSeconds = Math.round((fileSizeBytes * 8) / (meta.bitrateKbps * 1000));
    }
    if (!meta.bitrateKbps && meta.durationSeconds && fileSizeBytes) {
      meta.bitrateKbps = estimateBitrateKbps(fileSizeBytes, meta.durationSeconds);
    }
    return meta;
  } catch (err) {
    console.error("[audio-probe]", fileKey, err);
    return {
      durationSeconds: null,
      bitrateKbps: null,
      mimeType: mimeFromAudioFileName(fileName),
    };
  }
}

export async function ensureSoundProfileMetadata(modId: string) {
  const profile = await prisma.soundProfile.findUnique({ where: { modId } });
  if (!profile?.previewFileKey) return null;

  const hasDuration = (profile.previewDurationSeconds ?? profile.durationSeconds ?? 0) > 0;
  if (hasDuration && profile.previewMimeType && profile.previewBitrateKbps) {
    return profile;
  }

  const fileSize = profile.previewFileSize ? Number(profile.previewFileSize) : null;
  const meta = await probeAudioFromStorage(
    profile.previewFileKey,
    profile.previewFileName ?? "audio.mp3",
    profile.previewMimeType,
    fileSize
  );

  const durationSeconds =
    meta.durationSeconds ??
    profile.previewDurationSeconds ??
    profile.durationSeconds ??
    null;

  if (!durationSeconds && !meta.mimeType) return profile;

  return prisma.soundProfile.update({
    where: { modId },
    data: {
      previewDurationSeconds: durationSeconds ?? undefined,
      durationSeconds: durationSeconds ?? profile.durationSeconds ?? undefined,
      previewMimeType: meta.mimeType,
      previewBitrateKbps: meta.bitrateKbps ?? undefined,
    },
  });
}
