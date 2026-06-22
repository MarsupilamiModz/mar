const prefetched = new Set<string>();

/** Preload remote images into the browser cache (mode modal assets). */
export function prefetchImages(urls: (string | null | undefined)[]) {
  if (typeof window === "undefined") return;

  for (const raw of urls) {
    if (!raw || prefetched.has(raw)) continue;
    prefetched.add(raw);
    const img = new window.Image();
    img.decoding = "async";
    img.src = raw;
  }
}

export function prefetchGameModeAssets(
  modes: {
    backgroundUrl?: string | null;
    bannerUrl?: string | null;
    thumbnailUrl?: string | null;
    logoUrl?: string | null;
    iconUrl?: string | null;
  }[]
) {
  for (const mode of modes) {
    prefetchImages([
      mode.backgroundUrl,
      mode.bannerUrl,
      mode.thumbnailUrl,
      mode.logoUrl,
      mode.iconUrl,
    ]);
  }
}
