"use server";

import { headers, cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createServiceClient } from "@/lib/supabase/server";
import { fail, ok, type ActionResult } from "@/lib/action-utils";
import { sendAuthVerificationEmail } from "@/lib/auth-verification-email";
import {
  classifyAuthError,
  userFriendlyAuthCodeMessage,
  userFriendlyAuthMessage,
} from "@/lib/auth-errors";
import { isValidEmail, normalizeEmail } from "@/lib/email/address";
import { logPlatformError } from "@/lib/platform-log";
import { rateLimit } from "@/lib/rate-limit";
import { isTurnstileEnabled, verifyTurnstileToken } from "@/lib/turnstile";
import { uniqueUsername } from "@/lib/user-sync";
import { REFERRAL_COOKIE } from "@/lib/referral-cookie";
import { redeemReferralForUser } from "@/lib/referral";

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  locale: z.enum(["en", "de", "fr", "es", "tr", "pl"]).default("en"),
  turnstileToken: z.string().optional(),
  website: z.string().optional(),
  fingerprint: z.string().max(128).optional(),
});

function clientIp() {
  return headers().get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

async function queueVerification(params: {
  email: string;
  password?: string;
  locale: string;
  username: string;
  userId?: string;
}) {
  try {
    await sendAuthVerificationEmail({
      email: params.email,
      username: params.username,
      locale: params.locale,
      type: params.password ? "signup" : "magiclink",
      password: params.password,
      userId: params.userId,
    });
  } catch (err) {
    void logPlatformError("auth:register-verification-queue", err);
  }
}

async function resendForExistingUser(params: {
  email: string;
  locale: string;
  password?: string;
}) {
  const existing = await prisma.user.findFirst({
    where: { email: params.email, deletedAt: null },
    select: { id: true, username: true, displayName: true, emailVerified: true },
  });

  if (existing?.emailVerified) {
    return fail(userFriendlyAuthCodeMessage("user_exists", params.locale));
  }

  const username = existing?.displayName ?? existing?.username ?? params.email.split("@")[0];
  void queueVerification({
    email: params.email,
    password: params.password,
    locale: params.locale,
    username,
    userId: existing?.id,
  });

  return ok({ status: "pending_verification" as const });
}

export async function registerUser(
  input: z.infer<typeof registerSchema>
): Promise<ActionResult<{ status: "pending_verification" | "active" }>> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return fail(userFriendlyAuthCodeMessage("weak_password", input.locale ?? "en"));
  }

  const { email: rawEmail, password, locale, turnstileToken, website, fingerprint } = parsed.data;

  if (website?.trim()) {
    return ok({ status: "pending_verification" });
  }

  const ip = clientIp();
  const ipLimit = rateLimit(`register:ip:${ip}`, 8, 60 * 60 * 1000);
  if (!ipLimit.success) {
    void logPlatformError("auth:register-rate-limit", new Error(`IP rate limit: ${ip}`));
    return ok({ status: "pending_verification" });
  }

  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) {
    return fail(userFriendlyAuthCodeMessage("auth_error", locale));
  }

  const emailLimit = rateLimit(`register:email:${email}`, 3, 60 * 60 * 1000);
  if (!emailLimit.success) {
    void logPlatformError("auth:register-email-rate-limit", new Error(`Email rate limit: ${email}`));
    return ok({ status: "pending_verification" });
  }

  if (isTurnstileEnabled()) {
    const valid = await verifyTurnstileToken(turnstileToken ?? "", ip);
    if (!valid) {
      void logPlatformError("auth:register-turnstile", new Error(`Turnstile failed for ${ip}`));
      return fail(userFriendlyAuthCodeMessage("bot_detected", locale));
    }
  }

  const existingVerified = await prisma.user.findFirst({
    where: { email, deletedAt: null, emailVerified: true },
    select: { id: true },
  });
  if (existingVerified) {
    return fail(userFriendlyAuthCodeMessage("user_exists", locale));
  }

  const existingPending = await prisma.user.findFirst({
    where: { email, deletedAt: null, emailVerified: false },
    select: { id: true, username: true, displayName: true },
  });
  if (existingPending) {
    void queueVerification({
      email,
      locale,
      username: existingPending.displayName ?? existingPending.username,
      userId: existingPending.id,
    });
    return ok({ status: "pending_verification" });
  }

  const admin = await createServiceClient();
  const username = await uniqueUsername(email.split("@")[0] ?? "user");

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
    user_metadata: { full_name: username, registration_fingerprint: fingerprint ?? null },
  });

  if (authError) {
    void logPlatformError("auth:register-create-user", authError);
    const code = classifyAuthError(authError.message);
    if (code === "user_exists") {
      return resendForExistingUser({ email, locale, password });
    }
    if (code === "email_rate_limit_exceeded" || code === "rate_limit_exceeded" || code === "smtp_error") {
      return ok({ status: "pending_verification" });
    }
    if (code === "weak_password") {
      return fail(userFriendlyAuthMessage(authError.message, locale));
    }
    return ok({ status: "pending_verification" });
  }

  let dbUser;
  try {
    dbUser = await prisma.user.create({
      data: {
        supabaseId: authData.user.id,
        email,
        username,
        displayName: username,
        emailVerified: false,
      },
    });
  } catch (err) {
    void logPlatformError("auth:register-prisma-create", err);
    await admin.auth.admin.deleteUser(authData.user.id).catch(() => undefined);
    return ok({ status: "pending_verification" });
  }

  void queueVerification({ email, password, locale, username, userId: dbUser.id });

  const cookieStore = await cookies();
  const refCode = cookieStore.get(REFERRAL_COOKIE)?.value;
  if (refCode) {
    void redeemReferralForUser(dbUser.id, refCode).finally(() => {
      try {
        cookieStore.delete(REFERRAL_COOKIE);
      } catch {
        // cookie cleanup best-effort
      }
    });
  }

  void import("@/lib/notifications-service")
    .then(({ notifyOwnerPlatformEvent }) =>
      notifyOwnerPlatformEvent({
        title: "New registration",
        body: `${username} (${email}) registered — pending email verification.`,
        link: `/en/admin/owner/users/${dbUser.id}`,
        category: "registrations",
      })
    )
    .catch(() => undefined);

  return ok({ status: "pending_verification" });
}
