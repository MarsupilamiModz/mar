import dynamic from "next/dynamic";
import { getShopCatalog } from "@/actions/shop";
import type { Locale } from "@/i18n/config";
import { getTranslations, setRequestLocale } from "next-intl/server";

const ShopCatalog = dynamic(
  () => import("@/components/shop/enterprise-shop").then((m) => m.ShopCatalog),
  { loading: () => <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-xl glass animate-pulse" />)}</div> }
);

export default async function ShopPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("shop");
  const { products, categories } = await getShopCatalog();

  return (
    <div className="container py-10 space-y-10">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <h1 className="text-4xl font-bold text-gradient">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((c) => (
            <span key={c.id} className="text-sm px-3 py-1 rounded-full glass border border-border/40">
              {c.name}
            </span>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <ShopCatalog products={products} locale={locale} />
      )}
    </div>
  );
}
