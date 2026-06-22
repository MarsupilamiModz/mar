const prefetched = new Set<string>();
const loaded = new Set<string>();

function preloadOne(url: string) {
  if (prefetched.has(url)) return;
  prefetched.add(url);

  const img = new window.Image();
  img.decoding = "async";
  img.onload = () => loaded.add(url);
  img.onerror = () => loaded.add(url);
  img.src = url;

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = url;
  document.head.appendChild(link);
}

/** Preload remote images into the browser cache (mode modal assets). */
export function prefetchImages(urls: (string | null | undefined)[]) {
  if (typeof window === "undefined") return;

  for (const raw of urls) {
    if (!raw) continue;
    preloadOne(raw);
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

export function isImagePrefetched(url: string | null | undefined): boolean {
  if (!url) return false;
  return loaded.has(url) || prefetched.has(url);
}

/** CSS background for instant paint when image is warmed in cache. */
export function prefetchedBackgroundStyle(
  url: string | null | undefined
): { backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string } | undefined {
  if (!url) return undefined;
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

export function scheduleIdlePrefetch(fn: () => void) {
  if (typeof window === "undefined") return;
  const ric = window.requestIdleCallback;
  if (typeof ric === "function") {
    ric(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 16);
  }
}
