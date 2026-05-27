"use server";

import { revalidatePath } from "next/cache";
import { LicenseStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { generateLicenseKey, hashLicenseKey, normalizeLicenseKey } from "@/lib/licenses";

const createSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  notes: z.string().max(2000).optional(),
  productType: z.enum(["premium", "mod", "bundle"]),
  modId: z.string().optional(),
  assignedUserId: z.string().optional(),
  customKey: z.string().min(8).max(64).optional(),
  maxActivations: z.number().int().min(1).max(100).default(1),
  expiresAt: z.string().optional(),
  isLifetime: z.boolean().optional(),
  oneTimeUse: z.boolean().optional(),
});

export async function listLicenses(params: {
  page?: number;
  search?: string;
  status?: LicenseStatus;
  modId?: string;
}) {
  const { error } = await requireActionPermission("licenses.write");
  if (error) return error;

  const page = params.page ?? 1;
  const limit = 50;
  const skip = (page - 1) * limit;

  const where = {
    ...(params.status && { status: params.status }),
    ...(params.modId && { modId: params.modId }),
    ...(params.search && {
      OR: [
        { label: { contains: params.search, mode: "insensitive" as const } },
        { key: { contains: params.search.toUpperCase(), mode: "insensitive" as const } },
      ],
    }),
  };

  const [licenses, total] = await Promise.all([
    prisma.licenseKey.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        mod: { select: { title: true, slug: true } },
        assignedUser: { select: { username: true } },
        redeemedBy: { select: { username: true } },
        _count: { select: { activations: true } },
      },
    }),
    prisma.licenseKey.count({ where }),
  ]);

  return ok({ licenses, total, pages: Math.ceil(total / limit), page });
}

export async function createLicense(input: z.infer<typeof createSchema>) {
  const { user, error } = await requireActionPermission("licenses.write");
  if (error) return error;

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  if (parsed.data.productType === "mod" && !parsed.data.modId) {
    return fail("Mod product requires modId");
  }

  if (parsed.data.modId) {
    const mod = await prisma.mod.findUnique({ where: { id: parsed.data.modId } });
    if (!mod) return fail("Mod not found");
  }

  const key = normalizeLicenseKey(parsed.data.customKey ?? generateLicenseKey());
  const keyHash = hashLicenseKey(key);

  const exists = await prisma.licenseKey.findFirst({
    where: { OR: [{ key }, { keyHash }] },
  });
  if (exists) return fail("Key already exists");

  const license = await prisma.licenseKey.create({
    data: {
      key,
      keyHash,
      label: parsed.data.label,
      notes: parsed.data.notes,
      productType: parsed.data.productType,
      modId: parsed.data.modId,
      assignedUserId: parsed.data.assignedUserId,
      maxActivations: parsed.data.oneTimeUse ? 1 : parsed.data.maxActivations,
      expiresAt: parsed.data.isLifetime ? null : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      isLifetime: parsed.data.isLifetime ?? false,
      oneTimeUse: parsed.data.oneTimeUse ?? false,
      creatorId: user.role === "CREATOR" ? user.id : undefined,
      createdById: user.id,
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "license.create",
    entityType: "LicenseKey",
    entityId: license.id,
  });

  revalidatePath("/admin/licenses");
  return ok({ id: license.id, key });
}

export async function bulkGenerateLicenses(input: {
  count: number;
  productType: string;
  modId?: string;
  label?: string;
  maxActivations?: number;
  expiresAt?: string;
}) {
  const { user, error } = await requireActionPermission("licenses.write");
  if (error) return error;

  const count = Math.min(Math.max(input.count, 1), 500);
  const batchId = `batch_${Date.now()}`;
  const keys: string[] = [];

  for (let i = 0; i < count; i++) {
    const key = normalizeLicenseKey(generateLicenseKey());
    const keyHash = hashLicenseKey(key);
    await prisma.licenseKey.create({
      data: {
        key,
        keyHash,
        batchId,
        productType: input.productType,
        modId: input.modId,
        label: input.label,
        maxActivations: input.maxActivations ?? 1,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdById: user.id,
      },
    });
    keys.push(key);
  }

  await createAuditLog({
    actorId: user.id,
    action: "license.bulk_generate",
    entityType: "LicenseKey",
    entityId: batchId,
    metadata: { count },
  });

  revalidatePath("/admin/licenses");
  return ok({ batchId, keys });
}

export async function updateLicenseStatus(id: string, status: LicenseStatus) {
  const { user, error } = await requireActionPermission("licenses.write");
  if (error) return error;

  await prisma.licenseKey.update({ where: { id }, data: { status } });
  await createAuditLog({
    actorId: user.id,
    action: `license.${status.toLowerCase()}`,
    entityType: "LicenseKey",
    entityId: id,
  });

  revalidatePath("/admin/licenses");
  return ok(undefined);
}

export async function exportLicenses(batchId: string) {
  const { error } = await requireActionPermission("licenses.write");
  if (error) return error;

  const licenses = await prisma.licenseKey.findMany({
    where: { batchId },
    select: { key: true, label: true, status: true, productType: true, modId: true },
    orderBy: { createdAt: "asc" },
  });

  return ok(licenses);
}

export async function getLicenseActivations(licenseId: string) {
  const { error } = await requireActionPermission("licenses.write");
  if (error) return error;

  const activations = await prisma.licenseActivation.findMany({
    where: { licenseKeyId: licenseId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { username: true, email: true } } },
  });

  return ok(activations);
}
