import { fileSizeNumber, serializeModVersions } from "@/lib/file-size";
import { normalizeStoredMediaUrl } from "@/lib/media-files";

type SoundProfileRow = {
  id: string;
  modId: string;
  artist: string | null;
  audioCategory: string;
  durationSeconds: number | null;
  bpm: number | null;
  genre: string | null;
  previewFileKey: string | null;
  previewFileName: string | null;
  previewFileSize: bigint | number | null;
  previewDurationSeconds: number | null;
  previewType: string;
  previewCustomSeconds: number | null;
  waveformPeaks: unknown;
  coverImageKey: string | null;
  playCount: number;
  createdAt: Date;
  updatedAt: Date;
};

type ModVersionRow = { fileSize: bigint | number; [key: string]: unknown };

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
            ? normalizeStoredMediaUrl(mod.soundProfile.coverImageKey) ??
              mod.soundProfile.coverImageKey
            : null,
        }
      : null,
    media: mod.media?.map((m) => ({
      ...m,
      imageUrl: m.imageUrl ? normalizeStoredMediaUrl(m.imageUrl) ?? m.imageUrl : m.imageUrl,
    })),
    screenshots: mod.screenshots?.map((s) => ({
      ...s,
      url: normalizeStoredMediaUrl(s.url) ?? s.url,
    })),
  };
}

/** Serialize sound profile for public pages. */
export function serializeSoundProfileForClient(profile: SoundProfileRow | null) {
  if (!profile) return null;
  return {
    ...profile,
    previewFileSize:
      profile.previewFileSize != null ? fileSizeNumber(profile.previewFileSize) : null,
    coverImageKey: profile.coverImageKey
      ? normalizeStoredMediaUrl(profile.coverImageKey) ?? profile.coverImageKey
      : null,
  };
}
