"use client";

import { PaymentStatusOverview } from "@/components/admin/payment-status-overview";
import type { PaymentSettings } from "@/lib/payments/settings";

export function PaymentsAdminPanel({
  settings,
  transactions,
  locale = "en",
}: {
  settings: PaymentSettings;
  transactions: { id: string; amount: number | null; currency: string | null; status: string | null; type: string; created: number }[];
  locale?: string;
}) {
  return <PaymentStatusOverview settings={settings} transactions={transactions} locale={locale} />;
}
