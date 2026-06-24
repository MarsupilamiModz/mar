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
    authMode: (fd.get("authMode") as "smtp" | "microsoft" | "graph") || "smtp",
    smtpHost: fd.get("smtpHost") as string,
    smtpPort: Number(fd.get("smtpPort") || 587),
    smtpUser: fd.get("smtpUser") as string,
    smtpPassword: (fd.get("smtpPassword") as string) || undefined,
    microsoftTenantId: fd.get("microsoftTenantId") as string,
    microsoftClientId: fd.get("microsoftClientId") as string,
    microsoftClientSecret: (fd.get("microsoftClientSecret") as string) || undefined,
    senderEmail: fd.get("senderEmail") as string,
    senderName: fd.get("senderName") as string,
    replyToEmail: fd.get("replyToEmail") as string,
    encryption: fd.get("encryption") as "SSL" | "TLS" | "STARTTLS" | "NONE",
    supportEmail: fd.get("supportEmail") as string,
    ticketNotificationEmail: fd.get("ticketNotificationEmail") as string,
    customOrderEmail: fd.get("customOrderEmail") as string,
    paymentNotificationEmail: fd.get("paymentNotificationEmail") as string,
    adminNotificationEmail: fd.get("adminNotificationEmail") as string,
    contactFormEmail: fd.get("contactFormEmail") as string,
    fallbackSesEnabled: fd.get("fallbackSesEnabled") === "on",
    fallbackSesHost: fd.get("fallbackSesHost") as string,
    fallbackSesPort: Number(fd.get("fallbackSesPort") || 587),
    fallbackSesUser: fd.get("fallbackSesUser") as string,
    fallbackSesPassword: (fd.get("fallbackSesPassword") as string) || undefined,
    fallbackSesEncryption: fd.get("fallbackSesEncryption") as "SSL" | "TLS" | "STARTTLS" | "NONE",
    fallbackBrevoEnabled: fd.get("fallbackBrevoEnabled") === "on",
    fallbackBrevoHost: fd.get("fallbackBrevoHost") as string,
    fallbackBrevoPort: Number(fd.get("fallbackBrevoPort") || 587),
    fallbackBrevoUser: fd.get("fallbackBrevoUser") as string,
    fallbackBrevoPassword: (fd.get("fallbackBrevoPassword") as string) || undefined,
    fallbackBrevoEncryption: fd.get("fallbackBrevoEncryption") as "SSL" | "TLS" | "STARTTLS" | "NONE",
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
            <h3 className="font-semibold">Email providers</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Microsoft 365 → Primary SMTP → Amazon SES → Brevo → Resend fallback chain.
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
            <option value="smtp">SMTP (custom / Exchange SMTP relay)</option>
            <option value="microsoft">Microsoft 365 (Graph API OAuth2)</option>
            <option value="graph">Graph API (alias)</option>
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
          <Input name="senderEmail" type="email" defaultValue={settings.senderEmail} placeholder="Sender address" />
          <Input name="senderName" defaultValue={settings.senderName} placeholder="Sender name" />
          <Input name="replyToEmail" type="email" defaultValue={settings.replyToEmail ?? ""} placeholder="Reply-To address" />
          <select name="encryption" defaultValue={settings.encryption} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm">
            <option value="STARTTLS">STARTTLS</option>
            <option value="TLS">TLS</option>
            <option value="SSL">SSL</option>
            <option value="NONE">None</option>
          </select>

          <div className="sm:col-span-2 pt-2 border-t border-border/40">
            <p className="text-sm font-medium mb-2">Fallback — Amazon SES</p>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="fallbackSesEnabled" defaultChecked={settings.fallbackSes.enabled} /> Enable SES fallback
          </label>
          <Input name="fallbackSesHost" defaultValue={settings.fallbackSes.smtpHost} placeholder="email-smtp.region.amazonaws.com" />
          <Input name="fallbackSesPort" type="number" defaultValue={settings.fallbackSes.smtpPort} placeholder="587" />
          <Input name="fallbackSesUser" defaultValue={settings.fallbackSes.smtpUser} placeholder="SES SMTP username" />
          <Input
            name="fallbackSesPassword"
            type="password"
            placeholder={settings.fallbackSes.passwordSet ? "•••••••• (unchanged)" : "SES SMTP password"}
          />
          <select name="fallbackSesEncryption" defaultValue={settings.fallbackSes.encryption} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm sm:col-span-2">
            <option value="STARTTLS">STARTTLS</option>
            <option value="TLS">TLS</option>
            <option value="SSL">SSL</option>
            <option value="NONE">None</option>
          </select>

          <div className="sm:col-span-2 pt-2 border-t border-border/40">
            <p className="text-sm font-medium mb-2">Fallback — Brevo</p>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="fallbackBrevoEnabled" defaultChecked={settings.fallbackBrevo.enabled} /> Enable Brevo fallback
          </label>
          <Input name="fallbackBrevoHost" defaultValue={settings.fallbackBrevo.smtpHost} placeholder="smtp-relay.brevo.com" />
          <Input name="fallbackBrevoPort" type="number" defaultValue={settings.fallbackBrevo.smtpPort} placeholder="587" />
          <Input name="fallbackBrevoUser" defaultValue={settings.fallbackBrevo.smtpUser} placeholder="Brevo SMTP login" />
          <Input
            name="fallbackBrevoPassword"
            type="password"
            placeholder={settings.fallbackBrevo.passwordSet ? "•••••••• (unchanged)" : "Brevo SMTP key"}
          />
          <select name="fallbackBrevoEncryption" defaultValue={settings.fallbackBrevo.encryption} className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm sm:col-span-2">
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
