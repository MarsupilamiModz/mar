import { Suspense } from "react";
import { safeToLocaleString, getIntlLocale } from "@/lib/i18n/safe-locale";
import { requireAuth, hasPremiumAccess } from "@/lib/auth";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Heart, Crown, Trophy } from "lucide-react";
import { evaluateUserAchievements } from "@/lib/achievements";
import { syncCreatorRanks } from "@/lib/leaderboards";
import { formatDisplayName } from "@/lib/display-name";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { getUserMembershipState } from "@/lib/user-membership";
import Link from "next/link";
import { DashboardRecommendations } from "@/components/mods/mod-recommendations";

async function DashboardStats({
  userId,
  isPremium,
}: {
  userId: string;
  isPremium: boolean;
}) {
  const t = await getTranslations("dashboard");
  const stats = await getDashboardStats(userId);

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("downloads")}</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.downloads}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("favorites")}</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.favorites}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("premium")}</CardTitle>
            <Crown className="h-4 w-4 text-neon-purple" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isPremium ? t("active") : t("free")}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("level")}</CardTitle>
            <Trophy className="h-4 w-4 text-neon-blue" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Lv.{stats.progress?.level ?? 1}</p>
            <p className="text-xs text-muted-foreground">{safeToLocaleString(stats.progress?.xp ?? 0)} XP</p>
          </CardContent>
        </Card>
      </div>

      {stats.unreadNotifications > 0 && (
        <Card className="glass mt-6 border-neon-blue/30">
          <CardContent className="py-4 text-sm">
            You have <strong>{stats.unreadNotifications}</strong> {t("notifications").toLowerCase()}.
          </CardContent>
        </Card>
      )}
    </>
  );
}

function StatsSkeleton() {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="glass h-24 animate-pulse" />
      ))}
    </div>
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const user = await requireAuth();
  void Promise.all([evaluateUserAchievements(user.id), syncCreatorRanks()]).catch(() => undefined);

  const isPremium = hasPremiumAccess(user);
  const membership = await getUserMembershipState(user.id);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("welcome", { name: formatDisplayName(user) })}</p>

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats userId={user.id} isPremium={isPremium} />
      </Suspense>

      {membership.membershipType !== "FREE" && (
        <Card className="glass mt-8">
          <CardContent className="py-4 text-sm flex flex-wrap items-center justify-between gap-2">
            <span>
              Plan: <strong>{membership.planSlug ?? membership.membershipType}</strong>
              {membership.renewalDate && (
                <> · Renews {new Date(membership.renewalDate).toLocaleDateString(getIntlLocale(locale))}</>
              )}
            </span>
            <Link href={`/${locale}/dashboard/subscription`} className="text-neon-purple hover:underline text-sm">
              Manage subscription
            </Link>
          </CardContent>
        </Card>
      )}

      <Suspense fallback={null}>
        <DashboardRecommendations userId={user.id} locale={locale} />
      </Suspense>
    </div>
  );
}
