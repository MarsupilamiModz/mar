import { prisma } from "@/lib/db";

export type BanDurationPreset = "1d" | "3d" | "7d" | "30d" | "permanent";

/** Fields present on all deployed User schemas — safe at Prisma runtime. */
const CORE_BAN_SELECT = {
  id: true,
  isBanned: true,
  banReason: true,
  bannedAt: true,
} as const;

export type BanStateRow = {
  id: string;
  isBanned: boolean;
  banReason: string | null;
  banExpiresAt: Date | null;
  bannedAt: Date | null;
  isSuspended: boolean;
  isMuted: boolean;
  warningCount: number;
};

function normalizeBanState(raw: Record<string, unknown> | null): BanStateRow | null {
  if (!raw) return null;
  return {
    id: String(raw.id),
    isBanned: Boolean(raw.isBanned),
    banReason: (raw.banReason as string | null) ?? null,
    banExpiresAt: (raw.banExpiresAt as Date | null) ?? null,
    bannedAt: (raw.bannedAt as Date | null) ?? null,
    isSuspended: Boolean(raw.isSuspended ?? false),
    isMuted: Boolean(raw.isMuted ?? false),
    warningCount: Number(raw.warningCount ?? 0),
  };
}

export async function fetchBanState(userId: string): Promise<BanStateRow | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: CORE_BAN_SELECT,
  });
  if (!row) return null;

  let banExpiresAt: Date | null = null;
  try {
    const activeBan = await prisma.userBan.findFirst({
      where: { userId, liftedAt: null },
      orderBy: { createdAt: "desc" },
      select: { expiresAt: true },
    });
    banExpiresAt = activeBan?.expiresAt ?? null;
  } catch {
    /* UserBan.expiresAt column may not exist pre-migration */
  }

  return normalizeBanState({ ...row, banExpiresAt });
}

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

/** Lift expired temporary bans. Never throws — auth must not break on schema drift. */
export async function resolveActiveBan(userId: string): Promise<BanStateRow | null> {
  try {
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
            bannedById: null,
          },
        }),
        prisma.userBan.updateMany({
          where: { userId, liftedAt: null },
          data: { liftedAt: new Date() },
        }),
      ]);
      return { ...user, isBanned: false, banReason: null, banExpiresAt: null };
    }

    return user;
  } catch (err) {
    console.warn("[resolveActiveBan]", err);
    return null;
  }
}

export async function isUserModerationBlocked(userId: string) {
  const user = await resolveActiveBan(userId);
  if (!user) return { blocked: false as const };
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
