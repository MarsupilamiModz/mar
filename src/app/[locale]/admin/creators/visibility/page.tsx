import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listVisibleCreators } from "@/actions/admin/creators";
import { CreatorVisibilityManager } from "@/components/admin/creator-visibility-manager";
import type { Locale } from "@/i18n/config";

export default async function CreatorVisibilityPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const result = await listVisibleCreators();
  const creators = result.success ? result.data : [];

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href={`/${locale}/admin/creators`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("creatorManagement")}
      </Link>
      <h1 className="text-2xl font-bold">{t("visibleCreators")}</h1>
      <CreatorVisibilityManager creators={creators} />
    </div>
  );
}
