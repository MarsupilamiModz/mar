import { getAdminOrders } from "@/actions/orders";
import { getAdminShopAnalytics } from "@/actions/admin/shop";
import { OrderCenterAdmin } from "@/components/admin/order-center-admin";
import { requirePagePermission } from "@/lib/auth";
import type { Locale } from "@/i18n/config";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminOrdersPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  await requirePagePermission("orders.read");
  const t = await getTranslations("shop");

  const [result, analyticsResult] = await Promise.all([getAdminOrders(), getAdminShopAnalytics()]);
  const orders = result.success ? result.data : [];
  const analytics = analyticsResult.success ? analyticsResult.data : null;

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("orders.adminTitle")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("orders.adminSubtitle")}</p>
      <div className="mt-8">
        <OrderCenterAdmin initialOrders={orders} locale={locale} analytics={analytics} />
      </div>
    </div>
  );
}
