"use client";

import { useEffect, useMemo } from "react";
import { ErrorRecoveryPanelContent, ERROR_RECOVERY_LABELS_EN } from "@/components/error/error-recovery-panel";
import { parseAppError } from "@/lib/error-diagnostics";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const diagnostics = useMemo(
    () => parseAppError(error, { digest: error.digest }),
    [error]
  );

  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] p-6 font-sans text-white">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center">
          <ErrorRecoveryPanelContent
            diagnostics={diagnostics}
            labels={ERROR_RECOVERY_LABELS_EN}
            onRetry={() => reset()}
          />
        </div>
      </body>
    </html>
  );
}
