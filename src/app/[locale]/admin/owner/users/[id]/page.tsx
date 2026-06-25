import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { getOwnerUserDetail } from "@/actions/admin/owner-users";
import { getUserAchievementsAdmin, getAdminAchievements } from "@/actions/admin/achievements";
import { OwnerUserDetailPanel } from "@/components/admin/owner-user-detail-panel";

export const dynamic = "force-dynamic";

export default async function OwnerUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  await requireOwner();
  const { locale, id } = await params;

  const [result, userAchievements, allAchievements] = await Promise.all([
    getOwnerUserDetail(id),
    getUserAchievementsAdmin(id),
    getAdminAchievements(),
  ]);
  if (!result.success) notFound();

  return (
    <OwnerUserDetailPanel
      locale={locale}
      user={result.data.user}
      auditLogs={result.data.auditLogs}
      userAchievements={userAchievements.success ? userAchievements.data : []}
      allAchievements={allAchievements.success ? allAchievements.data : []}
    />
  );
}
