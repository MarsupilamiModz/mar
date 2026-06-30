const YOUTUBE_ID =
  /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function parseYouTubeUrl(url: string): { videoId: string | null } {
  const trimmed = url.trim();
  const match = trimmed.match(YOUTUBE_ID);
  return { videoId: match?.[1] ?? null };
}

export function youTubeEmbedUrl(videoId: string) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function youTubeThumbnail(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Best-effort oEmbed fetch for title, author, thumbnail. */
export async function fetchYouTubeMetadata(url: string) {
  const { videoId } = parseYouTubeUrl(url);
  if (!videoId) return null;

  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { next: { revalidate: 86400 } }
    );
    if (!res.ok) {
      return {
        videoId,
        title: null,
        channel: null,
        thumbnail: youTubeThumbnail(videoId),
        durationSec: null,
      };
    }
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    return {
      videoId,
      title: data.title ?? null,
      channel: data.author_name ?? null,
      thumbnail: data.thumbnail_url ?? youTubeThumbnail(videoId),
      durationSec: null,
    };
  } catch {
    return {
      videoId,
      title: null,
      channel: null,
      thumbnail: youTubeThumbnail(videoId),
      durationSec: null,
    };
  }
}

export function formatTutorialDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
