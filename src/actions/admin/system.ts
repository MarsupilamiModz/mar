"use server";

import { revalidatePath } from "next/cache";
import { ok, requireActionPermission } from "@/lib/action-utils";
import { clearPlatformErrors, listPlatformErrors } from "@/lib/platform-log";

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
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: "Database", ok: true });
  } catch (err) {
    checks.push({
      name: "Database",
      ok: false,
      detail: err instanceof Error ? err.message : "Connection failed",
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
    const { isStorageConfigured } = await import("@/lib/asset-storage");
    checks.push({
      name: "File storage",
      ok: isStorageConfigured(),
      detail: isStorageConfigured() ? "Configured" : "Missing storage credentials",
    });
  } catch {
    checks.push({ name: "File storage", ok: false, detail: "Check failed" });
  }

  return ok(checks);
}
