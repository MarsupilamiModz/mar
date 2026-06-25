import { requireOwner } from "@/lib/auth";
import { getOwnerFeatureFlags } from "@/actions/admin/feature-flags";
import { FeatureFlagsPanel } from "@/components/admin/feature-flags-panel";
import Link from "next/link";

export default async function OwnerFeatureFlagsPage() {
  await requireOwner();
  const result = await getOwnerFeatureFlags();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div className="space-y-6">
      <Link href="/admin/owner" className="text-sm text-muted-foreground hover:text-foreground">
        ← Owner Control Center
      </Link>
      <h1 className="text-2xl font-bold">Feature flags</h1>
      <FeatureFlagsPanel initial={result.data} />
    </div>
  );
}
