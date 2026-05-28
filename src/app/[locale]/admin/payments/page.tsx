import { requireStaff } from "@/lib/auth";
import { getAdminPaymentSettings, listRecentStripeCheckouts } from "@/actions/admin/payments";
import { PaymentsAdminPanel } from "@/components/admin/payments-admin-panel";

export default async function AdminPaymentsPage() {
  await requireStaff();
  const [settingsResult, txResult] = await Promise.all([
    getAdminPaymentSettings(),
    listRecentStripeCheckouts(),
  ]);

  const settings = settingsResult.success ? settingsResult.data : {
    stripeEnabled: true,
    paypalEnabled: false,
    applePayEnabled: true,
    googlePayEnabled: true,
    currency: "EUR",
    taxPercent: 0,
    stripeSecretKeySet: false,
    stripeWebhookSecretSet: false,
    paypalSecretSet: false,
  };
  const transactions = txResult.success ? txResult.data : [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Payment Settings</h1>
      <p className="text-muted-foreground">Configure Stripe, PayPal, and view recent transactions.</p>
      <PaymentsAdminPanel settings={settings} transactions={transactions} />
    </div>
  );
}
