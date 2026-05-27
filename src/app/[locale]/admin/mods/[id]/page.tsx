import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getGamesAndCategories, getCreatorsForSelect } from "@/lib/data";
import { getModForEdit } from "@/actions/mods";
import { ModAdminPanel } from "@/components/admin/mod-admin-panel";
import { getMediaSettings } from "@/lib/media-settings";
import type { Locale } from "@/i18n/config";

export default async function AdminEditModPage({
  params: { locale, id },
}: {
  params: { locale: Locale; id: string };
}) {
  await requireAdmin();
  const [result, games, authors, mediaSettings] = await Promise.all([
    getModForEdit(id),
    getGamesAndCategories(),
    getCreatorsForSelect(),
    getMediaSettings(),
  ]);

  if (!result.success) notFound();

  return (
    <ModAdminPanel
      locale={locale}
      games={games}
      authors={authors}
      mod={result.data}
      mediaSettings={mediaSettings}
      isAdmin
      redirectBase="/admin/mods"
    />
  );
}
