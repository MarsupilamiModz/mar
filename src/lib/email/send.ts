import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";
import { SITE } from "@/lib/site";
import {
  getEmailSettings,
  resolveEmailPassword,
  type EmailSettings,
  type SmtpProviderConfig,
} from "@/lib/email/settings";

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  templateKey?: string;
  queueOnFailure?: boolean;
  userId?: string;
};

function buildTransportFromConfig(config: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  encryption: EmailSettings["encryption"];
}) {
  const secure = config.encryption === "SSL";
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure,
    requireTLS: config.encryption === "TLS" || config.encryption === "STARTTLS",
    auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
  });
}

function buildTransport(settings: EmailSettings) {
  return buildTransportFromConfig({
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpPassword: resolveEmailPassword(settings),
    encryption: settings.encryption,
  });
}

async function sendViaSmtpConfig(
  config: SmtpProviderConfig,
  settings: EmailSettings,
  params: SendEmailParams
): Promise<boolean> {
  if (!config.enabled || !config.smtpHost || !settings.senderEmail) return false;
  const transport = buildTransportFromConfig({
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpUser: config.smtpUser,
    smtpPassword: config.smtpPassword,
    encryption: config.encryption,
  });
  await transport.sendMail({
    from: `"${settings.senderName || SITE.name}" <${settings.senderEmail}>`,
    to: params.to,
    replyTo: settings.replyToEmail || undefined,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });
  return true;
}

async function sendViaResend(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? `${SITE.name} <noreply@xumari-modz.com>`;
  if (!apiKey) return false;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: Array.isArray(params.to) ? params.to : [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });
  return res.ok;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const recipients = Array.isArray(params.to) ? params.to.join(",") : params.to;
  let logId: string | null = null;

  try {
    const log = await prisma.emailLog.create({
      data: {
        to: recipients,
        subject: params.subject,
        templateKey: params.templateKey,
        html: params.html,
        status: "PENDING",
        userId: params.userId,
      },
    });
    logId = log.id;
  } catch (err) {
    console.error("[email] log create failed", err);
  }

  const settings = await getEmailSettings();
  let sent = false;
  let lastError: string | null = null;
  const providerAttempts: string[] = [];

  if (settings.enabled && (settings.authMode === "microsoft" || settings.authMode === "graph") && settings.senderEmail) {
    providerAttempts.push("microsoft");
    try {
      const { sendViaMicrosoftGraph } = await import("@/lib/email/microsoft-graph");
      const { resolveMicrosoftSecret } = await import("@/lib/email/settings");
      await sendViaMicrosoftGraph({
        tenantId: settings.microsoftTenantId,
        clientId: settings.microsoftClientId,
        clientSecret: resolveMicrosoftSecret(settings),
        senderEmail: settings.senderEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: settings.replyToEmail || undefined,
      });
      sent = true;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Microsoft Graph send failed";
      console.error("[email] Microsoft Graph error:", lastError);
    }
  }

  if (!sent && settings.enabled && settings.authMode === "smtp" && settings.smtpHost && settings.senderEmail) {
    providerAttempts.push("smtp");
    try {
      const transport = buildTransport(settings);
      await transport.sendMail({
        from: `"${settings.senderName || SITE.name}" <${settings.senderEmail}>`,
        to: params.to,
        replyTo: settings.replyToEmail || undefined,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      sent = true;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "SMTP send failed";
      console.error("[email] SMTP error:", lastError);
    }
  }

  if (!sent && settings.fallbackSes.enabled) {
    providerAttempts.push("ses");
    try {
      sent = await sendViaSmtpConfig(settings.fallbackSes, settings, params);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Amazon SES send failed";
      console.error("[email] SES error:", lastError);
    }
  }

  if (!sent && settings.fallbackBrevo.enabled) {
    providerAttempts.push("brevo");
    try {
      sent = await sendViaSmtpConfig(settings.fallbackBrevo, settings, params);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Brevo send failed";
      console.error("[email] Brevo error:", lastError);
    }
  }

  if (!sent) {
    providerAttempts.push("resend");
    try {
      sent = await sendViaResend(params);
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Resend failed";
    }
  }

  if (!sent && !settings.enabled && !process.env.RESEND_API_KEY) {
    console.warn("[email] No provider configured — logging only", { providers: providerAttempts });
    console.info("[email]", params.subject, "→", recipients);
    lastError = "No email provider configured";
  }

  if (logId) {
    await prisma.emailLog
      .update({
        where: { id: logId },
        data: {
          status: sent ? "SENT" : "FAILED",
          error: sent ? null : lastError,
          sentAt: sent ? new Date() : null,
          attempts: { increment: 1 },
        },
      })
      .catch(() => undefined);
  }

  return sent;
}

export async function testSmtpConnection(settingsOverride?: Partial<EmailSettings>) {
  const settings = { ...(await getEmailSettings()), ...settingsOverride };
  if (settings.authMode === "microsoft") {
    const { testMicrosoftGraphConnection } = await import("@/lib/email/microsoft-graph");
    const { resolveMicrosoftSecret } = await import("@/lib/email/settings");
    if (!settings.microsoftTenantId || !settings.microsoftClientId) {
      throw new Error("Microsoft Tenant ID and Client ID are required");
    }
    return testMicrosoftGraphConnection({
      tenantId: settings.microsoftTenantId,
      clientId: settings.microsoftClientId,
      clientSecret: resolveMicrosoftSecret(settings),
      senderEmail: settings.senderEmail,
    });
  }
  if (!settings.smtpHost) throw new Error("SMTP host is required");

  const transport = buildTransport(settings);
  await transport.verify();
  return true;
}

export async function retryFailedEmail(logId: string) {
  const log = await prisma.emailLog.findUnique({ where: { id: logId } });
  if (!log || log.status !== "FAILED" || !log.html) {
    throw new Error("Email log not found or not retryable");
  }

  return sendEmail({
    to: log.to.split(","),
    subject: log.subject,
    html: log.html,
    templateKey: log.templateKey ?? undefined,
  });
}

export async function sendCustomOrderNotification(order: {
  id: string;
  title: string;
  description: string;
  orderType: string;
  budgetCents?: number | null;
  invoiceNumber?: string | null;
  client: {
    username: string;
    email: string;
    displayName?: string | null;
    discordUsername?: string | null;
  };
  attachments?: { fileName: string }[];
}) {
  const { getEmailSettings, resolveTargetEmail } = await import("@/lib/email/settings");
  const { getEmailTemplates, renderTemplate } = await import("@/lib/email/templates");
  const { formatCreditsFromCents } = await import("@/lib/credits");
  const { getAppUrl } = await import("@/lib/app-url");

  const settings = await getEmailSettings();
  const adminEmail =
    resolveTargetEmail(settings, "order") ??
    process.env.ADMIN_ORDER_EMAIL ??
    process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1];

  if (!adminEmail) {
    console.warn("[email] No custom order email configured");
    return false;
  }

  const name = order.client.displayName ?? order.client.username;
  const budget = order.budgetCents ? formatCreditsFromCents(order.budgetCents) : "Not specified";
  const attachmentList = order.attachments?.length
    ? order.attachments.map((a) => a.fileName).join(", ")
    : "None";

  const templates = await getEmailTemplates();
  const tpl = templates.find((t) => t.key === "order");
  const rendered = tpl
    ? renderTemplate(tpl, {
        username: name,
        order_id: order.invoiceNumber ?? order.id.slice(0, 8),
        order_title: order.title,
        email: order.client.email,
        discord: order.client.discordUsername ?? "—",
        message: `${order.description}\n\nType: ${order.orderType}\nBudget: ${budget}\nFiles: ${attachmentList}`,
        website_name: SITE.name,
      })
    : null;

  const html =
    rendered?.html ??
    `<p><strong>New Custom Order</strong></p><p>${order.title}</p><p>Customer: ${name}</p><p><a href="${getAppUrl()}/en/admin/orders/${order.id}">View in admin</a></p>`;

  return sendEmail({
    to: adminEmail,
    subject: rendered?.subject ?? `[Custom Order] ${order.title} — ${name}`,
    html,
    templateKey: "order",
  });
}

export async function sendOrderStatusEmail(params: {
  orderId: string;
  title: string;
  body: string;
  template?: "status" | "assigned" | "completed" | "revision";
}) {
  const order = await prisma.customOrder.findUnique({
    where: { id: params.orderId },
    select: {
      id: true,
      title: true,
      invoiceNumber: true,
      customerEmail: true,
      client: { select: { email: true, username: true, displayName: true } },
    },
  });
  if (!order) return false;

  const to = order.customerEmail ?? order.client.email;
  const name = order.client.displayName ?? order.client.username;
  const subjectPrefix =
    params.template === "completed"
      ? "Order completed"
      : params.template === "assigned"
        ? "Order assigned"
        : params.template === "revision"
          ? "Revision requested"
          : "Order update";

  return sendEmail({
    to,
    subject: `[${SITE.name}] ${subjectPrefix}: ${order.title}`,
    html: `<p>Hi ${name},</p><p><strong>${params.title}</strong></p><p>${params.body}</p>`,
    templateKey: "order",
  });
}

export async function sendOrderMessageEmail(params: { orderId: string; preview: string }) {
  const order = await prisma.customOrder.findUnique({
    where: { id: params.orderId },
    select: {
      title: true,
      customerEmail: true,
      client: { select: { email: true, username: true, displayName: true } },
    },
  });
  if (!order) return false;

  const to = order.customerEmail ?? order.client.email;
  const name = order.client.displayName ?? order.client.username;

  return sendEmail({
    to,
    subject: `[${SITE.name}] New message on order: ${order.title}`,
    html: `<p>Hi ${name},</p><p>You have a new message on your order <strong>${order.title}</strong>:</p><p>${params.preview}</p>`,
    templateKey: "order",
  });
}

export async function sendTicketNotification(params: {
  type: "created" | "reply" | "updated";
  ticketNumber: string;
  subject: string;
  message: string;
  username: string;
  userEmail?: string;
}) {
  const { getEmailSettings, resolveTargetEmail } = await import("@/lib/email/settings");
  const { getEmailTemplates, renderTemplate } = await import("@/lib/email/templates");

  const settings = await getEmailSettings();
  const staffEmail = resolveTargetEmail(settings, "ticket");

  const templates = await getEmailTemplates();
  const staffTpl = templates.find((t) => t.key === "support");
  const userTpl = templates.find(
    (t) => t.key === (params.type === "created" ? "ticket_created" : "ticket_reply")
  );

  const vars = {
    username: params.username,
    ticket_id: params.ticketNumber,
    subject: params.subject,
    message: params.message,
    website_name: SITE.name,
  };

  const sends: Promise<boolean>[] = [];

  if (staffEmail && staffTpl) {
    const rendered = renderTemplate(staffTpl, vars);
    sends.push(
      sendEmail({
        to: staffEmail,
        subject: rendered.subject,
        html: rendered.html,
        templateKey: "support",
      })
    );
  }

  if (params.userEmail && userTpl) {
    const rendered = renderTemplate(userTpl, vars);
    sends.push(
      sendEmail({
        to: params.userEmail,
        subject: rendered.subject,
        html: rendered.html,
        templateKey: userTpl.key,
      })
    );
  }

  if (sends.length === 0) return false;
  const results = await Promise.all(sends);
  return results.some(Boolean);
}

export async function sendWelcomeEmail(params: { email: string; username: string }) {
  const { getEmailTemplates, renderTemplate } = await import("@/lib/email/templates");
  const templates = await getEmailTemplates();
  const tpl = templates.find((t) => t.key === "welcome");
  const rendered = tpl
    ? renderTemplate(tpl, {
        username: params.username,
        website_name: SITE.name,
      })
    : null;

  return sendEmail({
    to: params.email,
    subject: rendered?.subject ?? `Welcome to ${SITE.name}`,
    html: rendered?.html ?? `<p>Hi ${params.username}, welcome to ${SITE.name}!</p>`,
    templateKey: "welcome",
  });
}

export async function sendCreatorApprovalEmail(params: {
  email: string;
  creatorName: string;
}) {
  const { getEmailTemplates, renderTemplate } = await import("@/lib/email/templates");
  const templates = await getEmailTemplates();
  const tpl = templates.find((t) => t.key === "creator_approval");
  const rendered = tpl
    ? renderTemplate(tpl, {
        creator_name: params.creatorName,
        username: params.creatorName,
        website_name: SITE.name,
      })
    : null;

  return sendEmail({
    to: params.email,
    subject: rendered?.subject ?? `Creator application approved — ${SITE.name}`,
    html:
      rendered?.html ??
      `<p>Hi ${params.creatorName}, your creator profile on ${SITE.name} has been approved.</p>`,
    templateKey: "creator_approval",
  });
}

export async function sendPartnerApprovalEmail(params: {
  email: string;
  partnerName: string;
}) {
  const { getEmailTemplates, renderTemplate } = await import("@/lib/email/templates");
  const templates = await getEmailTemplates();
  const tpl = templates.find((t) => t.key === "partner_approval");
  const rendered = tpl
    ? renderTemplate(tpl, {
        creator_name: params.partnerName,
        username: params.partnerName,
        website_name: SITE.name,
      })
    : null;

  return sendEmail({
    to: params.email,
    subject: rendered?.subject ?? `Partner application approved — ${SITE.name}`,
    html:
      rendered?.html ??
      `<p>Hi ${params.partnerName}, your partner profile on ${SITE.name} has been approved.</p>`,
    templateKey: "partner_approval",
  });
}

export async function sendPremiumActivationEmail(params: { email: string; username: string }) {
  const { getEmailTemplates, renderTemplate } = await import("@/lib/email/templates");
  const templates = await getEmailTemplates();
  const tpl = templates.find((t) => t.key === "premium");
  const rendered = tpl
    ? renderTemplate(tpl, {
        username: params.username,
        website_name: SITE.name,
      })
    : null;

  return sendEmail({
    to: params.email,
    subject: rendered?.subject ?? `${SITE.name} Premium activated`,
    html:
      rendered?.html ??
      `<p>Hi ${params.username}, your Premium access on ${SITE.name} is now active.</p>`,
    templateKey: "premium",
  });
}

export async function sendPaymentNotification(params: {
  type: string;
  amountCents: number;
  userId: string;
  username?: string;
  reference?: string;
}) {
  const { getEmailSettings, resolveTargetEmail } = await import("@/lib/email/settings");
  const { formatCreditsFromCents } = await import("@/lib/credits");

  const settings = await getEmailSettings();
  const paymentEmail = resolveTargetEmail(settings, "payment");
  const adminEmail = resolveTargetEmail(settings, "admin");
  const recipients = Array.from(
    new Set([paymentEmail, adminEmail].filter((e): e is string => Boolean(e)))
  );

  if (recipients.length === 0) {
    console.warn("[email] No payment notification email configured");
    return false;
  }

  const amount = formatCreditsFromCents(params.amountCents);
  const userLabel = params.username ?? params.userId;
  const html = `
    <p><strong>Payment received</strong></p>
    <p>Type: ${params.type}</p>
    <p>Amount: ${amount}</p>
    <p>User: ${userLabel}</p>
    ${params.reference ? `<p>Reference: ${params.reference}</p>` : ""}
  `;

  const results = await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: `[${SITE.name}] Payment — ${params.type} (${amount})`,
        html,
      })
    )
  );
  return results.some(Boolean);
}
