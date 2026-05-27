import { requireAdmin } from "@/lib/auth";
import { getAdminPermissionGroups } from "@/actions/admin/branding";
import { GroupsAdminPanel } from "@/components/admin/groups-admin-panel";

export default async function AdminGroupsPage() {
  await requireAdmin();
  const result = await getAdminPermissionGroups();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Groups & Permissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage custom permission groups and access control.</p>
      <div className="mt-8">
        <GroupsAdminPanel groups={result.data} />
      </div>
    </div>
  );
}
