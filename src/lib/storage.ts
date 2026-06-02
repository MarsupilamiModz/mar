/** Xumari Storage / CDN configuration */
export const STORAGE = {
  provider: "Cloudflare R2",
  brand: "Xumari Storage",
  cdn: "Xumari CDN",
  bucket: process.env.R2_BUCKET_NAME ?? "xumari-storage",
  prefix: "xumari",
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
