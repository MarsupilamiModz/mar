import type { ModVersion, SoundProfile } from "@prisma/client";
import { fileSizeNumber, serializeModVersions } from "@/lib/file-size";
import { getMediaUrl } from "@/lib/media-url";

export type ClientSoundProfile = Omit<SoundProfile, "previewFileSize" | "coverImageKey"> & {
  previewFileSize: number | null;
  coverImageKey: string | null;
};

type SoundProfileRow = Pick<
  SoundProfile,
  | "id"
  | "modId"
  | "artist"
  | "audioCategory"
  | "durationSeconds"
  | "bpm"
  | "genre"
  | "previewFileKey"
  | "previewFileName"
  | "previewDurationSeconds"
  | "previewType"
  | "previewCustomSeconds"
  | "waveformPeaks"
  | "playCount"
  | "createdAt"
  | "updatedAt"
> & {
  previewFileSize: bigint | number | null;
  coverImageKey: string | null;
};

type ModVersionRow = Pick<ModVersion, "fileSize"> & Record<string, unknown>;

type ModMediaRow = {
  id: string;
  mediaType: string;
  imageUrl: string | null;
  videoUrl: string | null;
  youtubeVideoId: string | null;
  orderIndex: number;
  isFeatured: boolean;
  createdAt?: Date;
};

/** Serialize mod edit payload for client components (BigInt-safe, URL-normalized). */
export function serializeModForEdit<
  T extends {
    versions?: ModVersionRow[];
    soundProfile?: SoundProfileRow | null;
    media?: ModMediaRow[];
    screenshots?: { id: string; url: string; sortOrder: number }[];
  },
>(mod: T) {
  return {
    ...mod,
    versions: mod.versions ? serializeModVersions(mod.versions) : mod.versions,
    soundProfile: mod.soundProfile
      ? {
          ...mod.soundProfile,
          previewFileSize:
            mod.soundProfile.previewFileSize != null
              ? fileSizeNumber(mod.soundProfile.previewFileSize)
              : null,
          coverImageKey: mod.soundProfile.coverImageKey
            ? getMediaUrl(mod.soundProfile.coverImageKey) ??
              mod.soundProfile.coverImageKey
            : null,
        }
      : null,
    media: mod.media?.map((m) => ({
      ...m,
      imageUrl: m.imageUrl ? getMediaUrl(m.imageUrl) ?? m.imageUrl : m.imageUrl,
    })),
    screenshots: mod.screenshots?.map((s) => ({
      ...s,
      url: getMediaUrl(s.url) ?? s.url,
    })),
  };
}

/** Serialize sound profile for public pages (full Prisma row or already-serialized client row). */
export function serializeSoundProfileForClient(
  profile: SoundProfile | ClientSoundProfile | null
): ClientSoundProfile | null {
  if (!profile) return null;
  return {
    ...profile,
    previewFileSize:
      profile.previewFileSize != null ? fileSizeNumber(profile.previewFileSize) : null,
    coverImageKey: profile.coverImageKey
      ? getMediaUrl(profile.coverImageKey) ?? profile.coverImageKey
      : null,
  };
}

/** Strip BigInt from mod detail before unstable_cache and client boundaries. */
export function serializeModDetailForClient<
  T extends {
    versions: Array<Pick<ModVersion, "fileSize"> & Record<string, unknown>>;
    soundProfile?: SoundProfile | null;
    media?: ModMediaRow[];
    screenshots?: { id: string; url: string; sortOrder: number }[];
  },
>(mod: T) {
  return {
    ...mod,
    versions: serializeModVersions(mod.versions),
    soundProfile: mod.soundProfile
      ? serializeSoundProfileForClient(mod.soundProfile)
      : null,
    media: mod.media?.map((m) => ({
      ...m,
      imageUrl: m.imageUrl ? getMediaUrl(m.imageUrl) ?? m.imageUrl : m.imageUrl,
    })),
    screenshots: mod.screenshots?.map((s) => ({
      ...s,
      url: getMediaUrl(s.url) ?? s.url,
    })),
  };
}
