import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnecting: Promise<void> | undefined;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Keep a single client per Node worker (dev + production) to avoid pool exhaustion.
globalForPrisma.prisma = prisma;

/** Warm connection before critical auth paths (pooler cold start). */
export async function warmDbConnection() {
  if (!globalForPrisma.prismaConnecting) {
    globalForPrisma.prismaConnecting = (async () => {
      try {
        await prisma.$connect();
      } catch {
        /* already connected or connecting */
      }
      await prisma.$queryRaw`SELECT 1`;
    })();
  }
  await globalForPrisma.prismaConnecting;
}

const RETRYABLE =
  /connection|timeout|pool|econnrefused|can't reach|server has closed|too many clients|engine is not yet connected|not yet connected|p1001|p1002|p1008|p1017/i;

export function isRetryableDbError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: string }).code);
    if (/^P100[128]|^P1017/.test(code)) return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return RETRYABLE.test(msg);
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; delayMs?: number; label?: string } = {}
): Promise<T> {
  const { retries = 4, delayMs = 250, label = "db" } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) await warmDbConnection();
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableDbError(err) || attempt === retries) throw err;
      console.warn(`[${label}] retry ${attempt + 1}/${retries}`, err instanceof Error ? err.message : err);
      globalForPrisma.prismaConnecting = undefined;
      try {
        await prisma.$connect();
      } catch {
        /* reconnect best-effort */
      }
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }

  throw lastError;
}

/** Use inside unstable_cache callbacks so revalidation waits for a live Prisma engine. */
export async function runCachedQuery<T>(label: string, fn: () => Promise<T>): Promise<T> {
  await warmDbConnection();
  return withDbRetry(fn, { label, retries: 3 });
}

export async function checkDbHealth(): Promise<{ ok: boolean; detail?: string }> {
  try {
    await warmDbConnection();
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`, { retries: 2, label: "health" });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

if (typeof window === "undefined") {
  void warmDbConnection().catch(() => undefined);
}
