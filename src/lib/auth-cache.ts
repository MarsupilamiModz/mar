import { unstable_cache } from "next/cache";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CACHE_TAGS, REVALIDATE } from "@/lib/cache";

const userInclude = {
  creatorProfile: true,
  designerProfile: true,
  partnerProfile: true,
  subscriptions: { where: { status: "ACTIVE" as const }, select: { status: true } },
} as const;

export function getCachedUserBySupabaseId(supabaseId: string) {
  return unstable_cache(
    async () =>
      prisma.user.findUnique({
        where: { supabaseId },
        include: userInclude,
      }),
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
