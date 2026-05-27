import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCreatorAnalytics, getUserCommissionSummary } from "@/lib/analytics/ecosystem";
import { formatCents } from "@/lib/affiliate";
import type { Locale } from "@/i18n/config";

export default async function CreatorPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const tc = await getTranslations("creator");
  const user = await requireAuth();

  const [mods, profile, analytics, commission] = await Promise.all([
    prisma.mod.findMany({
      where: { authorId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { game: true, _count: { select: { versions: true } } },
    }),
    prisma.creatorProfile.findUnique({ where: { userId: user.id } }),
    getCreatorAnalytics(user.id).catch(() => null),
    getUserCommissionSummary(user.id).catch(() => ({
      pendingCents: 0,
      pendingCount: 0,
      paidCents: 0,
      paidCount: 0,
      payouts: [],
    })),
  ]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{tc("myMods")}</p>
          <p className="text-2xl font-bold">{mods.length}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{t("downloads")}</p>
          <p className="text-2xl font-bold">{analytics?.totalDownloads ?? 0}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{t("revenue")}</p>
          <p className="text-2xl font-bold">{formatCents(analytics?.purchaseRevenue ?? 0, locale)}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{t("pendingPayout")}</p>
          <p className="text-2xl font-bold">{formatCents(commission.pendingCents, locale)}</p>
        </Card>
      </div>

      {profile?.creatorCode && (
        <Card className="glass p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t("creatorCode")}</p>
            <p className="font-mono text-lg text-neon-purple">{profile.creatorCode}</p>
          </div>
          {profile.isVerified && <Badge variant="premium">{t("verified")}</Badge>}
        </Card>
      )}

      <div className="space-y-2">
        {mods.length === 0 ? (
          <Card className="glass p-8 text-center">
            <p className="text-muted-foreground">{t("noMods")}</p>
            <Button variant="neon" className="mt-4" asChild>
              <Link href={`/${locale}/creator/mods/new`}>{tc("createMod")}</Link>
            </Button>
          </Card>
        ) : (
          mods.map((m) => (
            <Card key={m.id} className="glass p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {m.game.name} · {m._count.versions} versions · {m.downloadCount} downloads
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{m.status}</Badge>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/${locale}/creator/mods/${m.id}`}>{tc("manageMod")}</Link>
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
