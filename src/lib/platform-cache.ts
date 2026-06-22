import { revalidateTag } from "next/cache";
import { cacheGet, cacheSet, cacheDel } from "@/lib/cache-store";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";

export type CacheLayerOptions = {
  ttlSeconds?: number;
  tag?: string;
};

/** Redis/memory cache with Next tag invalidation on write paths. */
export async function withPlatformCache<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheLayerOptions = {}
): Promise<T> {
  const ttl = options.ttlSeconds ?? REVALIDATE.catalog;
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;

  const value = await fn();
  await cacheSet(key, value, ttl);
  return value;
}

export async function invalidatePlatformCacheKey(key: string) {
  await cacheDel(key);
}

export function invalidatePlatformCacheTag(tag: string) {
  revalidateTag(tag);
}

export const PLATFORM_CACHE_KEYS = {
  navGames: "platform:nav-games",
  gameModeBundles: (gameSlug: string) => `platform:game-modes:${gameSlug}`,
  leaderboards: "platform:leaderboards",
  teamPage: "platform:team-page",
} as const;

export { CACHE_TAGS, REVALIDATE };
