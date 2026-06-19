import { getOwnerControlCenterData } from "@/actions/admin/owner";
import { requireOwner } from "@/lib/auth";
import { OwnerControlCenter } from "@/components/admin/owner-control-center";

export const dynamic = "force-dynamic";

export default async function OwnerControlCenterPage() {
  await requireOwner();
  const result = await getOwnerControlCenterData();
  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        {result.error}
      </div>
    );
  }

  return <OwnerControlCenter data={result.data} />;
}
