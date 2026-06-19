import { getAdminAnalytics } from "@/actions/admin/analytics";
import { safeToLocaleString, safeToLocaleDateString, getIntlLocale } from "@/lib/i18n/safe-locale";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaff } from "@/lib/auth";
export default async function AdminAnalyticsPage() {
  await requireStaff();
  const result = await getAdminAnalytics();
  const data = result.success ? result.data : null;

  const [topGames, topMods, downloadCount] = await Promise.all([
    prisma.game.findMany({
      where: { isActive: true },
      orderBy: { mods: { _count: "desc" } },
      take: 5,
      include: { _count: { select: { mods: true } } },
    }),
    prisma.mod.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { downloadCount: "desc" },
      take: 10,
      select: { title: true, downloadCount: true, slug: true },
    }),
    prisma.download.count(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="mt-1 text-sm text-muted-foreground">Platform metrics and trends</p>

      {data && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total users", value: data.totalUsers },
            { label: "Premium users", value: data.premiumUsers },
            { label: "Active subs", value: data.activeSubscriptions },
            { label: "Total downloads", value: downloadCount },
            { label: "Open tickets", value: data.openTickets },
            { label: "Revenue (30d)", value: `$${data.revenue30d.toFixed(0)}` },
          ].map((s) => (
            <Card key={s.label} className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Top games by mod count</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {topGames.map((g) => (
              <div key={g.id} className="flex justify-between">
                <span>{g.name}</span>
                <span className="text-muted-foreground">{g._count.mods} mods</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Top mods by downloads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {topMods.map((m) => (
              <div key={m.slug} className="flex justify-between">
                <span className="line-clamp-1">{m.title}</span>
                <span className="text-muted-foreground shrink-0 ml-2">
                  {safeToLocaleString(m.downloadCount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
