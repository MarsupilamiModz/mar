import type { User } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import { prisma, withDbRetry } from "@/lib/db";
import { logPlatformError } from "@/lib/platform-log";
import { invalidateUserSessionCache, getCachedUserBySupabaseId, fetchUserBySupabaseIdDirect, type AppUser } from "@/lib/auth-cache";
import { isValidEmail } from "@/lib/email/address";

const userInclude = {
  creatorProfile: true,
  designerProfile: true,
  partnerProfile: true,
  subscriptions: { where: { status: "ACTIVE" as const }, select: { status: true } },
} as const;

export type PrismaAppUser = AppUser;

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function findUserBySupabaseId(supabaseId: string) {
  return getCachedUserBySupabaseId(supabaseId);
}

/** Direct DB lookup — use in auth recovery paths (never cached). */
export async function findAppUserBySupabaseId(supabaseId: string) {
  return withDbRetry(
    () => fetchUserBySupabaseIdDirect(supabaseId),
    { label: "user:find-supabase-direct" }
  );
}

function sessionEmail(session: User): string {
  return (
    session.email?.trim() ||
    session.user_metadata?.email?.trim() ||
    `${session.id}@auth.local`
  );
}

function sessionUsernameBase(session: User): string {
  const raw =
    session.user_metadata?.preferred_username ??
    session.user_metadata?.full_name ??
    session.user_metadata?.name ??
    session.email?.split("@")[0] ??
    `user_${session.id.slice(0, 8)}`;
  const base = String(raw).replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
  return base || "user";
}

async function uniqueUsername(base: string) {
  let candidate = base;
  let i = 0;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${++i}`;
  }
  return candidate;
}

function discordFromSession(session: User) {
  const providerId =
    session.user_metadata?.provider_id ??
    session.user_metadata?.sub ??
    session.identities?.find((id) => id.provider === "discord")?.id;
  const discordUsername =
    session.user_metadata?.full_name ??
    session.user_metadata?.name ??
    session.user_metadata?.preferred_username ??
    null;
  return {
    discordId: providerId ? String(providerId) : null,
    discordUsername: discordUsername ? String(discordUsername) : null,
  };
}

function buildSessionSyncData(
  session: User,
  existing: NonNullable<Awaited<ReturnType<typeof findUserBySupabaseId>>>
) {
  const email = sessionEmail(session);
  const sessionVerified = !!session.email_confirmed_at;
  const { discordId, discordUsername } = discordFromSession(session);

  const data: {
    email?: string;
    emailVerified?: boolean;
    emailVerifiedAt?: Date | null;
    discordId?: string;
    discordUsername?: string;
    avatarUrl?: string;
    supabaseId?: string;
  } = {};

  if (existing.supabaseId !== session.id) {
    data.supabaseId = session.id;
  }

  if (isValidEmail(email) && email !== existing.email) {
    data.email = email;
    data.emailVerified = sessionVerified;
    data.emailVerifiedAt = session.email_confirmed_at
      ? new Date(session.email_confirmed_at)
      : null;
  } else if (sessionVerified && !existing.emailVerified) {
    data.emailVerified = true;
    data.emailVerifiedAt = session.email_confirmed_at
      ? new Date(session.email_confirmed_at)
      : new Date();
  }

  if (discordId && existing.discordId !== discordId) data.discordId = discordId;
  if (discordUsername && existing.discordUsername !== discordUsername) {
    data.discordUsername = discordUsername;
  }
  if (session.user_metadata?.avatar_url && existing.avatarUrl !== session.user_metadata.avatar_url) {
    data.avatarUrl = session.user_metadata.avatar_url as string;
  }

  return data;
}

async function syncExistingUser(session: User, existing: NonNullable<Awaited<ReturnType<typeof findUserBySupabaseId>>>) {
  const syncData = buildSessionSyncData(session, existing);
  if (Object.keys(syncData).length === 0) return existing;

  if (syncData.email) {
    const conflict = await prisma.user.findFirst({
      where: {
        email: syncData.email,
        id: { not: existing.id },
        deletedAt: null,
      },
    });
    if (conflict) {
      delete syncData.email;
      delete syncData.emailVerified;
      delete syncData.emailVerifiedAt;
    }
  }

  if (Object.keys(syncData).length === 0) return existing;

  try {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: syncData,
      include: userInclude,
    });
    invalidateUserSessionCache(session.id);
    if (existing.supabaseId && existing.supabaseId !== session.id) {
      invalidateUserSessionCache(existing.supabaseId);
    }
    return updated;
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const bySupabase = await findAppUserBySupabaseId(session.id);
      if (bySupabase && !bySupabase.deletedAt) return bySupabase;
    }
    throw err;
  }
}

async function resolveExistingAccount(session: User) {
  const bySupabase = await findUserBySupabaseId(session.id);
  if (bySupabase) return bySupabase;

  const email = sessionEmail(session);
  let linkedId: string | null = null;

  if (isValidEmail(email)) {
    const byEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true, deletedAt: true },
    });
    if (byEmail && !byEmail.deletedAt) linkedId = byEmail.id;
  }

  if (!linkedId) {
    const { discordId } = discordFromSession(session);
    if (discordId) {
      const byDiscord = await prisma.user.findUnique({
        where: { discordId },
        select: { id: true, deletedAt: true },
      });
      if (byDiscord && !byDiscord.deletedAt) linkedId = byDiscord.id;
    }
  }

  if (!linkedId) return null;

  return prisma.user.findUnique({
    where: { id: linkedId },
    include: userInclude,
  });
}

async function createAppUser(session: User) {
  const email = sessionEmail(session);
  const { discordId, discordUsername } = discordFromSession(session);
  const username = await uniqueUsername(sessionUsernameBase(session));

  return prisma.user.create({
    data: {
      supabaseId: session.id,
      email,
      username,
      displayName:
        (session.user_metadata?.full_name as string | undefined) ??
        (session.user_metadata?.name as string | undefined) ??
        username,
      avatarUrl: session.user_metadata?.avatar_url as string | undefined,
      emailVerified: !!session.email_confirmed_at,
      emailVerifiedAt: session.email_confirmed_at
        ? new Date(session.email_confirmed_at)
        : null,
      discordId,
      discordUsername,
    },
    include: userInclude,
  });
}

/** Upsert app user row from Supabase auth session — safe for OAuth callback + getCurrentUser. */
export async function ensurePrismaUser(session: User) {
  const existing = await withDbRetry(
    () => resolveExistingAccount(session),
    { label: "user:resolve-account" }
  );

  if (existing?.deletedAt) return null;

  if (existing) {
    return withDbRetry(() => syncExistingUser(session, existing), { label: "user:sync-session" });
  }

  try {
    const created = await withDbRetry(() => createAppUser(session), { label: "user:create" });
    invalidateUserSessionCache(session.id);
    return created;
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      const raced = await withDbRetry(
        () => findAppUserBySupabaseId(session.id),
        { label: "user:race-find" }
      );
      if (raced && !raced.deletedAt) {
        return syncExistingUser(session, raced);
      }
    }
    void logPlatformError("auth:ensure-user", err);
    throw err;
  }
}
