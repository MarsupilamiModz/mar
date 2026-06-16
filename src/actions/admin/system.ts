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

export async function getAdminPlatformMetrics() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const { prisma } = await import("@/lib/db");
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [
    scanQueue,
    uploadQueue,
    emailQueue,
    activeUsers,
    adTotals,
    modCount,
    soundCount,
    storageBytes,
  ] = await Promise.all([
    prisma.scanQueue.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } }).catch(() => 0),
    prisma.storageUploadSession.count({ where: { status: "IN_PROGRESS" } }).catch(() => 0),
    prisma.emailLog.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.download.count({ where: { createdAt: { gte: hourAgo } } }).catch(() => 0),
    prisma.adPlacement.aggregate({ _sum: { impressions: true, clicks: true } }),
    prisma.mod.count({ where: { productType: "MOD" } }),
    prisma.mod.count({ where: { productType: "SOUND" } }),
    prisma.modVersion.aggregate({ _sum: { fileSize: true } }),
  ]);

  const mem = process.memoryUsage();
  const totalImpressions = adTotals._sum.impressions ?? 0;
  const totalClicks = adTotals._sum.clicks ?? 0;

  const storageTotal = Number(storageBytes._sum.fileSize ?? 0);

  return ok({
    cpu: { usagePercent: null, detail: "Serverless — CPU metrics require host agent" },
    memory: {
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      rssMb: Math.round(mem.rss / 1024 / 1024),
    },
    database: { mods: modCount, sounds: soundCount },
    storage: {
      bytes: storageTotal,
      detail: storageTotal
        ? `${Math.round(storageTotal / 1024 / 1024)} MB tracked in versions`
        : "No file size data",
    },
    queues: {
      scan: scanQueue,
      upload: uploadQueue,
      email: typeof emailQueue === "number" ? emailQueue : 0,
    },
    ads: {
      impressions: totalImpressions,
      clicks: totalClicks,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      rpm: null,
    },
    activeUsers,
    virusTotal: {
      envEnabled: process.env.VIRUSTOTAL_ENABLED !== "false",
      apiKeyConfigured: Boolean(process.env.VIRUSTOTAL_API_KEY),
    },
  });
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
