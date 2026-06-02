import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getAdminEmailSettings, listAdminEmailLogs } from "@/actions/admin/email";
import { EmailSettingsPanel } from "@/components/admin/email-settings-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminEmailPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requireAdmin();
  const [settingsResult, logsResult] = await Promise.all([
    getAdminEmailSettings(),
    listAdminEmailLogs(),
  ]);

  const settings = settingsResult.success
    ? settingsResult.data
    : {
        enabled: false,
        smtpHost: "",
        smtpPort: 587,
        smtpUser: "",
        smtpPasswordSet: false,
        senderEmail: "",
        senderName: "XumariModz",
        encryption: "STARTTLS" as const,
        supportEmail: "",
        ticketNotificationEmail: "",
        customOrderEmail: "",
        paymentNotificationEmail: "",
        adminNotificationEmail: "",
        contactFormEmail: "",
        configured: false,
      };
  const logs = logsResult.success ? logsResult.data : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Email Settings</h1>
          <p className="text-muted-foreground text-sm">SMTP, notification routing, logs, and delivery testing.</p>
        </div>
        <Link href={`/${locale}/admin/email/templates`} className="text-sm text-neon-purple hover:underline">
          Edit templates →
        </Link>
      </div>
      <EmailSettingsPanel settings={settings} logs={logs} locale={locale} />
    </div>
  );
}
