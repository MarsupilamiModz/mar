/** @deprecated Credit system removed. Use @/lib/currency for money formatting. */
import { formatMoneyFromCents } from "@/lib/currency";

/** @deprecated 1 EUR = 100 credits in legacy UI hints */
export const CREDITS_PER_EUR = 100;

export { formatMoneyFromCents as formatCreditsFromCents, formatMoneyFromCents };

export function formatCredits(credits: number, locale = "en"): string {
  return formatMoneyFromCents(credits, locale);
}

export function centsToCredits(cents: number): number {
  return cents;
}

export function creditsToCents(credits: number): number {
  return credits;
}

export async function getWalletBalance(_userId: string): Promise<number> {
  return 0;
}

export async function getOrCreateWallet(_userId: string) {
  throw new Error("Credit wallets are no longer available");
}

export async function creditWallet(_params: unknown) {
  throw new Error("Credit wallets are no longer available");
}

export async function getCreditHistory(_userId: string) {
  return null;
}
