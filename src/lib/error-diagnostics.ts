import { prismaErrorMessage } from "@/lib/errors";

export type ErrorCategory =
  | "network"
  | "auth"
  | "database"
  | "upload"
  | "validation"
  | "permission"
  | "unknown";

export type RecoveryAction = "retry" | "reload" | "signIn" | "home" | "copy";

export type ErrorDiagnostics = {
  category: ErrorCategory;
  title: string;
  message: string;
  hint: string;
  digest?: string;
  code?: string;
  recoverable: boolean;
  recoveryActions: RecoveryAction[];
};

const NETWORK_RE =
  /failed to fetch|load failed|networkerror|network error|econnrefused|timeout|timed out|socket hang up/i;
const AUTH_RE =
  /unauthorized|unauthenticated|session|sign in|jwt|token expired|invalid login|auth session|missing authentication/i;
const DB_RE =
  /prisma|database|postgres|connection pool|can't reach database|p1001|p1002|p1008|p1017|too many clients/i;
const UPLOAD_RE = /upload failed|multipart|r2|cors|chunk \d+/i;
const PERMISSION_RE = /forbidden|permission denied|access denied|owner access only/i;

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === "string") return error.trim();
  return "Unknown error";
}

function extractCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code) return code;
  }
  return undefined;
}

function categorize(message: string, code?: string): ErrorCategory {
  if (UPLOAD_RE.test(message)) return "upload";
  if (AUTH_RE.test(message) || code === "AUTH") return "auth";
  if (PERMISSION_RE.test(message) || code === "FORBIDDEN") return "permission";
  if (DB_RE.test(message) || /^P\d{4}$/.test(code ?? "")) return "database";
  if (NETWORK_RE.test(message) || code === "NETWORK") return "network";
  if (/validation|invalid|required|must be|zod/i.test(message)) return "validation";
  return "unknown";
}

function categoryDefaults(category: ErrorCategory): Pick<ErrorDiagnostics, "title" | "hint" | "recoveryActions"> {
  switch (category) {
    case "network":
      return {
        title: "Connection problem",
        hint: "Check your internet connection, disable VPN or ad blockers, then retry.",
        recoveryActions: ["retry", "reload", "copy"],
      };
    case "auth":
      return {
        title: "Session issue",
        hint: "Your session may have expired. Sign in again to restore access.",
        recoveryActions: ["signIn", "retry", "reload", "copy"],
      };
    case "database":
      return {
        title: "Database temporarily unavailable",
        hint: "The platform could not reach the database. Wait a moment and retry.",
        recoveryActions: ["retry", "reload", "home", "copy"],
      };
    case "upload":
      return {
        title: "Upload interrupted",
        hint: "Uploads can resume automatically. Stay on this page and try again.",
        recoveryActions: ["retry", "reload", "copy"],
      };
    case "permission":
      return {
        title: "Access denied",
        hint: "You do not have permission for this action. Contact an administrator if this is unexpected.",
        recoveryActions: ["home", "copy"],
      };
    case "validation":
      return {
        title: "Invalid request",
        hint: "Review the highlighted fields and submit again.",
        recoveryActions: ["retry", "copy"],
      };
    default:
      return {
        title: "Unexpected error",
        hint: "Try again. If the problem persists, copy the details below for support.",
        recoveryActions: ["retry", "reload", "home", "copy"],
      };
  }
}

export function parseAppError(
  error: unknown,
  options?: { digest?: string; fallbackTitle?: string }
): ErrorDiagnostics {
  const message = extractMessage(error) || "An unexpected error occurred";
  const code = extractCode(error);
  const category = categorize(message, code);
  const defaults = categoryDefaults(category);
  const digest =
    options?.digest ??
    (error && typeof error === "object" && "digest" in error
      ? String((error as { digest?: string }).digest ?? "")
      : undefined);

  return {
    category,
    title: options?.fallbackTitle ?? defaults.title,
    message: message === "An unexpected error occurred" ? prismaErrorMessage(error) : message,
    hint: defaults.hint,
    digest: digest || undefined,
    code,
    recoverable: category !== "permission",
    recoveryActions: defaults.recoveryActions,
  };
}

export function formatActionError(err: unknown, context?: string): string {
  const diagnostics = parseAppError(err);
  const prefix = context ? `[${context}] ` : "";
  return `${prefix}${diagnostics.message}${diagnostics.hint ? ` — ${diagnostics.hint}` : ""}`;
}

export function buildErrorReport(diagnostics: ErrorDiagnostics): string {
  return [
    `Category: ${diagnostics.category}`,
    diagnostics.code ? `Code: ${diagnostics.code}` : null,
    diagnostics.digest ? `Reference: ${diagnostics.digest}` : null,
    `Message: ${diagnostics.message}`,
    `Hint: ${diagnostics.hint}`,
  ]
    .filter(Boolean)
    .join("\n");
}
