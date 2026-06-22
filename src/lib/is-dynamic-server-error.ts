/** True when Next.js opts a route out of static generation (cookies/headers during prerender). */
export function isDynamicServerUsageError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("digest" in error && (error as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE") {
    return true;
  }
  const message =
    "message" in error && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return message.includes("Dynamic server usage");
}
