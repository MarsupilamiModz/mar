import type { LinkProvider } from "@/lib/discord-import/settings";

export type ResolvedLink =
  | {
      ok: true;
      provider: LinkProvider;
      downloadUrl: string;
      fileName: string;
      originalUrl: string;
    }
  | {
      ok: false;
      provider: LinkProvider;
      originalUrl: string;
      needsReview: boolean;
      reason: string;
    };

const FILE_EXT = /\.(zip|rar|7z|mp3|wav|ogg|flac|png|jpe?g|webp|gif|mp4|mov|webm)(\?|$)/i;

export function identifyLinkProvider(url: string): LinkProvider {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("linkvertise") || host.includes("link-to.net")) return "linkvertise";
    if (host.includes("drive.google.com") || host.includes("docs.google.com")) return "google_drive";
    if (host.includes("dropbox.com")) return "dropbox";
    if (host.includes("1drv.ms") || host.includes("onedrive.live.com")) return "onedrive";
    if (host.includes("github.com")) return "github";
    if (FILE_EXT.test(u.pathname)) return "direct";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function fileNameFromUrl(url: string, fallback = "download.bin"): string {
  try {
    const path = new URL(url).pathname.split("/").pop() ?? fallback;
    return decodeURIComponent(path.split("?")[0]) || fallback;
  } catch {
    return fallback;
  }
}

export function resolveDownloadUrl(url: string, provider: LinkProvider): ResolvedLink {
  const originalUrl = url;

  if (provider === "linkvertise") {
    return {
      ok: false,
      provider,
      originalUrl,
      needsReview: true,
      reason: "Linkvertise links require manual review or a direct file from the creator.",
    };
  }

  try {
    const parsed = new URL(url);

    if (provider === "google_drive") {
      const m = url.match(/\/file\/d\/([^/]+)/);
      if (!m) {
        return { ok: false, provider, originalUrl, needsReview: true, reason: "Unsupported Google Drive URL format" };
      }
      return {
        ok: true,
        provider,
        originalUrl,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${m[1]}`,
        fileName: fileNameFromUrl(url, `gdrive-${m[1]}.zip`),
      };
    }

    if (provider === "dropbox") {
      const dl = url.includes("dl=0") ? url.replace("dl=0", "dl=1") : `${url}${url.includes("?") ? "&" : "?"}dl=1`;
      return { ok: true, provider, originalUrl, downloadUrl: dl, fileName: fileNameFromUrl(url) };
    }

    if (provider === "github") {
      const releaseAsset = url.includes("/releases/download/");
      if (!releaseAsset && !FILE_EXT.test(parsed.pathname)) {
        return { ok: false, provider, originalUrl, needsReview: true, reason: "GitHub link is not a release asset" };
      }
      return { ok: true, provider, originalUrl, downloadUrl: url, fileName: fileNameFromUrl(url) };
    }

    if (provider === "direct" || provider === "unknown") {
      return { ok: true, provider: "direct", originalUrl, downloadUrl: url, fileName: fileNameFromUrl(url) };
    }

    return { ok: false, provider, originalUrl, needsReview: true, reason: "Provider not supported for automatic download" };
  } catch {
    return { ok: false, provider, originalUrl, needsReview: true, reason: "Invalid URL" };
  }
}

export async function downloadFromUrl(
  downloadUrl: string,
  maxBytes: number
): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
  const res = await fetch(downloadUrl, {
    headers: { "User-Agent": "XumariModz-DiscordImport/1.0" },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Link download failed (HTTP ${res.status})`);
  }

  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxBytes) {
    throw new Error(`File exceeds ${Math.round(maxBytes / 1024 / 1024)}MB link download limit`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) {
    throw new Error(`File exceeds ${Math.round(maxBytes / 1024 / 1024)}MB link download limit`);
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const nameMatch = disposition.match(/filename=\"?([^\";]+)/i);
  const fileName = nameMatch?.[1] ?? fileNameFromUrl(downloadUrl);
  const mimeType = res.headers.get("content-type") ?? "application/octet-stream";

  return { buffer, fileName, mimeType };
}
