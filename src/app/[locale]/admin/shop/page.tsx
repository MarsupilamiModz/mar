import { requirePagePermission } from "@/lib/auth";
import { listAdminShopProducts } from "@/actions/admin/shop";
import { getAdminPaymentSettings, listRecentStripeCheckouts } from "@/actions/admin/payments";
import { ShopAdminPanel } from "@/components/admin/shop-admin-panel";
import { AdminSafeBoundary } from "@/components/admin/admin-safe-boundary";
import { PaymentStatusOverview } from "@/components/admin/payment-status-overview";
import type { Locale } from "@/i18n/config";

export default async function AdminShopPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requirePagePermission("settings.write");
  const [result, settingsResult, txResult] = await Promise.all([
    listAdminShopProducts(),
    getAdminPaymentSettings(),
    listRecentStripeCheckouts(5),
  ]);
  const products = result.success ? result.data : [];
  const loadError = !result.success ? result.error : null;
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
      {loadError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      )}
      <PaymentStatusOverview settings={settings} transactions={transactions} locale={locale} compact />
      <AdminSafeBoundary title="Shop management error">
        <ShopAdminPanel products={products} locale={locale} />
      </AdminSafeBoundary>
    </div>
  );
}
