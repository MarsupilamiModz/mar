"use client";

import { useMemo, useState, useTransition } from "react";
import { safeToLocaleString } from "@/lib/i18n/safe-locale";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  clearAdminSystemLogs,
  exportAdminSystemLogs,
  runAdminPlatformAudit,
} from "@/actions/admin/system";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatDateTime } from "@/lib/format-locale";
import type { PlatformErrorEntry } from "@/lib/platform-log";
import type { TranslationAuditResult } from "@/lib/i18n-audit";
import type { PlatformAuditIssue } from "@/lib/platform-audit";

type HealthCheck = { name: string; ok: boolean; detail?: string };

type Tab = "health" | "metrics" | "errors" | "audit" | "translations";

export type PlatformMetrics = {
  cpu: { usagePercent: number | null; detail: string };
  memory: { heapUsedMb: number; rssMb: number };
  database: { mods: number; sounds: number };
  storage: { bytes: number; detail: string };
  queues: { scan: number; upload: number; email: number };
  ads: { impressions: number; clicks: number; ctr: number; rpm: number | null };
  activeUsers: number;
  virusTotal: { envEnabled: boolean; apiKeyConfigured: boolean };
};

export function SystemHealthPanel({
  locale,
  logs,
  health,
  metrics = null,
  translationAudit = { referenceLocale: "en", totalReferenceKeys: 0, locales: [], summary: "" },
  platformAudit,
  lazyAudit: _lazyAudit = false,
}: {
  locale: string;
  logs: PlatformErrorEntry[];
  health: HealthCheck[];
  metrics?: PlatformMetrics | null;
  translationAudit?: TranslationAuditResult;
  platformAudit?: { issues: PlatformAuditIssue[]; scannedAt: string } | null;
  lazyAudit?: boolean;
}) {
  const t = useTranslations("admin.system");
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("health");
  const [search, setSearch] = useState("");
  const [auditResult, setAuditResult] = useState(platformAudit);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) => l.context.toLowerCase().includes(q) || l.message.toLowerCase().includes(q)
    );
  }, [logs, search]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "health", label: t("healthTab") },
    { id: "metrics", label: t("metricsTab") },
    { id: "errors", label: t("errorsTab") },
    { id: "audit", label: t("auditTab") },
    { id: "translations", label: t("translationsTab") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "neon" : "outline"}
            size="sm"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => router.refresh()}>
          {t("retryHealth")}
        </Button>
      </div>

      {tab === "health" && (
        <Card className="glass p-6 dark-reader-lock">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {health.map((check) => (
              <div
                key={check.name}
                className="rounded-lg border border-border/40 bg-card/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{check.name}</span>
                  <Badge variant={check.ok ? "premium" : "destructive"}>
                    {check.ok ? t("statusOk") : t("statusIssue")}
                  </Badge>
                </div>
                {check.detail && (
                  <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "metrics" && metrics && (
        <Card className="glass p-6 dark-reader-lock">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">{t("memoryUsage")}</p>
              <p className="text-lg font-semibold">
                {metrics.memory.heapUsedMb} MB heap · {metrics.memory.rssMb} MB RSS
              </p>
            </div>
            <div className="rounded-lg border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">{t("storageUsage")}</p>
              <p className="text-lg font-semibold">{metrics.storage.detail}</p>
            </div>
            <div className="rounded-lg border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">{t("scanQueue")}</p>
              <p className="text-lg font-semibold">{metrics.queues.scan} pending</p>
            </div>
            <div className="rounded-lg border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">{t("uploadQueue")}</p>
              <p className="text-lg font-semibold">{metrics.queues.upload} in progress</p>
            </div>
            <div className="rounded-lg border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">{t("emailQueue")}</p>
              <p className="text-lg font-semibold">{metrics.queues.email} pending</p>
            </div>
            <div className="rounded-lg border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">{t("activeUsers")}</p>
              <p className="text-lg font-semibold">{metrics.activeUsers} downloads (1h)</p>
            </div>
            <div className="rounded-lg border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">{t("adRevenue")}</p>
              <p className="text-lg font-semibold">
                {safeToLocaleString(metrics.ads.impressions)} imp · {metrics.ads.ctr.toFixed(2)}% CTR
              </p>
            </div>
            <div className="rounded-lg border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">Catalog</p>
              <p className="text-lg font-semibold">
                {metrics.database.mods} mods · {metrics.database.sounds} sounds
              </p>
            </div>
            <div className="rounded-lg border border-border/40 p-4">
              <p className="text-xs text-muted-foreground">VirusTotal</p>
              <p className="text-lg font-semibold">
                {metrics.virusTotal.envEnabled ? "Enabled" : "Disabled"} ·{" "}
                {metrics.virusTotal.apiKeyConfigured ? "API key set" : "No env key"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {tab === "errors" && (
        <Card className="glass p-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Input
              placeholder={t("searchErrors")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-9"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await exportAdminSystemLogs();
                  if (r.success && r.data) {
                    const blob = new Blob([r.data], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `platform-errors-${Date.now()}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } else if (!r.success) {
                    appToast.error(r.error);
                  }
                })
              }
            >
              {t("exportLogs")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || logs.length === 0}
              onClick={() =>
                startTransition(async () => {
                  const r = await clearAdminSystemLogs();
                  if (r.success) {
                    appToast.saved();
                    router.refresh();
                  } else appToast.error(r.error);
                })
              }
            >
              {t("clearLogs")}
            </Button>
          </div>

          {filteredLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noErrors")}</p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-border/30 bg-card/30 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant="outline">{log.context}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(log.createdAt, locale)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs break-words font-mono">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "audit" && (
        <Card className="glass p-6 space-y-4">
          {!auditResult && (
            <p className="text-sm text-muted-foreground">Run a platform audit to check uploads, Stripe, and configuration.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="neon"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await runAdminPlatformAudit();
                  if (r.success) {
                    setAuditResult(r.data);
                    appToast.saved();
                  } else appToast.error(r.error);
                })
              }
            >
              {pending ? t("auditRunning") : t("runAudit")}
            </Button>
            {auditResult?.scannedAt && (
              <span className="text-xs text-muted-foreground">
                {t("lastScan", { time: formatDateTime(auditResult.scannedAt, locale) })}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {(auditResult?.issues ?? []).map((issue, i) => (
              <div
                key={`${issue.category}-${i}`}
                className="rounded-lg border border-border/30 bg-card/30 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge
                    variant={
                      issue.severity === "error"
                        ? "destructive"
                        : issue.severity === "warning"
                          ? "premium"
                          : "outline"
                    }
                  >
                    {issue.severity === "error"
                      ? t("severityError")
                      : issue.severity === "warning"
                        ? t("severityWarning")
                        : t("severityInfo")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{issue.category}</span>
                </div>
                <p>{issue.message}</p>
                {issue.detail && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{issue.detail}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "translations" && (
        <Card className="glass p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("translationSummary", {
              locale: translationAudit.referenceLocale,
              count: translationAudit.totalReferenceKeys,
            })}
          </p>
          <p className="text-sm">{translationAudit.summary}</p>
          <div className="space-y-2">
            {translationAudit.locales.map((loc) => (
              <div
                key={loc.locale}
                className="rounded-lg border border-border/30 bg-card/30 p-3 text-sm flex flex-wrap justify-between gap-2"
              >
                <span className="font-medium uppercase">{loc.locale}</span>
                {loc.missing.length === 0 ? (
                  <Badge variant="premium">{t("noMissingKeys")}</Badge>
                ) : (
                  <Badge variant="destructive">
                    {t("missingKeys", { count: loc.missing.length, locale: loc.locale })}
                  </Badge>
                )}
                {loc.missing.length > 0 && (
                  <p className="w-full text-xs text-muted-foreground font-mono line-clamp-2">
                    {loc.missing.slice(0, 20).join(", ")}
                    {loc.missing.length > 20 ? "…" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
