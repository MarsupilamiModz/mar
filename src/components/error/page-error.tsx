"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ErrorRecoveryPanel } from "@/components/error/error-recovery-panel";
import { parseAppError } from "@/lib/error-diagnostics";
export function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  const diagnostics = useMemo(
    () => parseAppError(error, { digest: error.digest, fallbackTitle: t("error") }),
    [error, t]
  );

  useEffect(() => {
    console.error("[page-error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center px-4 py-16">
      <ErrorRecoveryPanel diagnostics={diagnostics} onRetry={() => reset()} />
    </div>
  );
}
