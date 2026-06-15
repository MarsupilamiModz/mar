import { safeStripePriceId } from "@/lib/safe-string";

export type StripeConfigStatus = {
  configured: boolean;
  secretKeySet: boolean;
  webhookSecretSet: boolean;
  publishableKeySet: boolean;
  missing: string[];
};

export function getStripeConfigStatus(): StripeConfigStatus {
  const missing: string[] = [];
  if (!process.env.STRIPE_SECRET_KEY?.trim()) missing.push("STRIPE_SECRET_KEY");
  if (!process.env.STRIPE_WEBHOOK_SECRET?.trim()) missing.push("STRIPE_WEBHOOK_SECRET");

  return {
    configured: missing.length === 0,
    secretKeySet: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
    webhookSecretSet: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim()),
    publishableKeySet: Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()),
    missing,
  };
}

export function assertStripeConfigured(): void {
  const status = getStripeConfigStatus();
  if (!status.configured) {
    throw new Error(`Stripe is not configured. Missing: ${status.missing.join(", ")}`);
  }
}

export function isValidStripePriceId(priceId: string | null | undefined): priceId is string {
  const id = safeStripePriceId(priceId);
  return Boolean(id && /^price_[a-zA-Z0-9]+$/.test(id));
}

export function formatStripeError(err: unknown): string {
  if (err && typeof err === "object" && "type" in err && "message" in err) {
    const stripeErr = err as { type?: string; message?: string; code?: string };
    if (stripeErr.code === "resource_missing") {
      return "Stripe price ID not found — verify the Price ID in Admin → Memberships matches your Stripe account (test vs live keys must match).";
    }
    if (stripeErr.message) return stripeErr.message;
  }
  if (err instanceof Error) return err.message;
  return "Stripe checkout failed";
}

export function logStripeServer(event: string, detail?: Record<string, unknown>) {
  console.info("[stripe:server]", { ts: new Date().toISOString(), event, ...detail });
}
