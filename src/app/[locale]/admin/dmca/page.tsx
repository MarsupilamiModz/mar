import { getAdminDMCAClaims } from "@/actions/admin/trust";
import { DMCAAdminPanel } from "@/components/admin/dmca-admin-panel";
import { requirePagePermission } from "@/lib/auth";

export default async function AdminDMCAPage() {
  await requirePagePermission("moderation.reports");
  const result = await getAdminDMCAClaims();
  const claims = result.success ? result.data.claims : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">DMCA Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">Copyright takedown requests — permanent record</p>
      </div>
      <DMCAAdminPanel claims={claims} />
    </div>
  );
}
