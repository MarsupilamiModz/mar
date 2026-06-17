import { getGamesAndCategories } from "@/lib/data";
import { ModAdminPanel } from "@/components/admin/mod-admin-panel";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export default async function DesignerNewAssetPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const t = await getTranslations("designer");
  const games = await getGamesAndCategories();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t("newAsset")}</h1>
      <ModAdminPanel locale={locale} games={games} redirectBase="/designer/assets" />
    </div>
  );
}
