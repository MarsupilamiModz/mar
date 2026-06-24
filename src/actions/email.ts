"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";
import { fail, ok, requireActionUser } from "@/lib/action-utils";
import { sendAuthVerificationEmail } from "@/lib/auth-verification-email";
import { userFriendlyAuthCodeMessage } from "@/lib/auth-errors";
import { isValidEmail, isPlaceholderEmail, normalizeEmail } from "@/lib/email/address";
import { sendEmail } from "@/lib/email/send";
import { logPlatformError } from "@/lib/platform-log";
import { rateLimit } from "@/lib/rate-limit";
import { SITE } from "@/lib/site";

const changeEmailSchema = z.object({
  email: z.string().email().max(255),
  locale: z.enum(["en", "de", "fr", "es", "tr", "pl"]).default("en"),
});

export async function getEmailStatus() {
  const { user, error } = await requireActionUser();
  if (error) return error;

  return ok({
    email: user.email,
    emailVerified: user.emailVerified,
    emailVerifiedAt: user.emailVerifiedAt ?? null,
    isPlaceholder: isPlaceholderEmail(user.email),
  });
}

export async function getMyEmailLogs(limit = 20) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const logs = await prisma.emailLog.findMany({
    where: {
      OR: [{ userId: user.id }, { to: { contains: user.email } }],
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 50),
    select: {
      id: true,
      subject: true,
      templateKey: true,
      status: true,
      sentAt: true,
      createdAt: true,
    },
  });

  return ok({ logs });
}

export async function changeEmail(input: z.infer<typeof changeEmailSchema>) {
  const { user, error } = await requireActionUser();
  if (error) return error;

  const parsed = changeEmailSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid email address");

  const nextEmail = normalizeEmail(parsed.data.email);
  if (!isValidEmail(nextEmail)) return fail("Invalid email address");
  if (nextEmail === normalizeEmail(user.email)) return fail("That is already your email");

  const taken = await prisma.user.findFirst({
    where: { email: nextEmail, id: { not: user.id }, deletedAt: null },
  });
  if (taken) return fail("Email is already in use");

  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({ email: nextEmail });
  if (updateError) return fail(updateError.message);

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: false, emailVerifiedAt: null },
  });

  await createAuditLog({
    actorId: user.id,
    action: "user.email_change_requested",
    entityType: "User",
    entityId: user.id,
    metadata: { from: user.email, to: nextEmail },
  });

  void sendEmail({
    to: user.email,
    subject: `[${SITE.name}] Email change requested`,
    html: `<p>Hi ${user.displayName ?? user.username},</p><p>We received a request to change your account email to <strong>${nextEmail}</strong>.</p><p>Check your inbox to confirm the change. If you did not request this, contact support immediately.</p>`,
    templateKey: "email_change_notice",
    userId: user.id,
  });

  revalidatePath("/dashboard/settings");
  return ok({ message: "Confirmation sent to your new email address" });
}

export async function resendVerificationEmail(locale = "en") {
  const { user, error } = await requireActionUser();
  if (error) return error;

  if (isPlaceholderEmail(user.email)) {
    return fail("Add an email address in account settings first");
  }
  if (user.emailVerified) return fail("Your email is already verified");

  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = rateLimit(`verify-resend:${user.id}:${ip}`, 3, 60 * 60 * 1000);
  if (!rl.success) {
    return ok({ message: userFriendlyAuthCodeMessage("verification_error", locale) });
  }

  try {
    await sendAuthVerificationEmail({
      email: user.email,
      username: user.displayName ?? user.username,
      locale,
      type: "magiclink",
      userId: user.id,
      redirectPath: `/${locale}/dashboard/settings`,
    });
  } catch (err) {
    void logPlatformError("auth:resend-verification", err);
    return ok({ message: userFriendlyAuthCodeMessage("verification_error", locale) });
  }

  await createAuditLog({
    actorId: user.id,
    action: "user.verification_resent",
    entityType: "User",
    entityId: user.id,
  });

  return ok({ message: userFriendlyAuthCodeMessage("verification_error", locale) });
}
