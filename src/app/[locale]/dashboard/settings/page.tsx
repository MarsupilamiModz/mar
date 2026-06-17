import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { AchievementShowcasePanel } from "@/components/dashboard/achievement-showcase-panel";
import { evaluateUserAchievements, getUserAchievements, getUserProgress } from "@/lib/achievements";
import type { Locale } from "@/i18n/config";

export default async function SettingsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const user = await requireAuth(`/${locale}/login`);
  await evaluateUserAchievements(user.id);

  const [creatorProfile, achievements, progress] = await Promise.all([
    prisma.creatorProfile.findUnique({ where: { userId: user.id } }),
    getUserAchievements(user.id, locale),
    getUserProgress(user.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="mt-6">
          <SettingsForm
            locale={locale}
            user={{
              id: user.id,
              username: user.username,
              email: user.email,
              displayName: user.displayName,
              bio: user.bio,
              avatarUrl: user.avatarUrl,
              locale: user.locale,
              discordId: user.discordId,
              role: user.role,
              hasCreatorProfile: !!creatorProfile,
            }}
          />
        </div>
      </div>
      <AchievementShowcasePanel
        achievements={achievements.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          rarity: a.rarity,
          animated: a.animated,
          glowEffect: a.glowEffect,
          unlockedAt: a.unlockedAt,
          isShowcased: a.isShowcased,
          showcaseOrder: a.showcaseOrder,
        }))}
        xp={progress?.xp ?? 0}
        level={progress?.level ?? 1}
      />
    </div>
  );
}
