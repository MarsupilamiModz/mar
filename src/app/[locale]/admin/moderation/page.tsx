import { getModerationOverview } from "@/actions/admin/moderation";
import { UserModerationPanel } from "@/components/admin/user-moderation-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminModerationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const result = await getModerationOverview({ search: sp.search, page });
  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        Unable to load moderation data: {result.error}
      </div>
    );
  }

  return (
    <UserModerationPanel
      locale={locale}
      users={result.data.users}
      recentLogs={result.data.recentLogs}
      flagged={result.data.flagged}
    />
  );
}
