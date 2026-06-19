import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ModerationAction } from "@/lib/moderation-types";
import { buildPrismaSelect, pickPrismaModelFields, prismaModelExists } from "@/lib/prisma-schema";

export type ModerationLogRow = {
  id: string;
  action: ModerationAction;
  reason: string | null;
  createdAt: Date;
  user: { username: string };
  actor: { username: string } | null;
};

type ModerationLogDelegate = {
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  findMany: (args: Record<string, unknown>) => Promise<ModerationLogRow[]>;
};

function moderationLogDelegate(): ModerationLogDelegate | null {
  if (!prismaModelExists("UserModerationLog")) return null;
  return (prisma as unknown as { userModerationLog?: ModerationLogDelegate }).userModerationLog ?? null;
}

export function hasModerationLogTable(): boolean {
  return moderationLogDelegate() != null;
}

export async function createModerationLogEntry(input: {
  userId: string;
  actorId: string;
  action: ModerationAction;
  reason?: string | null;
  internalNote?: string | null;
  expiresAt?: Date | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const delegate = moderationLogDelegate();
  if (!delegate) return;

  await delegate.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      actorId: input.actorId,
      action: input.action,
      reason: input.reason ?? null,
      internalNote: input.internalNote ?? null,
      expiresAt: input.expiresAt ?? null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function listRecentModerationLogs(limit = 30): Promise<ModerationLogRow[]> {
  const delegate = moderationLogDelegate();
  if (delegate) {
    return delegate.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { username: true } },
        actor: { select: { username: true } },
      },
    });
  }

  const auditRows = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          "user.ban",
          "user.unban",
          "user.suspend",
          "user.warn",
          "user.soft_delete",
          "user.role_change",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { actor: { select: { username: true } } },
  });

  const actionMap: Record<string, ModerationAction> = {
    "user.ban": "BAN_PERMANENT",
    "user.unban": "UNBAN",
    "user.suspend": "SUSPEND",
    "user.warn": "WARN",
    "user.soft_delete": "SOFT_DELETE",
    "user.role_change": "ROLE_CHANGE",
  };

  const rows: ModerationLogRow[] = [];
  for (const row of auditRows) {
    const username = await prisma.user.findUnique({
      where: { id: row.entityId ?? "" },
      select: { username: true },
    });
    if (!username) continue;
    rows.push({
      id: row.id,
      action: actionMap[row.action] ?? "WARN",
      reason: null,
      createdAt: row.createdAt,
      user: { username: username.username },
      actor: row.actor,
    });
  }
  return rows;
}

const CORE_USER_LIST_SELECT = buildPrismaSelect("User", {
  id: true,
  username: true,
  email: true,
  displayName: true,
  role: true,
  isBanned: true,
  isSuspended: true,
  isMuted: true,
  warningCount: true,
  banReason: true,
  banExpiresAt: true,
  bannedAt: true,
  createdAt: true,
});

export type ModerationUserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: string;
  isBanned: boolean;
  isSuspended: boolean;
  isMuted: boolean;
  warningCount: number;
  banReason: string | null;
  banExpiresAt: Date | null;
  bannedAt: Date | null;
  createdAt: Date;
};

export function normalizeModerationUser(raw: Record<string, unknown>): ModerationUserRow {
  return {
    id: String(raw.id ?? ""),
    username: String(raw.username ?? ""),
    email: String(raw.email ?? ""),
    displayName: (raw.displayName as string | null | undefined) ?? null,
    role: String(raw.role ?? "USER"),
    isBanned: Boolean(raw.isBanned),
    isSuspended: Boolean(raw.isSuspended ?? false),
    isMuted: Boolean(raw.isMuted ?? false),
    warningCount: Number(raw.warningCount ?? 0),
    banReason: (raw.banReason as string | null | undefined) ?? null,
    banExpiresAt: (raw.banExpiresAt as Date | null | undefined) ?? null,
    bannedAt: (raw.bannedAt as Date | null | undefined) ?? null,
    createdAt: (raw.createdAt as Date) ?? new Date(0),
  };
}

export async function listModerationUsers(args: {
  where: Prisma.UserWhereInput;
  skip: number;
  take: number;
}): Promise<ModerationUserRow[]> {
  const rows = await prisma.user.findMany({
    where: args.where,
    skip: args.skip,
    take: args.take,
    orderBy: { updatedAt: "desc" },
    select: CORE_USER_LIST_SELECT,
  });
  return rows.map((row) => normalizeModerationUser(row as Record<string, unknown>));
}

export const flaggedUsersWhere = {
  deletedAt: null,
  isBanned: true,
} satisfies Prisma.UserWhereInput;

export async function updateUserModerationFields(
  userId: string,
  data: Record<string, unknown>
) {
  const safe = pickPrismaModelFields("User", data);
  if (Object.keys(safe).length === 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: safe as Prisma.UserUpdateInput,
  });
}

export async function createUserBanRecord(data: Record<string, unknown>) {
  const safe = pickPrismaModelFields("UserBan", data);
  await prisma.userBan.create({
    data: safe as Prisma.UserBanCreateInput,
  });
}
