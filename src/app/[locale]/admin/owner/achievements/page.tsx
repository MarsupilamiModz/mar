import { requireOwner } from "@/lib/auth";
import { getAchievementAnalytics, getAdminAchievements } from "@/actions/admin/achievements";
import { getOwnerSoundAnalytics } from "@/actions/sounds";
import { OwnerAchievementsPanel } from "@/components/admin/owner-achievements-panel";

export const dynamic = "force-dynamic";

export default async function OwnerAchievementsPage() {
  await requireOwner();
  const [analytics, achievements, soundAnalytics] = await Promise.all([
    getAchievementAnalytics(),
    getAdminAchievements(),
    getOwnerSoundAnalytics(),
  ]);
  if (!analytics.success || !achievements.success) {
    return <p className="text-destructive">Failed to load achievements data.</p>;
  }

  return (
    <OwnerAchievementsPanel
      analytics={analytics.data}
      achievements={achievements.data}
      soundAnalytics={soundAnalytics.success ? soundAnalytics.data : null}
    />
  );
}
