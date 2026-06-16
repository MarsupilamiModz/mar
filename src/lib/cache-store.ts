import { unstable_cache } from "next/cache";

type CacheEntry<T> = { value: T; expiresAt: number };

const memoryStore = new Map<string, CacheEntry<unknown>>();

function redisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (redisConfigured()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (url && token) {
        const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
          headers: { Authorization: `Bearer ${token}` },
          next: { revalidate: 0 },
        });
        if (res.ok) {
          const json = (await res.json()) as { result?: string | null };
          if (json.result) return JSON.parse(json.result) as T;
        }
      }
    } catch {
      /* fall through to memory */
    }
  }

  const hit = memoryStore.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return hit.value as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds = 120): Promise<void> {
  if (redisConfigured()) {
    try {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (url && token) {
        await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(JSON.stringify(value))}?EX=${ttlSeconds}`, {
          headers: { Authorization: `Bearer ${token}` },
          method: "POST",
          next: { revalidate: 0 },
        });
        return;
      }
    } catch {
      /* fall through to memory */
    }
  }

  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cachedQuery<T>(
  keyParts: string[],
  fn: () => Promise<T>,
  revalidateSeconds = 60
): Promise<T> {
  return unstable_cache(fn, keyParts, { revalidate: revalidateSeconds })();
}
