import { requirePagePermission } from "@/lib/auth";
import {
  getAdminShopAnalytics,
  listAdminShopProducts,
  listShopCategories,
  listShopProductTypes,
} from "@/actions/admin/shop";
import { EnterpriseShopAdmin } from "@/components/admin/enterprise-shop-admin";
import { AdminSafeBoundary } from "@/components/admin/admin-safe-boundary";
import type { Locale } from "@/i18n/config";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function AdminShopPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  await requirePagePermission("shop.view");
  const t = await getTranslations("shop");

  const [productsResult, categoriesResult, typesResult, analyticsResult] = await Promise.all([
    listAdminShopProducts(true),
    listShopCategories(),
    listShopProductTypes(),
    getAdminShopAnalytics(),
  ]);

  const products = productsResult.success ? productsResult.data : [];
  const categories = categoriesResult.success ? categoriesResult.data : [];
  const productTypes = typesResult.success ? typesResult.data : [];
  const analytics = analyticsResult.success ? analyticsResult.data : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("admin.title")}</h1>
        <p className="text-muted-foreground">{t("admin.subtitle")}</p>
      </div>
      <AdminSafeBoundary title="Shop management error">
        <EnterpriseShopAdmin
          products={products}
          categories={categories}
          productTypes={productTypes}
          analytics={analytics}
          locale={locale}
        />
      </AdminSafeBoundary>
    </div>
  );
}
