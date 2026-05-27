"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeLicenseKey } from "@/lib/licenses";

function ipHash() {
  const ip = headers().get("x-forwarded-for") ?? "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export async function getUserLicenses() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const activations = await prisma.licenseActivation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      licenseKey: {
        include: {
          mod: { select: { id: true, title: true, slug: true, pricing: true } },
        },
      },
    },
  });

  return ok(activations);
}

export async function redeemLicense(key: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const limit = rateLimit(`redeem:${user.id}`, 5, 300_000);
  if (!limit.success) return fail("Rate limited");

  const normalized = normalizeLicenseKey(key);
  const license = await prisma.licenseKey.findUnique({
    where: { key: normalized },
    include: { mod: { select: { id: true, title: true, slug: true } } },
  });

  if (!license) return fail("Invalid license key");
  if (license.status === "REVOKED") return fail("This key has been revoked");
  if (license.status === "PAUSED") return fail("This key is temporarily paused");
  if (license.status === "EXPIRED") return fail("This key has expired");

  if (license.expiresAt && license.expiresAt < new Date()) {
    await prisma.licenseKey.update({
      where: { id: license.id },
      data: { status: "EXPIRED" },
    });
    return fail("Key expired");
  }

  if (license.productType === "mod" && !license.modId) {
    return fail("Invalid product license — no product assigned");
  }

  if (license.assignedUserId && license.assignedUserId !== user.id) {
    return fail("This key is assigned to another account");
  }

  if (license.activationCount >= license.maxActivations) {
    return fail("Activation limit reached for this key");
  }

  const alreadyUsed = await prisma.licenseActivation.findFirst({
    where: { licenseKeyId: license.id, userId: user.id },
  });
  if (alreadyUsed && license.maxActivations === 1) {
    return fail("You have already activated this key");
  }

  const ua = headers().get("user-agent") ?? undefined;

  await prisma.$transaction(async (tx) => {
    await tx.licenseActivation.create({
      data: {
        licenseKeyId: license.id,
        userId: user.id,
        ipHash: ipHash(),
        userAgent: ua?.slice(0, 512),
      },
    });

    const newCount = license.activationCount + 1;
    await tx.licenseKey.update({
      where: { id: license.id },
      data: {
        activationCount: newCount,
        redeemedAt: license.redeemedAt ?? new Date(),
        redeemedById: license.redeemedById ?? user.id,
        status: newCount >= license.maxActivations ? "REDEEMED" : "ACTIVE",
      },
    });

    if (license.productType === "premium") {
      await tx.user.update({
        where: { id: user.id },
        data: {
          role:
            user.role === "OWNER" || user.role === "ADMIN" || user.role === "MODERATOR"
              ? user.role
              : "PREMIUM",
        },
      });
    }

    if (license.productType === "mod") {
      if (!license.modId) throw new Error("Invalid product license");
      await tx.modPurchase.upsert({
        where: { modId_userId: { modId: license.modId, userId: user.id } },
        create: { modId: license.modId, userId: user.id, amountCents: 0 },
        update: {},
      });
    }
  });

  revalidatePath("/dashboard/licenses");
  return ok({
    productType: license.productType,
    mod: license.mod,
  });
}
