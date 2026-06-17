import { notFound } from "next/navigation";
import { getShopProduct } from "@/actions/shop";
import { ShopProductOrderPage } from "@/components/shop/enterprise-shop";
import type { Locale } from "@/i18n/config";
import { setRequestLocale } from "next-intl/server";

export default async function ShopProductPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;

  setRequestLocale(locale);
  const product = await getShopProduct(slug);
  if (!product) notFound();

  return (
    <div className="container py-10">
      <ShopProductOrderPage product={product} locale={locale} />
    </div>
  );
}
