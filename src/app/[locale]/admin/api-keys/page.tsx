import { listApiKeysAdmin } from "@/actions/admin/api-keys";
import { ApiKeysPanel } from "@/components/admin/api-keys-panel";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function AdminApiKeysPage({ params }: { params: Promise<{ locale: Locale }> }) {
  await params;

  const result = await listApiKeysAdmin();
  if (!result.success) {
    return <p className="text-destructive">Failed to load API center.</p>;
  }

  return (
    <ApiKeysPanel
      keys={result.data.keys}
      totals={result.data.totals}
      recentLogs={result.data.recentLogs}
    />
  );
}
