import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CACHE_TAGS } from "@/lib/cache";
import { locales } from "@/i18n/config";
import { invalidateUserSessionCache } from "@/lib/auth-cache";

/** Invalidate caches after profile media uploads (avatar, banner, logo). */
export async function revalidateProfileMedia(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      supabaseId: true,
      username: true,
      creatorProfile: { select: { slug: true } },
      partnerProfile: { select: { slug: true } },
      designerProfile: { select: { slug: true } },
    },
  });
  if (!user) return;

  if (user.supabaseId) {
    invalidateUserSessionCache(user.supabaseId);
  }
  revalidateTag(CACHE_TAGS.user(userId));
  revalidateTag(CACHE_TAGS.creators);
  revalidateTag(CACHE_TAGS.partners);
  revalidatePath("/", "layout");

  for (const locale of locales) {
    revalidatePath(`/${locale}/dashboard/settings`);
    revalidatePath(`/${locale}/creators`);
    revalidatePath(`/${locale}/partners`);
    revalidatePath(`/${locale}/team`);

    if (user.creatorProfile?.slug) {
      revalidatePath(`/${locale}/creators/${user.creatorProfile.slug}`);
      revalidatePath(`/${locale}/creator/settings`);
    }
    if (user.partnerProfile?.slug) {
      revalidatePath(`/${locale}/partners/${user.partnerProfile.slug}`);
      revalidatePath(`/${locale}/partner/settings`);
    }
    if (user.designerProfile) {
      revalidatePath(`/${locale}/designer/settings`);
    }
    revalidatePath(`/${locale}/creators/${user.username}`);
  }
}

export async function revalidateTeamMemberMedia(teamMemberId: string) {
  revalidatePath("/", "layout");
  for (const locale of locales) {
    revalidatePath(`/${locale}/admin/team`);
    revalidatePath(`/${locale}/team`);
  }
  revalidateTag(`team-member-${teamMemberId}`);
}

export async function revalidateGameMedia(slug: string) {
  revalidateTag(CACHE_TAGS.games);
  revalidateTag(`game-${slug}`);
  for (const locale of locales) {
    revalidatePath(`/${locale}/games/${slug}`);
    revalidatePath(`/${locale}/admin/games`);
  }
}
