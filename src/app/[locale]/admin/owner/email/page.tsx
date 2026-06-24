import { getOwnerEmailMonitor } from "@/actions/admin/email-monitor";
import { EmailMonitorPanel } from "@/components/admin/email-monitor-panel";
import { requireOwner } from "@/lib/auth";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function OwnerEmailMonitorPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOwner();

  const result = await getOwnerEmailMonitor();
  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        {result.error}
      </div>
    );
  }

  return <EmailMonitorPanel data={result.data} locale={locale} />;
}
