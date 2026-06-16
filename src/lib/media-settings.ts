import { prisma } from "@/lib/db";

export const MEDIA_SETTINGS_KEY = "media_settings";

export type MediaSettings = {
  minScreenshots: number;
  maxScreenshots: number;
  allowedTypes: string[];
  maxFileSizeMb: number;
  imageQuality: number;
};

export const DEFAULT_MEDIA_SETTINGS: MediaSettings = {
  minScreenshots: 0,
  maxScreenshots: 100,
  allowedTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileSizeMb: 5,
  imageQuality: 0.85,
};

export async function getMediaSettings(): Promise<MediaSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: MEDIA_SETTINGS_KEY } });
  if (!row?.value || typeof row.value !== "object") return DEFAULT_MEDIA_SETTINGS;
  return { ...DEFAULT_MEDIA_SETTINGS, ...(row.value as Partial<MediaSettings>) };
}

export async function updateMediaSettings(settings: MediaSettings) {
  await prisma.siteSetting.upsert({
    where: { key: MEDIA_SETTINGS_KEY },
    create: { key: MEDIA_SETTINGS_KEY, value: settings },
    update: { value: settings },
  });
}
