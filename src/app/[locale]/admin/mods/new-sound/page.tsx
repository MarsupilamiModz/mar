import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth";
import { getGamesAndCategories, getCreatorsForSelect } from "@/lib/data";
import { AdminSoundUploadPanel } from "@/components/admin/admin-sound-upload-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminNewSoundPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requireAdmin();
  const t = await getTranslations("admin");
  const [games, authors] = await Promise.all([getGamesAndCategories(), getCreatorsForSelect()]);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">{t("uploadSound")}</h1>
      <AdminSoundUploadPanel locale={locale} games={games} authors={authors} />
    </div>
  );
}
