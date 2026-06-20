import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";

export const authUserInclude = {
  creatorProfile: true,
  designerProfile: true,
  partnerProfile: true,
  subscriptions: { where: { status: "ACTIVE" as const }, select: { status: true } },
} as const;

export type AppUser = Prisma.UserGetPayload<{ include: typeof authUserInclude }>;
export type CurrentAppUser = AppUser & { isBanned?: boolean };

/** Uncached Prisma lookup — use for auth recovery paths only. */
export async function fetchUserBySupabaseIdDirect(supabaseId: string) {
  return prisma.user.findUnique({
    where: { supabaseId },
    include: authUserInclude,
  });
}

export function getCachedUserBySupabaseId(supabaseId: string) {
  return unstable_cache(
    async () => fetchUserBySupabaseIdDirect(supabaseId),
    [`user-supabase-${supabaseId}`],
    {
      revalidate: REVALIDATE.authProfile,
      tags: [CACHE_TAGS.userSession(supabaseId)],
    }
  )();
}

export function invalidateUserSessionCache(supabaseId: string) {
  revalidateTag(CACHE_TAGS.userSession(supabaseId));
  revalidateTag(CACHE_TAGS.permissions);
}
