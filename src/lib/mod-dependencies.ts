import { prisma } from "@/lib/db";
import { satisfiesMinVersion } from "@/lib/version-utils";

export async function getModDependencies(modId: string) {
  return prisma.modDependency.findMany({
    where: { modId },
    include: {
      dependency: {
        select: {
          id: true,
          slug: true,
          title: true,
          status: true,
          game: { select: { name: true, slug: true } },
          versions: {
            where: { isPrimary: true },
            take: 1,
            select: { version: true, gameVersion: true },
          },
        },
      },
    },
    orderBy: [{ isRequired: "desc" }, { dependency: { title: "asc" } }],
  });
}

export async function checkMissingDependencies(modId: string, userId: string | null) {
  const deps = await getModDependencies(modId);
  const required = deps.filter((d) => d.isRequired);

  if (required.length === 0) {
    return { required: [], optional: deps.filter((d) => !d.isRequired), missing: [] };
  }

  let ownedModIds = new Set<string>();
  const installedVersions = new Map<string, string>();

  if (userId) {
    const depIds = required.map((d) => d.dependencyId);
    const [downloads, purchases, depVersions] = await Promise.all([
      prisma.download.findMany({
        where: { userId, modId: { in: depIds } },
        select: { modId: true, version: { select: { version: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.modPurchase.findMany({
        where: { userId, modId: { in: depIds } },
        select: { modId: true },
      }),
      prisma.modVersion.findMany({
        where: { modId: { in: depIds }, isPrimary: true },
        select: { modId: true, version: true },
      }),
    ]);

    for (const d of downloads) {
      if (!installedVersions.has(d.modId) && d.version?.version) {
        installedVersions.set(d.modId, d.version.version);
      }
    }
    for (const v of depVersions) {
      if (!installedVersions.has(v.modId)) {
        installedVersions.set(v.modId, v.version);
      }
    }

    ownedModIds = new Set([
      ...downloads.map((d) => d.modId),
      ...purchases.map((p) => p.modId),
    ]);
  }

  const missing = required.filter((d) => {
    if (d.dependency.status !== "PUBLISHED") return false;
    if (!ownedModIds.has(d.dependencyId)) return true;
    const installed = installedVersions.get(d.dependencyId) ?? d.dependency.versions[0]?.version;
    return !satisfiesMinVersion(installed, d.minVersion);
  });

  return {
    required,
    optional: deps.filter((d) => !d.isRequired),
    missing,
  };
}
