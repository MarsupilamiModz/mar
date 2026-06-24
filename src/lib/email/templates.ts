import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";
import { SITE } from "@/lib/site";

export type EmailTemplateKey =
  | "support"
  | "order"
  | "welcome"
  | "premium"
  | "creator_approval"
  | "partner_approval"
  | "ticket_created"
  | "ticket_reply"
  | "email_verification";

export type EmailTemplate = {
  key: EmailTemplateKey;
  name: string;
  subject: string;
  html: string;
};

export const TEMPLATE_VARIABLES = [
  "{username}",
  "{ticket_id}",
  "{order_id}",
  "{website_name}",
  "{creator_name}",
  "{subject}",
  "{message}",
  "{order_title}",
  "{discord}",
  "{email}",
  "{verify_link}",
] as const;

const KEY = "email_templates";

const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    key: "support",
    name: "Support notification",
    subject: "[{website_name}] New support ticket {ticket_id}",
    html: `<p>Hello,</p><p>A new support ticket was created: <strong>{ticket_id}</strong></p><p><strong>From:</strong> {username}</p><p>{message}</p>`,
  },
  {
    key: "order",
    name: "Custom order notification",
    subject: "[{website_name}] New custom order {order_id}",
    html: `<p>New custom order <strong>{order_title}</strong> ({order_id})</p><p>Customer: {username} ({email})</p><p>Discord: {discord}</p><p>{message}</p>`,
  },
  {
    key: "welcome",
    name: "Welcome email",
    subject: "Welcome to {website_name}, {username}!",
    html: `<p>Hi {username},</p><p>Welcome to {website_name}! Your account is ready.</p>`,
  },
  {
    key: "premium",
    name: "Premium activation",
    subject: "{website_name} Premium activated",
    html: `<p>Hi {username},</p><p>Your Premium access on {website_name} is now active.</p>`,
  },
  {
    key: "creator_approval",
    name: "Creator approval",
    subject: "Creator application approved — {website_name}",
    html: `<p>Hi {creator_name},</p><p>Your creator profile on {website_name} has been approved.</p>`,
  },
  {
    key: "partner_approval",
    name: "Partner approval",
    subject: "Partner application approved — {website_name}",
    html: `<p>Hi {creator_name},</p><p>Your partner profile on {website_name} has been approved.</p>`,
  },
  {
    key: "ticket_created",
    name: "Ticket confirmation (user)",
    subject: "We received your ticket {ticket_id}",
    html: `<p>Hi {username},</p><p>We received your support request <strong>{ticket_id}</strong>. Our team will respond soon.</p>`,
  },
  {
    key: "ticket_reply",
    name: "Ticket reply notification",
    subject: "Update on ticket {ticket_id}",
    html: `<p>Hi {username},</p><p>There is a new reply on ticket <strong>{ticket_id}</strong>.</p><p>{message}</p>`,
  },
  {
    key: "email_verification",
    name: "Email verification",
    subject: "Verify your email — {website_name}",
    html: `<p>Hi {username},</p><p>Please verify your email address to activate your {website_name} account.</p><p><a href="{verify_link}" style="display:inline-block;padding:12px 20px;background:#a855f7;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Verify email address</a></p><p style="font-size:12px;color:#71717a">If you did not create this account, you can ignore this email.</p>`,
  },
];

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const stored = await getSiteSetting<Partial<Record<EmailTemplateKey, Omit<EmailTemplate, "key">>>>(
    KEY,
    {}
  );
  return DEFAULT_TEMPLATES.map((t) => ({
    ...t,
    ...(stored[t.key] ?? {}),
    key: t.key,
    name: stored[t.key]?.name ?? t.name,
    subject: stored[t.key]?.subject ?? t.subject,
    html: stored[t.key]?.html ?? t.html,
  }));
}

export async function saveEmailTemplate(
  key: EmailTemplateKey,
  data: { name: string; subject: string; html: string }
) {
  const stored = await getSiteSetting<Partial<Record<EmailTemplateKey, Omit<EmailTemplate, "key">>>>(
    KEY,
    {}
  );
  stored[key] = data;
  const saved = await setSiteSettingSafe(KEY, stored);
  if (!saved.ok) throw new Error(saved.error);
}

export function renderTemplate(
  template: Pick<EmailTemplate, "subject" | "html">,
  vars: Record<string, string>
) {
  const website = vars.website_name ?? SITE.name;
  const merged = { website_name: website, ...vars };
  let subject = template.subject;
  let html = template.html;
  for (const [key, value] of Object.entries(merged)) {
    const token = `{${key}}`;
    subject = subject.split(token).join(value);
    html = html.split(token).join(value);
  }
  return { subject, html: wrapEmailHtml(html) };
}

export function wrapEmailHtml(body: string) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a0a0f;color:#f4f4f5;border-radius:12px;border:1px solid #a855f740">
      <div style="margin-bottom:16px;font-weight:700;color:#a855f7">${SITE.name}</div>
      ${body}
      <p style="margin-top:24px;font-size:12px;color:#71717a">© ${SITE.name}</p>
    </div>
  `;
}
