"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { changeEmail, resendVerificationEmail } from "@/actions/email";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { isPlaceholderEmail } from "@/lib/email/address";

type EmailLog = {
  id: string;
  subject: string;
  templateKey: string | null;
  status: string;
  sentAt: Date | null;
  createdAt: Date;
};

export function EmailSettingsCard({
  locale,
  email,
  emailVerified,
  emailVerifiedAt,
  logs,
}: {
  locale: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: Date | null;
  logs: EmailLog[];
}) {
  const t = useTranslations("email");
  const [pending, startTransition] = useTransition();
  const [newEmail, setNewEmail] = useState("");
  const placeholder = isPlaceholderEmail(email);

  return (
    <div className="space-y-6">
      <Card className="glass">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm">{placeholder ? t("noEmail") : email}</p>
            {!placeholder && (
              <Badge variant={emailVerified ? "premium" : "destructive"}>
                {emailVerified ? t("verified") : t("unverified")}
              </Badge>
            )}
          </div>
          {emailVerifiedAt && (
            <p className="text-xs text-muted-foreground">
              {t("verifiedAt", {
                date: safeToLocaleDateString(new Date(emailVerifiedAt), locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </p>
          )}

          {!emailVerified && !placeholder && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await resendVerificationEmail(locale);
                  if (r.success) toast({ title: t("verificationSent") });
                  else toast({ title: "Error", description: r.error, variant: "destructive" });
                })
              }
            >
              {t("resendVerification")}
            </Button>
          )}

          {placeholder && (
            <p className="text-xs text-muted-foreground">{t("oauthHint")}</p>
          )}

          {!placeholder && (
            <form
              className="space-y-3 pt-2 border-t border-border/40"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const r = await changeEmail({ email: newEmail, locale: locale as "en" });
                  if (r.success) {
                    toast({ title: t("changeRequested") });
                    setNewEmail("");
                  } else toast({ title: "Error", description: r.error, variant: "destructive" });
                });
              }}
            >
              <label className="text-sm">{t("changeEmail")}</label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={t("newEmailPlaceholder")}
                required
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground">{t("changeHint")}</p>
              <Button type="submit" variant="outline" size="sm" disabled={pending || !newEmail.trim()}>
                {t("updateEmail")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>{t("historyTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
          ) : (
            <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
              {logs.map((log) => (
                <li key={log.id} className="flex justify-between gap-4 border-b border-border/30 pb-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{log.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.templateKey ?? "custom"} · {log.status}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {safeToLocaleDateString(
                      new Date(log.sentAt ?? log.createdAt),
                      locale,
                      { dateStyle: "short", timeStyle: "short" }
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
