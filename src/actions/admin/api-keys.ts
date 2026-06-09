"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { generateApiKey, API_SCOPES, type ApiScope } from "@/lib/api-auth";

export async function listApiKeysAdmin() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const keys = await prisma.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { username: true } } },
  });

  return ok(keys);
}

export async function createApiKeyAdmin(input: {
  name: string;
  scopes: ApiScope[];
  rateLimit?: number;
  expiresAt?: string;
}) {
  const { user, error } = await requireActionPermission("settings.write");
  if (error) return error;

  if (!input.name.trim()) return fail("Name required");
  const scopes = input.scopes.filter((s) => API_SCOPES.includes(s));
  if (scopes.length === 0) return fail("At least one scope required");

  const { raw, prefix, hash } = generateApiKey();

  const key = await prisma.apiKey.create({
    data: {
      name: input.name.trim(),
      keyHash: hash,
      keyPrefix: prefix,
      scopes,
      rateLimit: input.rateLimit ?? 1000,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdById: user.id,
    },
  });

  revalidatePath("/admin/api-keys");
  return ok({ id: key.id, key: raw, prefix });
}

export async function revokeApiKeyAdmin(keyId: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  await prisma.apiKey.update({
    where: { id: keyId },
    data: { isActive: false },
  });

  revalidatePath("/admin/api-keys");
  return ok(undefined);
}

export async function updateApiKeyAdmin(
  keyId: string,
  input: { name?: string; scopes?: ApiScope[]; rateLimit?: number; isActive?: boolean }
) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const scopes = input.scopes?.filter((s) => API_SCOPES.includes(s));

  await prisma.apiKey.update({
    where: { id: keyId },
    data: {
      ...(input.name && { name: input.name }),
      ...(scopes && scopes.length > 0 && { scopes }),
      ...(input.rateLimit !== undefined && { rateLimit: input.rateLimit }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  revalidatePath("/admin/api-keys");
  return ok(undefined);
}
