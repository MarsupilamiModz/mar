import { prisma } from "@/lib/db";
import { prismaErrorMessage } from "@/lib/errors";

export async function getSiteSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    if (!row?.value) return fallback;
    return { ...fallback, ...(row.value as object) } as T;
  } catch {
    return fallback;
  }
}

export async function setSiteSetting(key: string, value: unknown) {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}

export async function setSiteSettingSafe(
  key: string,
  value: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await setSiteSetting(key, value);
    return { ok: true };
  } catch (err) {
    const { logPlatformError } = await import("@/lib/platform-log");
    void logPlatformError(`site-setting:${key}`, err);
    return { ok: false, error: prismaErrorMessage(err) };
  }
}
