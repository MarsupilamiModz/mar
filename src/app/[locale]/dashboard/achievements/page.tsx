import { requireAuth } from "@/lib/auth";
import { evaluateUserAchievements, getUserAchievements, getUserProgress } from "@/lib/achievements";
import { AchievementShowcasePanel } from "@/components/dashboard/achievement-showcase-panel";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export default async function AchievementsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const user = await requireAuth(`/${locale}/dashboard/achievements`);
  void evaluateUserAchievements(user.id).catch(() => undefined);

  const [achievements, progress] = await Promise.all([
    getUserAchievements(user.id, locale),
    getUserProgress(user.id),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("achievementsTitle")}</h1>
      <p className="text-muted-foreground mt-1">{t("achievementsSubtitle")}</p>
      <div className="mt-8">
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
    </div>
  );
}
