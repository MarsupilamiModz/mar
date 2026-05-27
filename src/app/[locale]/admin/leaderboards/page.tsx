import { requireAdmin } from "@/lib/auth";
import { getAdminLeaderboardConfig } from "@/actions/admin/leaderboards";
import { LeaderboardsAdminPanel } from "@/components/admin/leaderboards-admin-panel";

export default async function AdminLeaderboardsPage() {
  await requireAdmin();
  const result = await getAdminLeaderboardConfig();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Leaderboard Management</h1>
      <p className="mt-1 text-sm text-muted-foreground">Ranking weights, featured creators, and pinned spots.</p>
      <div className="mt-8">
        <LeaderboardsAdminPanel weights={result.data.weights} pinned={result.data.pinned} />
      </div>
    </div>
  );
}
