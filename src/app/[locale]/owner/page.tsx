import { getOwnerAutomationData } from "@/actions/admin/owner-automation";
import { getOwnerControlCenterData } from "@/actions/admin/owner";
import { requireOwner } from "@/lib/auth";
import { OwnerAutomationPanel } from "@/components/admin/owner-automation-panel";
import { OwnerControlCenter } from "@/components/admin/owner-control-center";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function OwnerPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  await requireOwner();

  const [automationResult, statsResult] = await Promise.all([
    getOwnerAutomationData(),
    getOwnerControlCenterData(),
  ]);

  if (!automationResult.success) {
    return (
      <div className="container py-8">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
          {automationResult.error}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-12">
      <OwnerAutomationPanel
        locale={locale}
        discord={automationResult.data.discord}
        mediaTemplates={automationResult.data.mediaTemplates}
        auditLogs={automationResult.data.auditLogs}
      />
      {statsResult.success ? (
        <section>
          <h2 className="text-xl font-semibold mb-4">Platform statistics</h2>
          <OwnerControlCenter data={statsResult.data} />
        </section>
      ) : null}
    </div>
  );
}
