import { requirePagePermission } from "@/lib/auth";
import { getAdminPermissionGroups } from "@/actions/admin/branding";
import { getAdminRolePermissions } from "@/actions/admin/permissions";
import { GroupsAdminPanel } from "@/components/admin/groups-admin-panel";

export default async function AdminGroupsPage() {
  await requirePagePermission("settings.write");
  const [groupsResult, rolesResult] = await Promise.all([
    getAdminPermissionGroups(),
    getAdminRolePermissions(),
  ]);

  if (!groupsResult.success) return <p className="text-destructive">{groupsResult.error}</p>;
  if (!rolesResult.success) return <p className="text-destructive">{rolesResult.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Roles & Permissions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Create custom roles (VIP, Developer, Translator…) and manage built-in role permissions with live database sync.
      </p>
      <div className="mt-8">
        <GroupsAdminPanel groups={groupsResult.data} roles={rolesResult.data} />
      </div>
    </div>
  );
}
