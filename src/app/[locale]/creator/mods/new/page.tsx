import { getTranslations, setRequestLocale } from "next-intl/server";
import { getGamesAndCategories } from "@/lib/data";
import { ModForm } from "@/components/creator/product-form";
import type { Locale } from "@/i18n/config";

export default async function NewModPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("creator");
  const catalog = await getGamesAndCategories().catch(() => []);
  const games = catalog.map(({ id, name, modes }) => ({ id, name, modes }));
  const categories = catalog.flatMap((g) => g.categories);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">{t("newProduct")}</h2>
      <ModForm locale={locale} games={games} categories={categories} />
    </div>
  );
}
