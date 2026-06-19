import type { User } from "@supabase/supabase-js";
import { prisma, withDbRetry } from "@/lib/db";
import { logPlatformError } from "@/lib/platform-log";
import { getCachedUserBySupabaseId, invalidateUserSessionCache } from "@/lib/auth-cache";
import { isValidEmail } from "@/lib/email/address";

const userInclude = {
  creatorProfile: true,
  designerProfile: true,
  partnerProfile: true,
  subscriptions: { where: { status: "ACTIVE" as const }, select: { status: true } },
} as const;

export type PrismaAppUser = Awaited<ReturnType<typeof findUserBySupabaseId>>;

async function findUserBySupabaseId(supabaseId: string) {
  return prisma.user.findUnique({
    where: { supabaseId },
    include: userInclude,
  });
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
  let uniqueUsername = base;
  let i = 0;
  while (await prisma.user.findUnique({ where: { username: uniqueUsername } })) {
    uniqueUsername = `${base}${++i}`;
  }
  return uniqueUsername;
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

function buildSessionSyncData(session: User, existing: NonNullable<Awaited<ReturnType<typeof getCachedUserBySupabaseId>>>) {
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
  } = {};

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

/** Upsert app user row from Supabase auth session — safe for OAuth callback + getCurrentUser. */
export async function ensurePrismaUser(session: User) {
  const existing = await withDbRetry(
    () => getCachedUserBySupabaseId(session.id),
    { label: "user:find-supabase" }
  );

  if (existing?.deletedAt) return null;

  const { discordId, discordUsername } = discordFromSession(session);

  if (existing) {
    const syncData = buildSessionSyncData(session, existing);
    if (Object.keys(syncData).length > 0) {
      if (syncData.email) {
        const conflict = await withDbRetry(
          () =>
            prisma.user.findFirst({
              where: {
                email: syncData.email,
                id: { not: existing.id },
                deletedAt: null,
              },
            }),
          { label: "user:email-conflict" }
        );
        if (conflict) {
          delete syncData.email;
          delete syncData.emailVerified;
          delete syncData.emailVerifiedAt;
        }
      }

      if (Object.keys(syncData).length > 0) {
        const updated = await withDbRetry(
          () =>
            prisma.user.update({
              where: { id: existing.id },
              data: syncData,
              include: userInclude,
            }),
          { label: "user:sync-session" }
        );
        invalidateUserSessionCache(session.id);
        return updated;
      }
    }
    return existing;
  }

  const email = sessionEmail(session);
  const byEmail = await withDbRetry(
    () => prisma.user.findUnique({ where: { email } }),
    { label: "user:find-email" }
  );

  if (byEmail && !byEmail.deletedAt) {
    return withDbRetry(
      () =>
        prisma.user.update({
          where: { id: byEmail.id },
          data: {
            supabaseId: session.id,
            ...(discordId ? { discordId } : {}),
            ...(discordUsername ? { discordUsername } : {}),
            avatarUrl: (session.user_metadata?.avatar_url as string | undefined) ?? byEmail.avatarUrl,
            emailVerified: byEmail.emailVerified || !!session.email_confirmed_at,
            ...(session.email_confirmed_at
              ? { emailVerifiedAt: new Date(session.email_confirmed_at) }
              : {}),
          },
          include: userInclude,
        }),
      { label: "user:link-email" }
    );
  }

  if (discordId) {
    const byDiscord = await withDbRetry(
      () => prisma.user.findUnique({ where: { discordId } }),
      { label: "user:find-discord" }
    );
    if (byDiscord && !byDiscord.deletedAt) {
      return withDbRetry(
        () =>
          prisma.user.update({
            where: { id: byDiscord.id },
            data: {
              supabaseId: session.id,
              discordUsername: discordUsername ?? byDiscord.discordUsername,
              avatarUrl: (session.user_metadata?.avatar_url as string | undefined) ?? byDiscord.avatarUrl,
              emailVerified: byDiscord.emailVerified || !!session.email_confirmed_at,
            },
            include: userInclude,
          }),
        { label: "user:link-discord" }
      );
    }
  }

  const username = await withDbRetry(
    () => uniqueUsername(sessionUsernameBase(session)),
    { label: "user:unique-name" }
  );

  try {
    return await withDbRetry(
      () =>
        prisma.user.create({
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
        }),
      { label: "user:create" }
    );
  } catch (err) {
    const raced = await withDbRetry(
      () => findUserBySupabaseId(session.id),
      { label: "user:race-find" }
    );
    if (raced) return raced;
    void logPlatformError("auth:ensure-user", err);
    throw err;
  }
}
