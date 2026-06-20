import { notFound } from "next/navigation";
import { safeToLocaleString } from "@/lib/i18n/safe-locale";
import { SafeImage } from "@/components/ui/safe-image";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/db";
import { SocialLinks } from "@/components/social/social-links";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { REVALIDATE } from "@/lib/cache";
import { formatDisplayName } from "@/lib/display-name";
import { FollowButton } from "@/components/creator/follow-button";
import { CreatorLevelBadge } from "@/components/creator/creator-level-badge";
import { getAppUrl } from "@/lib/app-url";
import { getShowcasedAchievements } from "@/lib/achievements";
import { ProfileShowcase } from "@/components/achievements/profile-showcase";
import { PartnerDiscordEmbed } from "@/components/partners/partner-discord-embed";
import type { Locale } from "@/i18n/config";

export const revalidate = REVALIDATE.catalog;

export default async function PartnerProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");

  const profile = await prisma.partnerProfile.findUnique({
    where: { slug, isBanned: false, isSuspended: false },
    include: {
      user: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
      socialLinks: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!profile) notFound();

  const showcased = await getShowcasedAchievements(profile.userId, locale);

  const referralLink = profile.affiliateCode
    ? `${getAppUrl()}/${locale}?ref=${profile.affiliateCode}`
    : null;

  return (
    <div>
      <section className="relative border-b border-border/40 overflow-hidden">
        {profile.bannerUrl && (
          <div className="absolute inset-0 opacity-25">
            <SafeImage src={profile.bannerUrl} alt="" fill className="object-cover" priority sizes="100vw" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-neon-blue/10 to-background" />
        <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-start gap-5">
            <UserAvatar
              src={profile.user.avatarUrl}
              name={formatDisplayName(profile.user)}
              className="h-24 w-24 rounded-2xl border-2 border-neon-blue/40"
            />
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-2">
                <CreatorLevelBadge level={profile.level} size="sm" />
                {profile.isVerified && <Badge variant="premium">{t("verified")}</Badge>}
                {profile.isFeatured && <Badge variant="outline">{t("featured")}</Badge>}
              </div>
              <h1 className="text-3xl font-bold">{formatDisplayName(profile.user)}</h1>
              {profile.tagline && <p className="text-muted-foreground mt-1">{profile.tagline}</p>}
              {profile.affiliateCode && (
                <p className="text-sm mt-2 font-mono text-neon-blue">{t("affiliateCode")}: {profile.affiliateCode}</p>
              )}
              {referralLink && (
                <p className="text-xs mt-2 text-muted-foreground break-all">
                  {t("referralLink")}: <span className="text-neon-blue">{referralLink}</span>
                </p>
              )}
              <div className="mt-3">
                <FollowButton followingUserId={profile.userId} profileType="partner" locale={locale} />
              </div>
              <SocialLinks links={profile.socialLinks} className="mt-4" />
            </div>
            <Card className="glass p-4 text-center min-w-[160px]">
              <p className="text-2xl font-bold">{safeToLocaleString(profile.followerCount)}</p>
              <p className="text-xs text-muted-foreground">{t("followers")}</p>
              <p className="text-2xl font-bold mt-3">{profile.totalConversions}</p>
              <p className="text-xs text-muted-foreground">{t("conversions")}</p>
            </Card>
          </div>
        </div>
      </section>
      {(showcased.length > 0 || profile.description) && (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
          {showcased.length > 0 && <ProfileShowcase achievements={showcased} />}
          {profile.description && (
          <Card className="glass p-6">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{profile.description}</p>
          </Card>
          )}
          {(profile.discordInviteUrl || profile.discordWidgetUrl) && (
            <PartnerDiscordEmbed
              inviteUrl={profile.discordInviteUrl}
              widgetUrl={profile.discordWidgetUrl}
            />
          )}
        </div>
      )}
    </div>
  );
}
