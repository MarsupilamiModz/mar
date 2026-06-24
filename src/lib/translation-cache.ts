import { createHash } from "node:crypto";
import { cacheGet, cacheSet } from "@/lib/cache-store";
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";

const REDIS_TTL_SECONDS = 60 * 60 * 24;
const DB_CACHE_KEY = "translation_text_cache";

type DbCacheStore = Record<
  string,
  {
    translatedText: string;
    sourceLocale: string;
    targetLocale: string;
    sourceText: string;
    provider: string;
    updatedAt: string;
  }
>;

export async function getCachedTranslation(cacheKey: string): Promise<string | null> {
  const redisHit = await cacheGet<string>(`translation:${cacheKey}`);
  if (redisHit) return redisHit;

  const store = await getSiteSetting<DbCacheStore>(DB_CACHE_KEY, {});
  return store[cacheKey]?.translatedText ?? null;
}

export async function setCachedTranslation(
  cacheKey: string,
  translatedText: string,
  meta: {
    sourceLocale: string;
    targetLocale: string;
    sourceText: string;
    provider: string;
  }
): Promise<void> {
  await cacheSet(`translation:${cacheKey}`, translatedText, REDIS_TTL_SECONDS);

  const store = await getSiteSetting<DbCacheStore>(DB_CACHE_KEY, {});
  store[cacheKey] = {
    translatedText,
    ...meta,
    updatedAt: new Date().toISOString(),
  };
  await setSiteSetting(DB_CACHE_KEY, store);
}

export async function clearTranslationCache(): Promise<number> {
  const store = await getSiteSetting<DbCacheStore>(DB_CACHE_KEY, {});
  const count = Object.keys(store).length;
  await setSiteSetting(DB_CACHE_KEY, {});
  return count;
}

export async function getTranslationCacheStats() {
  const store = await getSiteSetting<DbCacheStore>(DB_CACHE_KEY, {});
  return { dbEntries: Object.keys(store).length };
}

export function hashSourceText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
