/**
 * Next.js instrumentation hook.
 * Install @sentry/nextjs and set SENTRY_DSN to enable error + performance tracking.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn && process.env.NODE_ENV === "production") {
    console.info("[instrumentation] SENTRY_DSN is set — install @sentry/nextjs to activate monitoring");
  }
}
