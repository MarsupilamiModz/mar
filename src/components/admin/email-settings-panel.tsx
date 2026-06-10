"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateAdminEmailSettings,
  testAdminEmailConnection,
  sendAdminTestEmail,
  retryAdminEmailLog,
} from "@/actions/admin/email";
import type { EmailSettingsPublic } from "@/lib/email/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatDateTime } from "@/lib/format-locale";

type EmailLog = {
  id: string;
  to: string;
  subject: string;
  templateKey: string | null;
  status: string;
  error: string | null;
  attempts: number;
  sentAt: Date | null;
  createdAt: Date;
};

function readEmailForm(form: HTMLFormElement) {
  const fd = new FormData(form);
  return {
    enabled: fd.get("enabled") === "on",
    authMode: (fd.get("authMode") as "smtp" | "microsoft") || "smtp",
    smtpHost: fd.get("smtpHost") as string,
    smtpPort: Number(fd.get("smtpPort") || 587),
    smtpUser: fd.get("smtpUser") as string,
    smtpPassword: (fd.get("smtpPassword") as string) || undefined,
    microsoftTenantId: fd.get("microsoftTenantId") as string,
    microsoftClientId: fd.get("microsoftClientId") as string,
    microsoftClientSecret: (fd.get("microsoftClientSecret") as string) || undefined,
    senderEmail: fd.get("senderEmail") as string,
    senderName: fd.get("senderName") as string,
    encryption: fd.get("encryption") as "SSL" | "TLS" | "STARTTLS" | "NONE",
    supportEmail: fd.get("supportEmail") as string,
    ticketNotificationEmail: fd.get("ticketNotificationEmail") as string,
    customOrderEmail: fd.get("customOrderEmail") as string,
    paymentNotificationEmail: fd.get("paymentNotificationEmail") as string,
    adminNotificationEmail: fd.get("adminNotificationEmail") as string,
    contactFormEmail: fd.get("contactFormEmail") as string,
  };
}

export function EmailSettingsPanel({
  settings,
  logs,
  locale,
}: {
  settings: EmailSettingsPublic;
  logs: EmailLog[];
  locale: string;
}) {
  const appToast = useAppToast();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [testTo, setTestTo] = useState(settings.senderEmail || "");

  return (
    <div className="space-y-6">
      <Card className="glass p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Email configuration</h3>
            <p className="text-xs text-muted-foreground mt-1">
              SMTP or Microsoft 365 / Exchange Online via Graph API. Falls back to Resend if disabled.
            </p>
          </div>
          <Badge variant={settings.configured ? "premium" : "outline"}>
            {settings.configured ? "Configured" : "Not configured"}
          </Badge>
        </div>

        <form
          ref={formRef}
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await updateAdminEmailSettings(readEmailForm(e.currentTarget));
              if (r.success) {
                appToast.saved();
                router.refresh();
              } else appToast.error(r.error);
            });
          }}
        >
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="enabled" defaultChecked={settings.enabled} /> Enable outbound email
          </label>
          <select name="authMode" defaultValue={settings.authMode ?? "smtp"} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm sm:col-span-2">
            <option value="smtp">SMTP (custom / Office365 SMTP)</option>
            <option value="microsoft">Microsoft 365 (Graph API OAuth)</option>
          </select>
          <Input name="smtpHost" defaultValue={settings.smtpHost} placeholder="SMTP Host (smtp mode)" />
          <Input name="smtpPort" type="number" defaultValue={settings.smtpPort} placeholder="Port" />
          <Input name="smtpUser" defaultValue={settings.smtpUser} placeholder="SMTP Username" />
          <Input name="smtpPassword" type="password" placeholder={settings.smtpPasswordSet ? "•••••••• (unchanged)" : "SMTP Password"} />
          <Input name="microsoftTenantId" defaultValue={settings.microsoftTenantId} placeholder="Microsoft Tenant ID" />
          <Input name="microsoftClientId" defaultValue={settings.microsoftClientId} placeholder="Microsoft Client ID" />
          <Input
            name="microsoftClientSecret"
            type="password"
            placeholder={settings.microsoftSecretSet ? "•••••••• (unchanged)" : "Microsoft Client Secret"}
          />
          <Input name="senderEmail" type="email" defaultValue={settings.senderEmail} placeholder="Sender email" />
          <Input name="senderName" defaultValue={settings.senderName} placeholder="Sender name" />
          <select name="encryption" defaultValue={settings.encryption} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            <option value="STARTTLS">STARTTLS</option>
            <option value="TLS">TLS</option>
            <option value="SSL">SSL</option>
            <option value="NONE">None</option>
          </select>

          <div className="sm:col-span-2 pt-2 border-t border-border/40">
            <p className="text-sm font-medium mb-2">Notification targets</p>
          </div>
          <Input name="supportEmail" type="email" defaultValue={settings.supportEmail} placeholder="Support email" />
          <Input name="ticketNotificationEmail" type="email" defaultValue={settings.ticketNotificationEmail} placeholder="Ticket notifications" />
          <Input name="customOrderEmail" type="email" defaultValue={settings.customOrderEmail} placeholder="Custom orders" />
          <Input name="paymentNotificationEmail" type="email" defaultValue={settings.paymentNotificationEmail} placeholder="Payment notifications" />
          <Input name="adminNotificationEmail" type="email" defaultValue={settings.adminNotificationEmail} placeholder="Admin notifications" />
          <Input name="contactFormEmail" type="email" defaultValue={settings.contactFormEmail} placeholder="Contact form" />

          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" variant="neon" disabled={pending}>Save settings</Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                const form = formRef.current;
                if (!form) return;
                startTransition(async () => {
                  const r = await testAdminEmailConnection(readEmailForm(form));
                  if (r.success) appToast.saved();
                  else appToast.error(r.error);
                });
              }}
            >
              Validate connection
            </Button>
          </div>
        </form>

        <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-border/40">
          <Input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="Test recipient email"
            className="max-w-xs"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending || !testTo}
            onClick={() =>
              startTransition(async () => {
                const r = await sendAdminTestEmail(testTo);
                if (r.success) appToast.saved();
                else appToast.error(r.error);
              })
            }
          >
            Send test email
          </Button>
        </div>
      </Card>

      <Card className="glass p-6">
        <h3 className="font-semibold mb-4">Email logs</h3>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No emails logged yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex flex-wrap justify-between gap-2 text-sm border-b border-border/30 py-2 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium truncate">{log.subject}</p>
                  <p className="text-xs text-muted-foreground">{log.to}</p>
                  {log.error && <p className="text-xs text-destructive">{log.error}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={log.status === "SENT" ? "premium" : log.status === "FAILED" ? "destructive" : "outline"}>
                    {log.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(log.createdAt, locale)}</span>
                  {log.status === "FAILED" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await retryAdminEmailLog(log.id);
                          if (r.success) router.refresh();
                          else appToast.error(r.error);
                        })
                      }
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
