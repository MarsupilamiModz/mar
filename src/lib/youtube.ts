const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const URL_PATTERNS = [
  /(?:youtube\.com\/watch\?(?:[^&]+&)*v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
];

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return YOUTUBE_ID_RE.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (url.pathname.startsWith("/embed/")) {
        const id = url.pathname.split("/")[2];
        return id && YOUTUBE_ID_RE.test(id) ? id : null;
      }
      if (url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/")[2];
        return id && YOUTUBE_ID_RE.test(id) ? id : null;
      }
      const v = url.searchParams.get("v");
      if (v && YOUTUBE_ID_RE.test(v)) return v;
    }
  } catch {
    // fall through to regex patterns
  }

  for (const pattern of URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function youTubeEmbedUrl(videoId: string, opts?: { autoplay?: boolean }) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    color: "white",
    ...(opts?.autoplay ? { autoplay: "1" } : {}),
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}

export function youTubeThumbnailUrl(videoId: string, quality: "default" | "hq" | "maxres" = "hq") {
  const map = {
    default: "default",
    hq: "hqdefault",
    maxres: "maxresdefault",
  } as const;
  return `https://img.youtube.com/vi/${videoId}/${map[quality]}.jpg`;
}

export function isYouTubeUrl(input: string) {
  return extractYouTubeId(input) !== null;
}
