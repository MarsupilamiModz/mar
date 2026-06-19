import { prisma } from "@/lib/db";
import { satisfiesMinVersion } from "@/lib/version-utils";
import type { ModDependencyRelation } from "@prisma/client";

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
    orderBy: [{ relation: "asc" }, { dependency: { title: "asc" } }],
  });
}

export async function getModConflicts(modId: string) {
  const deps = await getModDependencies(modId);
  return deps.filter((d) => d.relation === "CONFLICT");
}

export function groupDependencies(deps: Awaited<ReturnType<typeof getModDependencies>>) {
  return {
    required: deps.filter((d) => d.relation === "REQUIRED" || (d.relation !== "CONFLICT" && d.isRequired)),
    optional: deps.filter((d) => d.relation === "OPTIONAL" || (!d.isRequired && d.relation !== "CONFLICT")),
    conflicts: deps.filter((d) => d.relation === "CONFLICT"),
  };
}

export async function checkMissingDependencies(modId: string, userId: string | null) {
  const deps = await getModDependencies(modId);
  const { required, optional, conflicts } = groupDependencies(deps);

  if (required.length === 0) {
    return { required, optional, conflicts, missing: [] };
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

  return { required, optional, conflicts, missing };
}

export function relationFromLegacy(isRequired: boolean, relation?: ModDependencyRelation): ModDependencyRelation {
  if (relation) return relation;
  return isRequired ? "REQUIRED" : "OPTIONAL";
}
