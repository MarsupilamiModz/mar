import { getPopularTags } from "@/lib/discovery";
import { getTrustCenterStats } from "@/actions/admin/trust";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DiscoveryAdminPage() {
  await requirePagePermission("settings.write");

  const [tags, stats, recentSearches, depCount] = await Promise.all([
    getPopularTags(50),
    getTrustCenterStats(),
    prisma.searchQueryLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.modDependency.count(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Discovery Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tags, search analytics, recommendation performance, and dependency overview
        </p>
      </div>

      {stats.success && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="glass">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Search queries (30d)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.data.searchQueries}</p></CardContent>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recommendation clicks (30d)</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{stats.data.recommendationClicks}</p></CardContent>
          </Card>
          <Card className="glass">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Mod dependencies</CardTitle></CardHeader>
            <CardContent><p className="text-2xl font-bold">{depCount}</p></CardContent>
          </Card>
        </div>
      )}

      <Card className="glass">
        <CardHeader><CardTitle className="text-sm">Popular tags</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Badge key={t.name} variant="outline">{t.name} ({t.count})</Badge>
          ))}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle className="text-sm">Recent searches</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {recentSearches.map((s) => (
              <li key={s.id} className="flex justify-between border-b border-border/30 pb-1">
                <span>{s.query || "(browse)"}</span>
                <span className="text-muted-foreground">{s.resultCount} results</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
