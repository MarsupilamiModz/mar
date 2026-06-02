import Link from "next/link";
import { requirePagePermission } from "@/lib/auth";
import { getAdminEmailSettings, listAdminEmailLogs } from "@/actions/admin/email";
import { EmailSettingsPanel } from "@/components/admin/email-settings-panel";
import type { Locale } from "@/i18n/config";

const EMPTY_SETTINGS = {
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

export default async function AdminEmailPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requirePagePermission("settings.write");

  const settingsResult = await getAdminEmailSettings();
  const logsResult = await listAdminEmailLogs();

  const settings = settingsResult.success ? settingsResult.data : EMPTY_SETTINGS;
  const logs = logsResult.success ? logsResult.data : [];
  const errors = [
    !settingsResult.success ? settingsResult.error : null,
    !logsResult.success ? logsResult.error : null,
  ].filter(Boolean) as string[];

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

      {errors.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm space-y-1">
          {errors.map((msg) => (
            <p key={msg} className="text-destructive">{msg}</p>
          ))}
          {!logsResult.success && (
            <p className="text-xs text-muted-foreground">
              Email logs unavailable — run <code className="font-mono">npx prisma db push</code> if the EmailLog table is missing.
            </p>
          )}
        </div>
      )}

      <EmailSettingsPanel settings={settings} logs={logs} locale={locale} />
    </div>
  );
}
