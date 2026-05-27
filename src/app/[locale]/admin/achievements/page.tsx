import { requireAdmin } from "@/lib/auth";
import { getAdminAchievements } from "@/actions/admin/achievements";
import { AchievementsAdminPanel } from "@/components/admin/achievements-admin-panel";

export default async function AdminAchievementsPage() {
  await requireAdmin();
  const result = await getAdminAchievements();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Achievements Management</h1>
      <p className="mt-1 text-sm text-muted-foreground">Badges, XP rewards, unlock rules, and seasonal events.</p>
      <div className="mt-8">
        <AchievementsAdminPanel achievements={result.data} />
      </div>
    </div>
  );
}
