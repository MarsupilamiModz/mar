import { NextResponse } from "next/server";
import { formatActionError, parseAppError, type ErrorCategory } from "@/lib/error-diagnostics";
import { withDbRetry } from "@/lib/db";

export type ApiErrorBody = {
  error: string;
  code?: string;
  category?: ErrorCategory;
  recoveryHint?: string;
  recoverable?: boolean;
};

export function apiErrorResponse(err: unknown, status = 500, context?: string) {
  const diagnostics = parseAppError(err);
  const body: ApiErrorBody = {
    error: context ? formatActionError(err, context) : diagnostics.message,
    code: diagnostics.code,
    category: diagnostics.category,
    recoveryHint: diagnostics.hint,
    recoverable: diagnostics.recoverable,
  };
  return NextResponse.json(body, { status });
}

export async function withDbApiRetry<T>(fn: () => Promise<T>, label = "api"): Promise<T> {
  return withDbRetry(fn, { retries: 2, delayMs: 200, label });
}
