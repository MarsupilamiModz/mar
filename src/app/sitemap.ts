import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { locales } from "@/i18n/config";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["", "/mods", "/games", "/premium", "/creators", "/blog", "/faq", "/contact"];
  const staticEntries = locales.flatMap((locale) =>
    staticPaths.map((path) => ({
      url: `${base}/${locale}${path}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: path === "" ? 1 : 0.8,
    }))
  );

  let modEntries: MetadataRoute.Sitemap = [];
  try {
    const mods = await prisma.mod.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
      take: 500,
    });
    modEntries = locales.flatMap((locale) =>
      mods.map((m) => ({
        url: `${base}/${locale}/mods/${m.slug}`,
        lastModified: m.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
    );
  } catch {
    // DB not configured yet
  }

  return [...staticEntries, ...modEntries];
}
