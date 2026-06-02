"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    console.error("[locale-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
      <h1 className="text-2xl font-bold">{t("error")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("errorPageHint")}
      </p>
      {error.digest && (
        <p className="mt-2 text-xs font-mono text-muted-foreground/70">{error.digest}</p>
      )}
      <Button variant="neon" className="mt-6" onClick={() => reset()}>
        {t("retry")}
      </Button>
    </div>
  );
}
