import { prisma } from "@/lib/db";

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
