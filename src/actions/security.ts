"use server";

import { revalidatePath } from "next/cache";
import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import {
  generateBackupCodes,
  getSecurityDashboard,
  logSecurityEvent,
  storeBackupCodes,
  verifyBackupCode,
} from "@/lib/user-security";

export async function getUserSecurityDashboard() {
  const { user, error } = await requireActionUser();
  if (error) return error;
  return ok(await getSecurityDashboard(user.id));
}

export async function enrollMfa() {
  const { error } = await requireActionUser();
  if (error) return error;

  const supabase = await createClient();
  const { data, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator App",
  });
  if (enrollError) return fail(enrollError.message);

  return ok({
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
    uri: data.totp.uri,
  });
}

export async function verifyAndEnableMfa(factorId: string, code: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError) return fail(challengeError.message);

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyError) return fail(verifyError.message);

  const backupCodes = generateBackupCodes(10);
  await storeBackupCodes(user.id, backupCodes);

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true, mfaEnabledAt: new Date() },
  });

  await logSecurityEvent({ userId: user.id, eventType: "MFA_ENABLED" });

  revalidatePath("/dashboard/security");
  return ok({ backupCodes });
}

export async function disableMfa(factorId: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const supabase = await createClient();
  const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
  if (unenrollError) return fail(unenrollError.message);

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaEnabledAt: null },
  });
  await prisma.userMfaBackupCode.deleteMany({ where: { userId: user.id } });
  await logSecurityEvent({ userId: user.id, eventType: "MFA_DISABLED" });

  revalidatePath("/dashboard/security");
  return ok(undefined);
}

export async function regenerateBackupCodes() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { mfaEnabled: true } });
  if (!dbUser?.mfaEnabled) return fail("Enable 2FA first");

  const backupCodes = generateBackupCodes(10);
  await storeBackupCodes(user.id, backupCodes);
  await logSecurityEvent({ userId: user.id, eventType: "MFA_ENABLED", metadata: { action: "regenerate_backup" } });

  return ok({ backupCodes });
}

export async function verifyMfaBackupCode(code: string) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const valid = await verifyBackupCode(user.id, code);
  if (!valid) {
    await logSecurityEvent({ userId: user.id, eventType: "MFA_CHALLENGE", metadata: { success: false } });
    return fail("Invalid backup code");
  }

  await logSecurityEvent({ userId: user.id, eventType: "BACKUP_CODE_USED" });
  return ok(undefined);
}

export async function listMfaFactors() {
  const { error } = await requireActionUser();
  if (error) return error;

  const supabase = await createClient();
  const { data, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) return fail(listError.message);

  return ok({ factors: data.all });
}

export async function sendEmailVerificationCode() {
  const { error } = await requireActionUser();
  if (error) return error;

  const { resendVerificationEmail } = await import("@/actions/email");
  return resendVerificationEmail("en");
}

export async function hashClientIp(ip: string) {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}
