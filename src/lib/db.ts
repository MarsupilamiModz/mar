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
    globalForPrisma.prismaConnecting = prisma.$queryRaw`SELECT 1`.then(() => undefined);
  }
  await globalForPrisma.prismaConnecting;
}

const RETRYABLE =
  /connection|timeout|pool|econnrefused|can't reach|server has closed|too many clients|p1001|p1002|p1008|p1017/i;

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
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableDbError(err) || attempt === retries) throw err;
      console.warn(`[${label}] retry ${attempt + 1}/${retries}`, err instanceof Error ? err.message : err);
      if (attempt === 1) {
        try {
          await prisma.$disconnect();
          globalForPrisma.prismaConnecting = undefined;
          await warmDbConnection();
        } catch {
          /* reconnect best-effort */
        }
      }
      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }

  throw lastError;
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
