import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getFollowedCreators } from "@/lib/follows";
import { getInlineBadgesForUsers } from "@/lib/user-badges";
import { Card } from "@/components/ui/card";
import { SafeImage } from "@/components/ui/safe-image";
import { AchievementBadge } from "@/components/achievements/achievement-badge";
import { formatDisplayName } from "@/lib/display-name";
import { resolveAssetUrl } from "@/lib/assets";
import type { Locale } from "@/i18n/config";

export default async function FollowingPage({ params: { locale } }: { params: { locale: Locale } }) {
  const user = await requireAuth(`/${locale}/login`);
  const followed = await getFollowedCreators(user.id);
  const badgeMap = await getInlineBadgesForUsers(
    followed.map((c) => c.id),
    locale
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Following</h1>
        <p className="text-muted-foreground">Creators you follow</p>
      </div>
      {followed.length === 0 ? (
        <Card className="glass p-8 text-center text-muted-foreground">
          You are not following any creators yet.{" "}
          <Link href={`/${locale}/creators`} className="text-neon-purple hover:underline">
            Discover creators
          </Link>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {followed.map((c) => {
            const badges = badgeMap.get(c.id) ?? [];
            return (
              <Link key={c.id} href={`/${locale}/creators/${c.creatorProfile!.slug}`}>
                <Card className="glass p-4 flex items-center gap-3 hover:border-neon-purple/40 transition-colors">
                  <div className="relative h-12 w-12 rounded-xl overflow-hidden shrink-0">
                    <SafeImage
                      src={resolveAssetUrl(c.avatarUrl)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{formatDisplayName(c)}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.creatorProfile?.tagline}</p>
                    {badges.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {badges.map((b) => (
                          <AchievementBadge
                            key={b.id}
                            name={b.name}
                            description={b.description}
                            icon={b.icon}
                            rarity={b.rarity}
                            animated={b.animated}
                            glowEffect={b.glowEffect}
                            unlockedAt={b.unlockedAt}
                            size="sm"
                            className="scale-75 origin-left"
                          />
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-neon-purple mt-1">
                      {c.creatorProfile?.followerCount.toLocaleString()} followers
                    </p>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
