import { prisma } from "@/lib/db";
import { getMediaUrl, getMediaProxyFallback } from "@/lib/media-url";
import { getR2ConfigStatus } from "@/lib/r2-config";
import { getStorageProvider, isStorageConfigured } from "@/lib/asset-storage";

export type ScreenshotDiagnosticRow = {
  id: string;
  modId: string;
  modSlug: string;
  modTitle: string;
  storedUrl: string | null;
  resolvedUrl: string | null;
  proxyUrl: string | null;
  mediaFileId: string | null;
  storagePath: string | null;
  dbStatus: "ok" | "missing_url";
  urlStatus: "ok" | "missing" | "broken" | "unknown";
  reachable: boolean | null;
};

async function checkReachable(url: string): Promise<boolean | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.ok) return true;
    if (res.status === 405 || res.status === 403) {
      const getRes = await fetch(url, {
        method: "GET",
        headers: { Range: "bytes=0-0" },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      return getRes.ok;
    }
    return false;
  } catch {
    return false;
  }
}

export async function diagnoseModScreenshots(limit = 100): Promise<{
  rows: ScreenshotDiagnosticRow[];
  summary: {
    total: number;
    missingUrl: number;
    broken: number;
    ok: number;
    storageProvider: string;
    storageConfigured: boolean;
    cdnUrl: string | null;
  };
}> {
  const items = await prisma.modMedia.findMany({
    where: { mediaType: "IMAGE" },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      mod: { select: { id: true, slug: true, title: true } },
    },
  });

  const mediaFiles = await prisma.mediaFile.findMany({
    where: {
      entityType: "MOD_SCREENSHOT",
      entityId: { in: items.map((i) => i.modId) },
    },
    select: { id: true, entityId: true, storagePath: true, publicUrl: true },
  });

  const fileByMod = new Map<string, (typeof mediaFiles)[number][]>();
  for (const f of mediaFiles) {
    if (!f.entityId) continue;
    const list = fileByMod.get(f.entityId) ?? [];
    list.push(f);
    fileByMod.set(f.entityId, list);
  }

  const rows: ScreenshotDiagnosticRow[] = [];

  for (const item of items) {
    const stored = item.imageUrl;
    const resolved = stored ? getMediaUrl(stored) : null;
    const proxy = getMediaProxyFallback(stored);
    const files = fileByMod.get(item.modId) ?? [];
    const matchedFile =
      files.find((f) => f.publicUrl === stored || f.publicUrl === resolved) ?? files[0] ?? null;

    let urlStatus: ScreenshotDiagnosticRow["urlStatus"] = "unknown";
    if (!stored) urlStatus = "missing";
    else if (!resolved) urlStatus = "missing";
    else urlStatus = "ok";

    let reachable: boolean | null = null;
    if (resolved) {
      reachable = await checkReachable(resolved);
      if (reachable === false && proxy && proxy !== resolved) {
        const proxyOk = await checkReachable(proxy);
        if (proxyOk) reachable = true;
      }
      if (reachable === false) urlStatus = "broken";
    }

    rows.push({
      id: item.id,
      modId: item.modId,
      modSlug: item.mod.slug,
      modTitle: item.mod.title,
      storedUrl: stored,
      resolvedUrl: resolved,
      proxyUrl: proxy,
      mediaFileId: matchedFile?.id ?? null,
      storagePath: matchedFile?.storagePath ?? null,
      dbStatus: stored ? "ok" : "missing_url",
      urlStatus,
      reachable,
    });
  }

  const r2 = getR2ConfigStatus();

  return {
    rows,
    summary: {
      total: rows.length,
      missingUrl: rows.filter((r) => r.dbStatus === "missing_url").length,
      broken: rows.filter((r) => r.urlStatus === "broken" || r.reachable === false).length,
      ok: rows.filter((r) => r.reachable === true).length,
      storageProvider: getStorageProvider(),
      storageConfigured: isStorageConfigured(),
      cdnUrl: r2.publicUrl,
    },
  };
}
