/** Marsupilami Storage / CDN configuration */
export const STORAGE = {
  provider: "Cloudflare R2",
  brand: "Marsupilami Storage",
  cdn: "Marsupilami CDN",
  bucket: process.env.R2_BUCKET_NAME ?? "marsupilami-storage",
  prefix: "marsupilami",
  buckets: {
    modImages: "mod-images",
    modVideoThumbnails: "mod-videos-thumbnails",
    creatorBanners: "creator-banners",
    creatorAvatars: "creator-avatars",
  },
} as const;

export function storageKey(...parts: string[]) {
  return [STORAGE.prefix, ...parts].filter(Boolean).join("/");
}

export function cdnUrl(key: string) {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${key}`;
}
