import { notFound } from "next/navigation";
import { SafeImage } from "@/components/ui/safe-image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { ModCard } from "@/components/mods/mod-card";
import { CreatorLevelBadge } from "@/components/creator/creator-level-badge";
import { SocialLinks } from "@/components/social/social-links";
import { ProfileShowcase } from "@/components/achievements/profile-showcase";
import { CreatorRankBadge } from "@/components/leaderboards/creator-rank-badge";
import { getShowcasedAchievements } from "@/lib/achievements";
import { getUserMembershipTier } from "@/lib/membership";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { REVALIDATE } from "@/lib/cache";
import { AdLocationSlot } from "@/components/ads/ad-location-slot";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";
import { FollowButton } from "@/components/creator/follow-button";
import { formatDisplayName } from "@/lib/display-name";

export const revalidate = REVALIDATE.catalog;

export async function generateMetadata({
  params: { slug },
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const profile = await prisma.creatorProfile.findUnique({
    where: { slug },
    include: { user: { select: { displayName: true, username: true } } },
  });
  if (!profile) return { title: "Creator" };
  return {
    title: `${profile.user.displayName ?? profile.user.username} | Creator`,
    description: profile.tagline ?? profile.description?.slice(0, 160),
  };
}

export default async function CreatorProfilePage({
  params: { locale, slug },
}: {
  params: { locale: Locale; slug: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");

  const profile = await prisma.creatorProfile.findUnique({
    where: { slug, isSuspended: false, isPublic: true },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      socialLinks: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!profile) notFound();

  const [mods, showcased, membershipTier] = await Promise.all([
    prisma.mod.findMany({
      where: { authorId: profile.userId, status: "PUBLISHED", visibility: "PUBLIC" },
      orderBy: [{ isFeatured: "desc" }, { downloadCount: "desc" }],
      take: 12,
      include: {
        game: { select: { name: true, slug: true } },
        media: { orderBy: [{ isFeatured: "desc" }, { orderIndex: "asc" }] },
        screenshots: { take: 1, orderBy: { sortOrder: "asc" } },
        tags: { take: 3 },
      },
    }),
    getShowcasedAchievements(profile.userId, locale),
    getUserMembershipTier(profile.userId),
  ]);

  return (
    <div>
      <section className="relative border-b border-border/40 overflow-hidden">
        {profile.bannerUrl && (
          <div className="absolute inset-0 opacity-25">
            <SafeImage src={profile.bannerUrl} alt="" fill className="object-cover" priority sizes="100vw" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-neon-purple/10 to-background" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-start gap-5">
            {profile.user.avatarUrl ? (
              <div className="relative h-24 w-24 rounded-2xl overflow-hidden border-2 border-neon-purple/40 shadow-neon">
                <SafeImage src={profile.user.avatarUrl} alt="" fill className="object-cover" sizes="96px" />
              </div>
            ) : null}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <CreatorLevelBadge level={profile.level} size="md" />
                <CreatorRankBadge tier={profile.rankTier} size="sm" />
                {profile.isFeatured && <Badge variant="outline">{t("featured")}</Badge>}
              </div>
              <h1 className="text-3xl font-bold">{formatDisplayName(profile.user)}</h1>
              <div className="mt-3">
                <FollowButton followingUserId={profile.userId} profileType="creator" locale={locale} />
              </div>
              {profile.tagline && <p className="text-muted-foreground mt-1">{profile.tagline}</p>}
              {profile.creatorCode && (
                <p className="text-sm mt-2 font-mono text-neon-purple">{t("creatorCode")}: {profile.creatorCode}</p>
              )}
              <SocialLinks links={profile.socialLinks} className="mt-4" />
              <div className="mt-4 max-w-md">
                <ProfileShowcase
                  achievements={showcased}
                  rankTier={profile.rankTier}
                  supporterLabel={membershipTier?.name ?? null}
                />
              </div>
            </div>
            <Card className="glass p-4 min-w-[140px] text-center">
              <p className="text-2xl font-bold">{profile.totalDownloads.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{t("downloads")}</p>
              <p className="text-lg font-semibold mt-2">{profile.followerCount}</p>
              <p className="text-xs text-muted-foreground">{t("followers")}</p>
            </Card>
          </div>
        </div>
      </section>

      {profile.description && (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Card className="glass p-6">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{profile.description}</p>
          </Card>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <AdLocationSlot location="creator" className="mb-6" />
        <h2 className="text-xl font-bold mb-6">{t("uploads")}</h2>
        {mods.length === 0 ? (
          <p className="text-muted-foreground">{t("noMods")}</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {mods.map((mod) => (
              <ModCard key={mod.id} locale={locale} mod={mod} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
