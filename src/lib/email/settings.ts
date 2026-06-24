import { getSiteSetting, setSiteSettingSafe } from "@/lib/site-settings";
import { SITE } from "@/lib/site";

export type SmtpEncryption = "SSL" | "TLS" | "STARTTLS" | "NONE";

export type EmailAuthMode = "smtp" | "microsoft" | "graph";

export type SmtpProviderConfig = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  encryption: SmtpEncryption;
};

export type EmailSettings = {
  enabled: boolean;
  authMode: EmailAuthMode;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  microsoftTenantId: string;
  microsoftClientId: string;
  microsoftClientSecret: string;
  senderEmail: string;
  senderName: string;
  replyToEmail: string;
  encryption: SmtpEncryption;
  supportEmail: string;
  ticketNotificationEmail: string;
  customOrderEmail: string;
  paymentNotificationEmail: string;
  adminNotificationEmail: string;
  contactFormEmail: string;
  fallbackSes: SmtpProviderConfig;
  fallbackBrevo: SmtpProviderConfig;
};

export type EmailSettingsPublic = Omit<
  EmailSettings,
  "smtpPassword" | "microsoftClientSecret" | "fallbackSes" | "fallbackBrevo"
> & {
  smtpPasswordSet: boolean;
  microsoftSecretSet: boolean;
  configured: boolean;
  fallbackSes: Omit<SmtpProviderConfig, "smtpPassword"> & { passwordSet: boolean };
  fallbackBrevo: Omit<SmtpProviderConfig, "smtpPassword"> & { passwordSet: boolean };
};

const KEY = "email_settings";

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  enabled: false,
  authMode: "smtp",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  microsoftTenantId: "",
  microsoftClientId: "",
  microsoftClientSecret: "",
  senderEmail: "",
  senderName: SITE.name,
  replyToEmail: "",
  encryption: "STARTTLS",
  supportEmail: "",
  ticketNotificationEmail: "",
  customOrderEmail: "",
  paymentNotificationEmail: "",
  adminNotificationEmail: "",
  contactFormEmail: "",
  fallbackSes: {
    enabled: false,
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    encryption: "STARTTLS",
  },
  fallbackBrevo: {
    enabled: false,
    smtpHost: "smtp-relay.brevo.com",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    encryption: "STARTTLS",
  },
};

function mergeProviderConfig(
  defaults: SmtpProviderConfig,
  stored?: Partial<SmtpProviderConfig>
): SmtpProviderConfig {
  const merged = { ...defaults, ...stored };
  if (!merged.smtpPassword && stored?.smtpPassword) merged.smtpPassword = stored.smtpPassword;
  return merged;
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const stored = await getSiteSetting<Partial<EmailSettings>>(KEY, {});

  const envSes: Partial<SmtpProviderConfig> | undefined = process.env.SES_SMTP_HOST
    ? {
        enabled: true,
        smtpHost: process.env.SES_SMTP_HOST,
        smtpPort: Number(process.env.SES_SMTP_PORT ?? 587),
        smtpUser: process.env.SES_SMTP_USER ?? "",
        smtpPassword: process.env.SES_SMTP_PASSWORD ?? "",
        encryption: (process.env.SES_SMTP_ENCRYPTION as SmtpEncryption) ?? "STARTTLS",
      }
    : undefined;

  const envBrevo: Partial<SmtpProviderConfig> | undefined = process.env.BREVO_SMTP_HOST
    ? {
        enabled: true,
        smtpHost: process.env.BREVO_SMTP_HOST,
        smtpPort: Number(process.env.BREVO_SMTP_PORT ?? 587),
        smtpUser: process.env.BREVO_SMTP_USER ?? "",
        smtpPassword: process.env.BREVO_SMTP_PASSWORD ?? "",
        encryption: (process.env.BREVO_SMTP_ENCRYPTION as SmtpEncryption) ?? "STARTTLS",
      }
    : undefined;

  return {
    ...DEFAULT_EMAIL_SETTINGS,
    ...stored,
    fallbackSes: mergeProviderConfig(DEFAULT_EMAIL_SETTINGS.fallbackSes, {
      ...stored.fallbackSes,
      ...envSes,
      smtpPassword: stored.fallbackSes?.smtpPassword || envSes?.smtpPassword || "",
    }),
    fallbackBrevo: mergeProviderConfig(DEFAULT_EMAIL_SETTINGS.fallbackBrevo, {
      ...stored.fallbackBrevo,
      ...envBrevo,
      smtpPassword: stored.fallbackBrevo?.smtpPassword || envBrevo?.smtpPassword || "",
    }),
  };
}

export async function getEmailSettingsPublic(): Promise<EmailSettingsPublic> {
  const settings = await getEmailSettings();
  const envPassword = process.env.SMTP_PASSWORD;
  const passwordSet = !!(settings.smtpPassword || envPassword);
  const microsoftSecretSet = !!(
    settings.microsoftClientSecret || process.env.MICROSOFT_CLIENT_SECRET
  );
  const smtpConfigured = !!(
    settings.smtpHost &&
    settings.senderEmail &&
    passwordSet &&
    (settings.smtpUser || settings.encryption === "NONE")
  );
  const microsoftConfigured = !!(
    settings.microsoftTenantId &&
    settings.microsoftClientId &&
    microsoftSecretSet &&
    settings.senderEmail
  );
  const configured =
    settings.enabled &&
    (settings.authMode === "microsoft" || settings.authMode === "graph"
      ? microsoftConfigured
      : smtpConfigured);
  const { smtpPassword: _pw, microsoftClientSecret: _ms, fallbackSes, fallbackBrevo, ...rest } = settings;
  return {
    ...rest,
    smtpPasswordSet: passwordSet,
    microsoftSecretSet,
    configured,
    fallbackSes: {
      enabled: fallbackSes.enabled,
      smtpHost: fallbackSes.smtpHost,
      smtpPort: fallbackSes.smtpPort,
      smtpUser: fallbackSes.smtpUser,
      encryption: fallbackSes.encryption,
      passwordSet: !!fallbackSes.smtpPassword,
    },
    fallbackBrevo: {
      enabled: fallbackBrevo.enabled,
      smtpHost: fallbackBrevo.smtpHost,
      smtpPort: fallbackBrevo.smtpPort,
      smtpUser: fallbackBrevo.smtpUser,
      encryption: fallbackBrevo.encryption,
      passwordSet: !!fallbackBrevo.smtpPassword,
    },
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
    microsoftClientSecret: input.microsoftClientSecret?.trim()
      ? input.microsoftClientSecret
      : current.microsoftClientSecret,
    fallbackSes: {
      ...current.fallbackSes,
      ...input.fallbackSes,
      smtpPassword: input.fallbackSes?.smtpPassword?.trim()
        ? input.fallbackSes.smtpPassword
        : current.fallbackSes.smtpPassword,
    },
    fallbackBrevo: {
      ...current.fallbackBrevo,
      ...input.fallbackBrevo,
      smtpPassword: input.fallbackBrevo?.smtpPassword?.trim()
        ? input.fallbackBrevo.smtpPassword
        : current.fallbackBrevo.smtpPassword,
    },
  };
  const saved = await setSiteSettingSafe(KEY, next);
  if (!saved.ok) throw new Error(saved.error);
  return getEmailSettingsPublic();
}

export function resolveEmailPassword(settings: EmailSettings) {
  return settings.smtpPassword || process.env.SMTP_PASSWORD || "";
}

export function resolveMicrosoftSecret(settings: EmailSettings) {
  return settings.microsoftClientSecret || process.env.MICROSOFT_CLIENT_SECRET || "";
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
