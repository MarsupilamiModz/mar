import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getGamesAndCategories, getCreatorsForSelect } from "@/lib/data";
import { getModForEdit } from "@/actions/mods";
import { ModAdminPanel } from "@/components/admin/mod-admin-panel";
import { getMediaSettings } from "@/lib/media-settings";
import { logPlatformError } from "@/lib/platform-log";
import type { Locale } from "@/i18n/config";

export default async function AdminEditModPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;

  await requireAdmin();

  try {
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
  } catch (err) {
    await logPlatformError(`admin/mods/${id}`, err);
    throw err;
  }
}
