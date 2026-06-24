import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";
import { queueEmail } from "@/lib/email/queue";
import { getEmailTemplates, renderTemplate } from "@/lib/email/templates";
import { SITE } from "@/lib/site";
import { logPlatformError } from "@/lib/platform-log";

export type VerificationEmailType = "signup" | "recovery" | "magiclink";

export async function generateAuthActionLink(params: {
  email: string;
  type: VerificationEmailType;
  locale: string;
  password?: string;
  redirectPath?: string;
}): Promise<string | null> {
  const admin = await createServiceClient();
  const redirectTo = `${getAppUrl()}/api/auth/callback?locale=${params.locale}&next=${params.redirectPath ?? `/${params.locale}/dashboard`}`;

  const linkParams =
    params.type === "signup" && params.password
      ? {
          type: "signup" as const,
          email: params.email,
          password: params.password,
          options: { redirectTo },
        }
      : params.type === "recovery"
        ? {
            type: "recovery" as const,
            email: params.email,
            options: { redirectTo: `${getAppUrl()}/${params.locale}/reset-password` },
          }
        : {
            type: "magiclink" as const,
            email: params.email,
            options: { redirectTo },
          };

  const { data, error } = await admin.auth.admin.generateLink(linkParams);
  if (error) {
    void logPlatformError("auth:generate-link", error);
    return null;
  }

  return data.properties?.action_link ?? null;
}

export async function sendAuthVerificationEmail(params: {
  email: string;
  username: string;
  locale: string;
  type: VerificationEmailType;
  password?: string;
  userId?: string;
  redirectPath?: string;
}): Promise<{ queued: boolean; linkGenerated: boolean }> {
  const link = await generateAuthActionLink({
    email: params.email,
    type: params.type,
    locale: params.locale,
    password: params.password,
    redirectPath: params.redirectPath,
  });

  if (!link) {
    void logPlatformError("auth:verification-email", new Error("Could not generate verification link"));
    return { queued: false, linkGenerated: false };
  }

  const templates = await getEmailTemplates();
  const tpl = templates.find((t) => t.key === "email_verification");
  const rendered = tpl
    ? renderTemplate(tpl, {
        username: params.username,
        website_name: SITE.name,
        verify_link: link,
      })
    : null;

  const subject =
    rendered?.subject ??
    (params.type === "recovery"
      ? `[${SITE.name}] Reset your password`
      : `[${SITE.name}] Verify your email address`);

  const html =
    rendered?.html ??
    `<p>Hi ${params.username},</p><p>Please verify your email address to continue using ${SITE.name}.</p><p><a href="${link}">Verify email address</a></p><p>If you did not create this account, you can ignore this email.</p>`;

  await queueEmail({
    to: params.email,
    subject,
    html,
    templateKey: "email_verification",
    userId: params.userId,
  });

  return { queued: true, linkGenerated: true };
}
