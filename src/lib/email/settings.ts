import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";
import { SITE } from "@/lib/site";

export type SmtpEncryption = "SSL" | "TLS" | "STARTTLS" | "NONE";

export type EmailSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  senderEmail: string;
  senderName: string;
  encryption: SmtpEncryption;
  supportEmail: string;
  ticketNotificationEmail: string;
  customOrderEmail: string;
  paymentNotificationEmail: string;
  adminNotificationEmail: string;
  contactFormEmail: string;
};

export type EmailSettingsPublic = Omit<EmailSettings, "smtpPassword"> & {
  smtpPasswordSet: boolean;
  configured: boolean;
};

const KEY = "email_settings";

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  enabled: false,
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  senderEmail: "",
  senderName: SITE.name,
  encryption: "STARTTLS",
  supportEmail: "",
  ticketNotificationEmail: "",
  customOrderEmail: "",
  paymentNotificationEmail: "",
  adminNotificationEmail: "",
  contactFormEmail: "",
};

export async function getEmailSettings(): Promise<EmailSettings> {
  const stored = await getSiteSetting<Partial<EmailSettings>>(KEY, {});
  return { ...DEFAULT_EMAIL_SETTINGS, ...stored };
}

export async function getEmailSettingsPublic(): Promise<EmailSettingsPublic> {
  const settings = await getEmailSettings();
  const envPassword = process.env.SMTP_PASSWORD;
  const passwordSet = !!(settings.smtpPassword || envPassword);
  const configured = !!(
    settings.smtpHost &&
    settings.senderEmail &&
    passwordSet &&
    (settings.smtpUser || settings.encryption === "NONE")
  );
  const { smtpPassword: _pw, ...rest } = settings;
  return {
    ...rest,
    smtpPasswordSet: passwordSet,
    configured,
  };
}

export async function saveEmailSettings(input: Partial<EmailSettings>) {
  const current = await getEmailSettings();
  const next: EmailSettings = {
    ...current,
    ...input,
    smtpPassword: input.smtpPassword?.trim()
      ? input.smtpPassword
      : current.smtpPassword,
  };
  const saved = await setSiteSettingSafe(KEY, next);
  if (!saved.ok) throw new Error(saved.error);
  return getEmailSettingsPublic();
}

export function resolveEmailPassword(settings: EmailSettings) {
  return settings.smtpPassword || process.env.SMTP_PASSWORD || "";
}

export function resolveTargetEmail(
  settings: EmailSettings,
  target:
    | "support"
    | "ticket"
    | "order"
    | "payment"
    | "admin"
    | "contact"
): string | null {
  const map: Record<typeof target, string> = {
    support: settings.supportEmail,
    ticket: settings.ticketNotificationEmail || settings.supportEmail,
    order: settings.customOrderEmail || settings.adminNotificationEmail,
    payment: settings.paymentNotificationEmail || settings.adminNotificationEmail,
    admin: settings.adminNotificationEmail,
    contact: settings.contactFormEmail || settings.supportEmail,
  };
  const email = map[target]?.trim();
  return email || null;
}
