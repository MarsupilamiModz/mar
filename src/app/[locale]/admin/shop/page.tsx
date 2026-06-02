import { requireStaff } from "@/lib/auth";
import { listAdminShopProducts } from "@/actions/admin/shop";
import { getAdminPaymentSettings, listRecentStripeCheckouts } from "@/actions/admin/payments";
import { ShopAdminPanel } from "@/components/admin/shop-admin-panel";
import { PaymentStatusOverview } from "@/components/admin/payment-status-overview";
import type { Locale } from "@/i18n/config";

export default async function AdminShopPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requireStaff();
  const [result, settingsResult, txResult] = await Promise.all([
    listAdminShopProducts(),
    getAdminPaymentSettings(),
    listRecentStripeCheckouts(5),
  ]);
  const products = result.success ? result.data : [];
  const settings = settingsResult.success
    ? settingsResult.data
    : {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Shop Management</h1>
        <p className="text-muted-foreground">Manage credit packs, products, prices, and featured items.</p>
      </div>
      <PaymentStatusOverview settings={settings} transactions={transactions} locale={locale} compact />
      <ShopAdminPanel products={products} locale={locale} />
    </div>
  );
}
