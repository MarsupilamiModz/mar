import { getShopCatalog } from "@/actions/shop";
import { ShopCatalog } from "@/components/shop/enterprise-shop";
import type { Locale } from "@/i18n/config";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function ShopPage({ params: { locale } }: { params: { locale: Locale } }) {
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
