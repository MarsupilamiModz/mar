"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, requireActionPermission } from "@/lib/action-utils";
import { getPaymentSettings, savePaymentSettings, type PaymentSettings } from "@/lib/payments/settings";
import { getStripe } from "@/lib/stripe";

const settingsSchema = z.object({
  stripeEnabled: z.boolean().optional(),
  paypalEnabled: z.boolean().optional(),
  applePayEnabled: z.boolean().optional(),
  googlePayEnabled: z.boolean().optional(),
  currency: z.string().max(8).optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  stripePublishableKey: z.string().optional(),
  paypalClientId: z.string().optional(),
});

export async function getAdminPaymentSettings() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;
  return ok(await getPaymentSettings());
}

export async function updateAdminPaymentSettings(input: z.infer<typeof settingsSchema>) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.message);

  const saved = await savePaymentSettings(parsed.data as Partial<PaymentSettings>);
  revalidatePath("/admin/payments");
  return ok(saved);
}

export async function testStripeConnection() {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  try {
    const stripe = getStripe();
    await stripe.balance.retrieve();
    return ok({ connected: true });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Stripe connection failed");
  }
}

export async function listRecentStripeCheckouts(limit = 20) {
  const { error } = await requireActionPermission("settings.write");
  if (error) return error;

  try {
    const stripe = getStripe();
    const sessions = await stripe.checkout.sessions.list({ limit });
    return ok(
      sessions.data.map((s) => ({
        id: s.id,
        amount: s.amount_total,
        currency: s.currency,
        status: s.status,
        type: s.metadata?.type ?? "unknown",
        created: s.created,
      }))
    );
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Failed to load transactions");
  }
}
