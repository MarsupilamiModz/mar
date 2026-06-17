import { requirePagePermission } from "@/lib/auth";
import { listTeamMembersAdmin } from "@/actions/admin/team";
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

  const result = await listTeamMembersAdmin();
  if (!result.success) {
    return <p className="text-destructive">{result.error}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Team Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Add staff, assign departments, groups, badges, and permissions
        </p>
      </div>
      <TeamAdminPanel
        members={result.data.members}
        groups={result.data.groups}
        departments={result.data.departments}
      />
    </div>
  );
}
