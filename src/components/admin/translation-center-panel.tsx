"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ownerClearTranslationCache,
  ownerProcessTranslationQueue,
  ownerRetranslateAllMods,
  ownerSyncMissingUiKeys,
} from "@/actions/admin/translation-center";
import { useAppToast } from "@/hooks/use-app-toast";
import type { TranslationAuditResult } from "@/lib/i18n-audit";

type Props = {
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    approved: number;
    engine: {
      provider: string;
      openai: boolean;
      deepl: boolean;
      google: boolean;
      azure: boolean;
      autoApprove: boolean;
    };
  };
  cache: { dbEntries: number };
  missing: {
    uiMissingKeys: number;
    runtimeMissing: number;
    locales: { locale: string; missing: number }[];
    topRuntimeKeys: { key: string; count: number }[];
  };
  audit: TranslationAuditResult;
};

export function TranslationCenterPanel({ queue, cache, missing, audit }: Props) {
  const t = useTranslations("admin");
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ success: boolean; error?: string; data?: unknown }>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.success) appToast.saved();
      else appToast.error(r.error);
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("translationCenter")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("translationCenterHint")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{t("translationQueue")}</p>
          <p className="text-2xl font-bold mt-1">{queue.pending}</p>
          <p className="text-xs text-muted-foreground">{t("translationPending")}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{t("translationApproved")}</p>
          <p className="text-2xl font-bold mt-1">{queue.approved}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{t("translationCache")}</p>
          <p className="text-2xl font-bold mt-1">{cache.dbEntries}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{t("translationMissingUi")}</p>
          <p className="text-2xl font-bold mt-1">{missing.uiMissingKeys}</p>
        </Card>
      </div>

      <Card className="glass p-4 space-y-3">
        <h2 className="font-semibold">{t("translationEngine")}</h2>
        <div className="flex flex-wrap gap-2">
          <Badge variant={queue.engine.openai ? "default" : "outline"}>OpenAI</Badge>
          <Badge variant={queue.engine.deepl ? "default" : "outline"}>DeepL</Badge>
          <Badge variant={queue.engine.google ? "default" : "outline"}>Google</Badge>
          <Badge variant="secondary">{queue.engine.provider}</Badge>
          <Badge variant={queue.engine.autoApprove ? "default" : "outline"}>
            {queue.engine.autoApprove ? t("translationAutoApprove") : t("translationManualApprove")}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" disabled={pending} onClick={() => run(ownerProcessTranslationQueue)}>
            {t("translationProcessQueue")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(ownerRetranslateAllMods)}>
            {t("translationRetranslateMods")}
          </Button>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(ownerClearTranslationCache)}>
            {t("translationClearCache")}
          </Button>
          <Button size="sm" variant="neon" disabled={pending} onClick={() => run(ownerSyncMissingUiKeys)}>
            {t("translationSyncMissingKeys")}
          </Button>
        </div>
      </Card>

      <Card className="glass p-4">
        <h2 className="font-semibold mb-2">{t("translationAudit")}</h2>
        <p className="text-sm text-muted-foreground mb-3">{audit.summary}</p>
        <ul className="text-sm space-y-1">
          {missing.locales.map((row) => (
            <li key={row.locale}>
              <span className="font-mono">{row.locale}</span>: {row.missing} missing
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
