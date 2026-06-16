"use server";

import { revalidatePath } from "next/cache";
import { ok, requireActionPermission } from "@/lib/action-utils";
import { clearPlatformErrors, listPlatformErrors } from "@/lib/platform-log";
import { auditTranslationKeys } from "@/lib/i18n-audit";
import { runPlatformAudit } from "@/lib/platform-audit";

export async function getAdminSystemLogs() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await listPlatformErrors(100));
}

export async function clearAdminSystemLogs() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  await clearPlatformErrors();
  revalidatePath("/admin/system");
  return ok(undefined);
}

export async function getAdminSystemHealth() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const checks: { name: string; ok: boolean; detail?: string }[] = [];

  try {
    const { checkDbHealth } = await import("@/lib/db");
    const db = await checkDbHealth();
    checks.push({
      name: "Database (Prisma)",
      ok: db.ok,
      detail: db.ok ? "Connected" : db.detail,
    });
  } catch (err) {
    checks.push({
      name: "Database (Prisma)",
      ok: false,
      detail: err instanceof Error ? err.message : "Connection failed",
    });
  }

  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error: authErr } = await supabase.auth.getUser();
    checks.push({
      name: "Supabase Auth",
      ok: !authErr,
      detail: authErr ? authErr.message : "Reachable",
    });
  } catch (err) {
    checks.push({
      name: "Supabase Auth",
      ok: false,
      detail: err instanceof Error ? err.message : "Unreachable",
    });
  }

  try {
    const { getEmailSettingsPublic } = await import("@/lib/email/settings");
    const email = await getEmailSettingsPublic();
    checks.push({
      name: "Email (SMTP)",
      ok: email.configured || Boolean(process.env.RESEND_API_KEY),
      detail: email.configured ? "SMTP configured" : process.env.RESEND_API_KEY ? "Resend fallback" : "Not configured",
    });
  } catch (err) {
    checks.push({
      name: "Email (SMTP)",
      ok: false,
      detail: err instanceof Error ? err.message : "Settings unavailable",
    });
  }

  try {
    const { getR2ConfigStatus } = await import("@/lib/r2-config");
    const r2 = getR2ConfigStatus();
    checks.push({
      name: "Uploads (R2 multipart)",
      ok: r2.configured,
      detail: r2.configured
        ? r2.publicUrl
          ? `Configured · CDN ${r2.publicUrl}`
          : "Configured · set NEXT_PUBLIC_R2_PUBLIC_URL for direct CDN delivery"
        : `Missing: ${r2.missing.join(", ")}`,
    });
  } catch {
    checks.push({ name: "Uploads (R2 multipart)", ok: false, detail: "Check failed" });
  }

  checks.push({
    name: "Discord OAuth",
    ok: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET),
    detail: process.env.DISCORD_CLIENT_ID ? "Client configured" : "Missing Discord credentials",
  });

  try {
    const { getStripeConfigStatus } = await import("@/lib/stripe-config");
    const stripeStatus = getStripeConfigStatus();
    let stripeDetail = stripeStatus.configured ? "Configured" : `Missing: ${stripeStatus.missing.join(", ")}`;
    if (stripeStatus.configured) {
      try {
        const { getStripe } = await import("@/lib/stripe");
        await getStripe().products.list({ limit: 1 });
        stripeDetail = "Connected — API reachable";
      } catch (err) {
        stripeDetail = err instanceof Error ? `API error: ${err.message}` : "API check failed";
      }
    }
    checks.push({
      name: "Stripe",
      ok: stripeStatus.configured && stripeDetail.includes("reachable"),
      detail: stripeDetail,
    });
  } catch (err) {
    checks.push({
      name: "Stripe",
      ok: false,
      detail: err instanceof Error ? err.message : "Check failed",
    });
  }

  checks.push({
    name: "PayPal",
    ok: Boolean(process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID),
    detail: process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ? "Configured" : "Optional — not set",
  });

  try {
    const { prisma } = await import("@/lib/db");
    await prisma.notification.count();
    checks.push({ name: "Notifications", ok: true, detail: "Query OK" });
  } catch (err) {
    checks.push({
      name: "Notifications",
      ok: false,
      detail: err instanceof Error ? err.message : "Query failed",
    });
  }

  try {
    const { prisma } = await import("@/lib/db");
    await prisma.supportTicket.count();
    checks.push({ name: "Tickets", ok: true, detail: "Query OK" });
  } catch (err) {
    checks.push({
      name: "Tickets",
      ok: false,
      detail: err instanceof Error ? err.message : "Query failed",
    });
  }

  return ok(checks);
}

export async function getAdminTranslationAudit() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(auditTranslationKeys("en"));
}

export async function runAdminPlatformAudit() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await runPlatformAudit());
}

export async function exportAdminSystemLogs() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  const logs = await listPlatformErrors(100);
  return ok(JSON.stringify(logs, null, 2));
}
