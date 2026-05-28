import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/credits";
import { getShopProducts } from "@/lib/shop";
import { ShopClient } from "@/components/shop/shop-client";
import type { Locale } from "@/i18n/config";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Credits Shop",
  description: "Buy credits, memberships, mods, and exclusive products.",
};

export default async function ShopPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("shop");

  const user = await getCurrentUser();
  const [products, balance] = await Promise.all([
    getShopProducts().catch(() => []),
    user ? getWalletBalance(user.id) : Promise.resolve(0),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-gradient">{t("title")}</h1>
      <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      <div className="mt-10">
        <ShopClient products={products} walletBalance={balance} locale={locale} />
      </div>
    </div>
  );
}
