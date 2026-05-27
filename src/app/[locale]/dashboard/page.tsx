import { requireAuth, hasPremiumAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Heart, Crown, Trophy, Coins } from "lucide-react";
import { evaluateUserAchievements } from "@/lib/achievements";
import { syncCreatorRanks } from "@/lib/leaderboards";
import { getWalletBalance, formatCredits, getCreditHistory } from "@/lib/credits";
import { formatDisplayName } from "@/lib/display-name";
import { CreditHistoryPanel } from "@/components/dashboard/credit-history-panel";

export default async function DashboardPage() {
  const user = await requireAuth();
  await Promise.all([evaluateUserAchievements(user.id), syncCreatorRanks()]);
  const [downloads, favorites, notifications, progress, creditBalance, creditWallet] = await Promise.all([
    prisma.download.count({ where: { userId: user.id } }),
    prisma.modFavorite.count({ where: { userId: user.id } }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
    prisma.userProgress.findUnique({ where: { userId: user.id } }),
    getWalletBalance(user.id),
    getCreditHistory(user.id, 8),
  ]);

  const isPremium = hasPremiumAccess(user);

  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Welcome back, {formatDisplayName(user)}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{downloads}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Favorites</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{favorites}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Premium</CardTitle>
            <Crown className="h-4 w-4 text-neon-purple" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{isPremium ? "Active" : "Free"}</p>
          </CardContent>
        </Card>
        <Card className="glass border-neon-purple/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Credits</CardTitle>
            <Coins className="h-4 w-4 text-neon-purple" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gradient">{formatCredits(creditBalance)}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Level</CardTitle>
            <Trophy className="h-4 w-4 text-neon-blue" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">Lv.{progress?.level ?? 1}</p>
            <p className="text-xs text-muted-foreground">{(progress?.xp ?? 0).toLocaleString()} XP</p>
          </CardContent>
        </Card>
      </div>

      {notifications > 0 && (
        <Card className="glass mt-6 border-neon-blue/30">
          <CardContent className="pt-6">
            <p className="text-sm">You have {notifications} unread notifications.</p>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <CreditHistoryPanel
          balance={creditBalance}
          transactions={creditWallet?.transactions ?? []}
          locale={user.locale}
        />
      </div>
    </div>
  );
}
