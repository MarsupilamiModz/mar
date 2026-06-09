"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { hasPermission } from "@/lib/permissions";

async function canEditMod(userId: string, role: UserRole, modAuthorId: string) {
  if (modAuthorId === userId) return true;
  return hasPermission(role, "mods.write") || hasPermission(role, "mods.moderate");
}

export async function addModDependency(
  modId: string,
  dependencyId: string,
  isRequired = true,
  minVersion?: string,
  notes?: string
) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return fail("Mod not found");
  if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");
  if (modId === dependencyId) return fail("Mod cannot depend on itself");

  const dep = await prisma.mod.findUnique({ where: { id: dependencyId } });
  if (!dep) return fail("Dependency mod not found");

  await prisma.modDependency.upsert({
    where: { modId_dependencyId: { modId, dependencyId } },
    create: { modId, dependencyId, isRequired, minVersion, notes },
    update: { isRequired, minVersion, notes },
  });

  revalidatePath(`/mods/${mod.slug}`);
  return ok(undefined);
}

export async function removeModDependency(modId: string, dependencyId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const mod = await prisma.mod.findUnique({ where: { id: modId } });
  if (!mod) return fail("Mod not found");
  if (!(await canEditMod(user.id, user.role, mod.authorId))) return fail("Forbidden");

  await prisma.modDependency.deleteMany({ where: { modId, dependencyId } });
  revalidatePath(`/mods/${mod.slug}`);
  return ok(undefined);
}

export async function searchModsForDependency(query: string, gameId?: string) {
  const { error } = await requireActionUser();
  if (error) return error;

  const mods = await prisma.mod.findMany({
    where: {
      status: "PUBLISHED",
      ...(gameId && { gameId }),
      ...(query && {
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      }),
    },
    select: { id: true, title: true, slug: true },
    take: 20,
    orderBy: { downloadCount: "desc" },
  });

  return ok(mods);
}
