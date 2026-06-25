"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MembershipTier } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  actionTry,
  fail,
  formatZodError,
  ok,
  requireActionPermission,
  requireActionOwner,
} from "@/lib/action-utils";
import {
  getReferralAnalytics,
  trackReferralClick,
} from "@/lib/referral";
import { buildReferralRegisterUrl } from "@/lib/referral-url";
import { normalizeReferralCode } from "@/lib/referral-cookie";

const referralSchema = z.object({
  code: z.string().min(3).max(32),
  name: z.string().min(2).max(120),
  premiumType: z.nativeEnum(MembershipTier).default("PREMIUM_LITE"),
  premiumDays: z.number().int().min(1).max(365).default(3),
  maxUses: z.number().int().min(1).nullable().optional(),
  active: z.boolean().optional(),
  trackingEnabled: z.boolean().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function getAdminReferrals() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const analytics = await getReferralAnalytics();
  return ok(analytics);
}

export async function createReferralLink(input: z.infer<typeof referralSchema>) {
  const { user, error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = referralSchema.safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  const code = normalizeReferralCode(parsed.data.code);
  const taken = await prisma.referralLink.findUnique({ where: { code } });
  if (taken) return fail("Referral code already exists");

  return actionTry(async () => {
    const link = await prisma.referralLink.create({
      data: {
        code,
        name: parsed.data.name,
        premiumType: parsed.data.premiumType,
        premiumDays: parsed.data.premiumDays,
        maxUses: parsed.data.maxUses ?? null,
        active: parsed.data.active ?? true,
        trackingEnabled: parsed.data.trackingEnabled ?? true,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        createdById: user.id,
      },
    });
    revalidatePath("/admin/referrals");
    return {
      ...link,
      registerUrl: buildReferralRegisterUrl("en", link.code),
    };
  }, "referral:create");
}

export async function updateReferralLink(id: string, input: Partial<z.infer<typeof referralSchema>>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = referralSchema.partial().safeParse(input);
  if (!parsed.success) return fail(formatZodError(parsed.error));

  return actionTry(async () => {
    const data: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.code) data.code = normalizeReferralCode(parsed.data.code);
    if (parsed.data.expiresAt !== undefined) {
      data.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    }

    await prisma.referralLink.update({ where: { id }, data });
    revalidatePath("/admin/referrals");
  }, "referral:update");
}

export async function toggleReferralLink(id: string, active: boolean) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(async () => {
    await prisma.referralLink.update({ where: { id }, data: { active } });
    revalidatePath("/admin/referrals");
  }, "referral:toggle");
}

export async function deleteReferralLink(id: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  return actionTry(async () => {
    await prisma.referralLink.delete({ where: { id } });
    revalidatePath("/admin/referrals");
  }, "referral:delete");
}

export async function captureReferralClick(code: string) {
  const result = await trackReferralClick(code);
  return ok(result);
}

export async function getOwnerReferralStats() {
  const { error } = await requireActionOwner();
  if (error) return error;
  return ok(await getReferralAnalytics());
}
