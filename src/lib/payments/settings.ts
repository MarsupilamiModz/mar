import { prisma } from "@/lib/db";

export type PaymentSettings = {
  stripeEnabled: boolean;
  paypalEnabled: boolean;
  applePayEnabled: boolean;
  googlePayEnabled: boolean;
  currency: string;
  taxPercent: number;
  stripePublishableKey?: string;
  stripeSecretKeySet: boolean;
  stripeWebhookSecretSet: boolean;
  paypalClientId?: string;
  paypalSecretSet: boolean;
};

const DEFAULT_SETTINGS: PaymentSettings = {
  stripeEnabled: true,
  paypalEnabled: false,
  applePayEnabled: true,
  googlePayEnabled: true,
  currency: "EUR",
  taxPercent: 0,
  stripeSecretKeySet: !!process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecretSet: !!process.env.STRIPE_WEBHOOK_SECRET,
  paypalSecretSet: false,
};

const KEY = "payment_settings";

export async function getPaymentSettings(): Promise<PaymentSettings> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
    if (!row?.value) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(row.value as PaymentSettings) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function savePaymentSettings(input: Partial<PaymentSettings>) {
  const current = await getPaymentSettings();
  const next = { ...current, ...input };
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: next },
    update: { value: next },
  });
  return next;
}
