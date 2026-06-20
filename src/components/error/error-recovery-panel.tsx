"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Copy, Home, LogIn, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildErrorReport, type ErrorDiagnostics, type RecoveryAction } from "@/lib/error-diagnostics";
import { cn } from "@/lib/utils";
import { redirectToLogin } from "@/lib/session-recovery";

export type ErrorRecoveryLabels = {
  titleNetwork: string;
  titleAuth: string;
  titleDatabase: string;
  titleUpload: string;
  titlePermission: string;
  titleValidation: string;
  retry: string;
  reload: string;
  signIn: string;
  home: string;
  copyDetails: string;
  copied: string;
  detailsLabel: string;
  codeLabel: string;
  referenceLabel: string;
  categoryLabel: string;
};

export const ERROR_RECOVERY_LABELS_EN: ErrorRecoveryLabels = {
  titleNetwork: "Connection problem",
  titleAuth: "Session issue",
  titleDatabase: "Database temporarily unavailable",
  titleUpload: "Upload interrupted",
  titlePermission: "Access denied",
  titleValidation: "Invalid request",
  retry: "Try again",
  reload: "Reload page",
  signIn: "Sign in again",
  home: "Back to home",
  copyDetails: "Copy details",
  copied: "Copied",
  detailsLabel: "Technical details",
  codeLabel: "Code",
  referenceLabel: "Reference",
  categoryLabel: "Category",
};

export function ErrorRecoveryPanelContent({
  diagnostics,
  labels,
  onRetry,
  compact = false,
  className,
}: {
  diagnostics: ErrorDiagnostics;
  labels: ErrorRecoveryLabels;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const title = useMemo(() => {
    switch (diagnostics.category) {
      case "network":
        return labels.titleNetwork;
      case "auth":
        return labels.titleAuth;
      case "database":
        return labels.titleDatabase;
      case "upload":
        return labels.titleUpload;
      case "permission":
        return labels.titlePermission;
      case "validation":
        return labels.titleValidation;
      default:
        return diagnostics.title;
    }
  }, [diagnostics.category, diagnostics.title, labels]);

  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(buildErrorReport(diagnostics));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function renderAction(action: RecoveryAction) {
    switch (action) {
      case "retry":
        return onRetry ? (
          <Button key="retry" variant="neon" size={compact ? "sm" : "default"} onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {labels.retry}
          </Button>
        ) : null;
      case "reload":
        return (
          <Button
            key="reload"
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {labels.reload}
          </Button>
        );
      case "signIn":
        return (
          <Button
            key="signIn"
            variant="outline"
            size={compact ? "sm" : "default"}
            onClick={() => redirectToLogin()}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {labels.signIn}
          </Button>
        );
      case "home":
        return (
          <Button key="home" variant="outline" size={compact ? "sm" : "default"} asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              {labels.home}
            </Link>
          </Button>
        );
      case "copy":
        return (
          <Button key="copy" variant="ghost" size={compact ? "sm" : "default"} onClick={() => void copyDetails()}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? labels.copied : labels.copyDetails}
          </Button>
        );
      default:
        return null;
    }
  }

  return (
    <Card
      className={cn(
        "glass border border-destructive/30",
        compact ? "p-4" : "mx-auto max-w-lg p-8",
        className
      )}
    >
      <div className={cn("flex flex-col", compact ? "gap-3" : "items-center gap-4 text-center")}>
        <AlertTriangle className={cn("text-destructive", compact ? "h-8 w-8" : "h-12 w-12")} />
        <div className="space-y-2">
          <h2 className={cn("font-bold", compact ? "text-lg" : "text-2xl")}>{title}</h2>
          <p className="text-sm text-muted-foreground">{diagnostics.hint}</p>
        </div>

        <div className="w-full rounded-lg border border-border/40 bg-background/40 p-3 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {labels.detailsLabel}
          </p>
          <p className="mt-2 break-words text-sm">{diagnostics.message}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {diagnostics.code && (
              <span className="rounded bg-muted px-2 py-0.5 font-mono">
                {labels.codeLabel}: {diagnostics.code}
              </span>
            )}
            {diagnostics.digest && (
              <span className="rounded bg-muted px-2 py-0.5 font-mono">
                {labels.referenceLabel}: {diagnostics.digest}
              </span>
            )}
            <span className="rounded bg-muted px-2 py-0.5">
              {labels.categoryLabel}: {diagnostics.category}
            </span>
          </div>
        </div>

        <div className={cn("flex flex-wrap gap-2", compact ? "" : "justify-center")}>
          {diagnostics.recoveryActions.map((action) => renderAction(action))}
        </div>
      </div>
    </Card>
  );
}

export function ErrorRecoveryPanel(props: Omit<Parameters<typeof ErrorRecoveryPanelContent>[0], "labels">) {
  const t = useTranslations("common.recovery");
  const labels: ErrorRecoveryLabels = {
    titleNetwork: t("titleNetwork"),
    titleAuth: t("titleAuth"),
    titleDatabase: t("titleDatabase"),
    titleUpload: t("titleUpload"),
    titlePermission: t("titlePermission"),
    titleValidation: t("titleValidation"),
    retry: t("retry"),
    reload: t("reload"),
    signIn: t("signIn"),
    home: t("home"),
    copyDetails: t("copyDetails"),
    copied: t("copied"),
    detailsLabel: t("detailsLabel"),
    codeLabel: t("codeLabel"),
    referenceLabel: t("referenceLabel"),
    categoryLabel: t("categoryLabel"),
  };

  return <ErrorRecoveryPanelContent {...props} labels={labels} />;
}
