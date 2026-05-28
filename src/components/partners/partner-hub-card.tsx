import Link from "next/link";
import { SafeImage } from "@/components/ui/safe-image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatorLevelBadge } from "@/components/creator/creator-level-badge";
import { SocialLinks } from "@/components/social/social-links";
import { formatDisplayName } from "@/lib/display-name";
import { resolveAssetUrl } from "@/lib/assets";
import type { PublisherLevel, SocialPlatform } from "@prisma/client";

type PartnerCardData = {
  id: string;
  slug: string;
  tagline: string | null;
  affiliateCode: string | null;
  level: PublisherLevel;
  isVerified: boolean;
  isFeatured: boolean;
  followerCount: number;
  totalConversions: number;
  bannerUrl: string | null;
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  socialLinks?: {
    platform: SocialPlatform;
    url: string;
    label?: string | null;
  }[];
};

export function PartnerHubCard({
  locale,
  partner,
  t,
}: {
  locale: string;
  partner: PartnerCardData;
  t: (key: string) => string;
}) {
  const banner = resolveAssetUrl(partner.bannerUrl);
  const avatar = resolveAssetUrl(partner.user.avatarUrl);

  return (
    <Link href={`/${locale}/partners/${partner.slug}`}>
      <Card className="glass overflow-hidden h-full hover:border-neon-blue/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_24px_-4px_rgba(96,165,250,0.25)]">
        <div className="relative h-24 bg-gradient-to-r from-neon-blue/20 to-neon-purple/20">
          {banner && <SafeImage src={banner} alt="" fill className="object-cover opacity-60" sizes="400px" />}
          <div className="absolute -bottom-6 left-4">
            <div className="relative h-14 w-14 rounded-xl overflow-hidden border-2 border-neon-blue/50 bg-background">
              {avatar ? (
                <SafeImage src={avatar} alt="" fill className="object-cover" sizes="56px" />
              ) : (
                <div className="h-full w-full flex items-center justify-center font-bold text-lg">
                  {formatDisplayName(partner.user).slice(0, 1)}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="p-5 pt-8 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{formatDisplayName(partner.user)}</p>
            {partner.isVerified && <Badge variant="premium">{t("verified")}</Badge>}
            {partner.isFeatured && <Badge variant="outline">{t("featured")}</Badge>}
          </div>
          <CreatorLevelBadge level={partner.level} size="xs" />
          <p className="text-sm text-muted-foreground line-clamp-2">{partner.tagline ?? t("partner")}</p>
          {partner.affiliateCode && (
            <p className="text-xs font-mono text-neon-blue">{t("affiliateCode")}: {partner.affiliateCode}</p>
          )}
          <div className="flex gap-4 text-xs text-muted-foreground pt-1">
            <span>{partner.followerCount.toLocaleString()} followers</span>
            <span>{partner.totalConversions} {t("conversions")}</span>
          </div>
          {partner.socialLinks && partner.socialLinks.length > 0 && (
            <SocialLinks links={partner.socialLinks} className="pt-2" />
          )}
        </div>
      </Card>
    </Link>
  );
}
