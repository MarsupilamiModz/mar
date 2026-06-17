import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { getGamesAndCategories, getCreatorsForSelect } from "@/lib/data";
import { ModAdminPanel } from "@/components/admin/mod-admin-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminNewModPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  await requireAdmin();
  const t = await getTranslations("admin");
  const [games, authors] = await Promise.all([getGamesAndCategories(), getCreatorsForSelect()]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">{t("uploadMod")}</h1>
      <ModAdminPanel
        locale={locale}
        games={games}
        authors={authors}
        isAdmin
        redirectBase="/admin/mods"
      />
    </div>
  );
}
