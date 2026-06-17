import { requireAdmin } from "@/lib/auth";
import { getAdminMediaCenter, type MediaSection } from "@/actions/admin/media-center";
import { MediaCenterPanel } from "@/components/admin/media-center-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminMediaCenterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: { section?: string; page?: string; q?: string };
}) {
  const { locale } = await params;

  await requireAdmin();
  const section = (searchParams.section as MediaSection) || "mods";
  const result = await getAdminMediaCenter({
    section,
    page: Number(searchParams.page) || 1,
    q: searchParams.q,
  });

  const data = result.success
    ? result.data
    : { section, items: [], total: 0, pages: 0, page: 1 };

  return (
    <MediaCenterPanel
      locale={locale}
      section={data.section as MediaSection}
      items={data.items as unknown[]}
      total={data.total}
      page={data.page}
      pages={data.pages}
    />
  );
}
