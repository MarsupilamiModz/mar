import { requirePagePermission } from "@/lib/auth";
import { listTeamMembersAdmin } from "@/actions/admin/team";
import { listTeamDepartmentsAdmin, listTeamProfilesAdmin } from "@/actions/admin/team-profiles";
import { TeamManagementPanel } from "@/components/admin/team-management-panel";
import { TeamAdminPanel } from "@/components/admin/team-admin-panel";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  await requirePagePermission("users.read");

  const [staffResult, deptResult, profileResult] = await Promise.all([
    listTeamMembersAdmin(),
    listTeamDepartmentsAdmin(),
    listTeamProfilesAdmin(),
  ]);

  if (!staffResult.success) {
    return <p className="text-destructive">{staffResult.error}</p>;
  }

  const departments = deptResult.success ? deptResult.data : [];
  const profiles = profileResult.success ? profileResult.data : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Team Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage public team profiles, roles, media, and internal staff accounts
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Public team page</h2>
        <TeamManagementPanel departments={departments} profiles={profiles} />
      </section>

      <section className="space-y-4 border-t border-border/30 pt-8">
        <h2 className="text-lg font-semibold">Staff accounts</h2>
        <TeamAdminPanel
          members={staffResult.data.members}
          groups={staffResult.data.groups}
          departments={staffResult.data.departments}
        />
      </section>
    </div>
  );
}
