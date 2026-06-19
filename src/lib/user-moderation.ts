import { prisma } from "@/lib/db";
import { banStateSelect, fetchBanState, type BanStateRow } from "@/lib/moderation-store";

export type BanDurationPreset = "1d" | "3d" | "7d" | "30d" | "permanent";

export function banExpiresFromPreset(preset: BanDurationPreset): Date | null {
  const now = Date.now();
  switch (preset) {
    case "1d":
      return new Date(now + 24 * 60 * 60 * 1000);
    case "3d":
      return new Date(now + 3 * 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now + 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now + 30 * 24 * 60 * 60 * 1000);
    case "permanent":
    default:
      return null;
  }
}

export function formatBanDurationLabel(expiresAt: Date | null | undefined, locale = "en") {
  if (!expiresAt) return "Permanent";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(expiresAt);
}

/** Lift expired temporary bans and return whether user is currently banned. */
export async function resolveActiveBan(userId: string): Promise<BanStateRow | null> {
  const user = await fetchBanState(userId);
  if (!user) return null;

  if (user.isBanned && user.banExpiresAt && user.banExpiresAt <= new Date()) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          isBanned: false,
          banReason: null,
          bannedAt: null,
          banExpiresAt: null,
          bannedById: null,
        } as Record<string, unknown> as never,
      }),
      prisma.userBan.updateMany({
        where: { userId, liftedAt: null },
        data: { liftedAt: new Date() },
      }),
    ]);
    return { ...user, isBanned: false, banReason: null, banExpiresAt: null };
  }

  return user;
}

export async function isUserModerationBlocked(userId: string) {
  const user = await resolveActiveBan(userId);
  if (!user) return { blocked: true, reason: "Account not found" };
  if (user.isBanned) {
    return {
      blocked: true,
      reason: user.banReason ?? "Your account has been suspended.",
      expiresAt: user.banExpiresAt,
    };
  }
  if (user.isSuspended) {
    return { blocked: true, reason: "Your account is temporarily suspended." };
  }
  return { blocked: false as const };
}

export { banStateSelect };
