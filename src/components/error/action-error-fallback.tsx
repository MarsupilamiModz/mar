"use client";

import { ErrorRecoveryPanel } from "@/components/error/error-recovery-panel";
import { parseAppError } from "@/lib/error-diagnostics";

export function ActionErrorFallback({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const diagnostics = parseAppError(error);
  return <ErrorRecoveryPanel diagnostics={diagnostics} onRetry={onRetry} compact />;
}
