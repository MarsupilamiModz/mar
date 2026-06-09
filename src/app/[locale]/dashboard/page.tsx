import { Suspense } from "react";
import { requireAuth, hasPremiumAccess } from "@/lib/auth";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Heart, Crown, Trophy, Coins } from "lucide-react";
import { evaluateUserAchievements } from "@/lib/achievements";
import { syncCreatorRanks } from "@/lib/leaderboards";
import { getCreditHistory, formatCredits } from "@/lib/credits";
import { formatDisplayName } from "@/lib/display-name";
import { CreditHistoryPanel } from "@/components/dashboard/credit-history-panel";
import { getDashboardStats } from "@/lib/dashboard-stats";

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
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <Card className="glass border-neon-purple/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("credits")}</CardTitle>
            <Coins className="h-4 w-4 text-neon-purple" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gradient">{formatCredits(stats.creditBalance)}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("level")}</CardTitle>
            <Trophy className="h-4 w-4 text-neon-blue" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Lv.{stats.progress?.level ?? 1}</p>
            <p className="text-xs text-muted-foreground">{(stats.progress?.xp ?? 0).toLocaleString()} XP</p>
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
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="glass h-24 animate-pulse" />
      ))}
    </div>
  );
}

export default async function DashboardPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");
  const user = await requireAuth();
  void Promise.all([evaluateUserAchievements(user.id), syncCreatorRanks()]).catch(() => undefined);

  const isPremium = hasPremiumAccess(user);
  const [creditWallet, stats] = await Promise.all([
    getCreditHistory(user.id, 8),
    getDashboardStats(user.id),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("welcome", { name: formatDisplayName(user) })}</p>

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats userId={user.id} isPremium={isPremium} />
      </Suspense>

      <div className="mt-8">
        <CreditHistoryPanel
          balance={creditWallet?.balance ?? stats.creditBalance}
          transactions={creditWallet?.transactions ?? []}
          locale="en"
        />
      </div>
    </div>
  );
}
