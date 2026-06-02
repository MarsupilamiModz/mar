"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import {
  getEmailSettings,
  getEmailSettingsPublic,
  saveEmailSettings,
  type EmailSettings,
  type SmtpEncryption,
} from "@/lib/email/settings";
import { getEmailTemplates, saveEmailTemplate, type EmailTemplateKey } from "@/lib/email/templates";
import { sendEmail, testSmtpConnection, retryFailedEmail } from "@/lib/email/send";
import { SITE } from "@/lib/site";

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().max(255).optional(),
  smtpPassword: z.string().max(255).optional(),
  senderEmail: z.string().email().optional().or(z.literal("")),
  senderName: z.string().max(120).optional(),
  encryption: z.enum(["SSL", "TLS", "STARTTLS", "NONE"]).optional(),
  supportEmail: z.string().email().optional().or(z.literal("")),
  ticketNotificationEmail: z.string().email().optional().or(z.literal("")),
  customOrderEmail: z.string().email().optional().or(z.literal("")),
  paymentNotificationEmail: z.string().email().optional().or(z.literal("")),
  adminNotificationEmail: z.string().email().optional().or(z.literal("")),
  contactFormEmail: z.string().email().optional().or(z.literal("")),
});

const templateSchema = z.object({
  name: z.string().min(2).max(120),
  subject: z.string().min(2).max(200),
  html: z.string().min(10).max(50000),
});

export async function getAdminEmailSettings() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await getEmailSettingsPublic());
}

export async function updateAdminEmailSettings(input: z.infer<typeof settingsSchema>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const saved = await saveEmailSettings(parsed.data as Partial<EmailSettings>);
  revalidatePath("/admin/email");
  return ok(saved);
}

export async function testAdminEmailConnection(input?: z.infer<typeof settingsSchema>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  try {
    if (input) {
      const current = await getEmailSettings();
      await testSmtpConnection({
        ...current,
        ...input,
        smtpPassword: input.smtpPassword?.trim() ? input.smtpPassword : current.smtpPassword,
        encryption: (input.encryption ?? current.encryption) as SmtpEncryption,
      });
    } else {
      await testSmtpConnection();
    }
    return ok({ connected: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "SMTP connection failed");
  }
}

export async function sendAdminTestEmail(to: string) {
  const { user, error } = await requireActionPermission("settings.write");
  if (error) return error;

  if (!to.includes("@")) return fail("Invalid email address");

  const sent = await sendEmail({
    to,
    subject: `${SITE.name} — Test Email`,
    html: `<p>This is a test email from ${SITE.name}.</p><p>Sent by admin ${user.username}.</p>`,
    templateKey: "test",
  });

  if (!sent) return fail("Failed to send test email. Check SMTP settings and logs.");
  return ok(undefined);
}

export async function getAdminEmailTemplates() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await getEmailTemplates());
}

export async function updateAdminEmailTemplate(
  key: EmailTemplateKey,
  input: z.infer<typeof templateSchema>
) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  await saveEmailTemplate(key, parsed.data);
  revalidatePath("/admin/email/templates");
  return ok(undefined);
}

export async function listAdminEmailLogs(limit = 50) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const logs = await prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    select: {
      id: true,
      to: true,
      subject: true,
      templateKey: true,
      status: true,
      error: true,
      attempts: true,
      sentAt: true,
      createdAt: true,
    },
  });

  return ok(logs);
}

export async function retryAdminEmailLog(logId: string) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  try {
    const sent = await retryFailedEmail(logId);
    revalidatePath("/admin/email");
    return sent ? ok(undefined) : fail("Retry failed");
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Retry failed");
  }
}
