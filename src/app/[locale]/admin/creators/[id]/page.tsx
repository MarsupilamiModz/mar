import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getCreatorAdmin } from "@/actions/admin/creators";
import { CreatorAdminPanel } from "@/components/admin/creator-admin-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminCreatorDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const result = await getCreatorAdmin(id);
  if (!result.success) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/admin/creators`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("creatorManagement")}
      </Link>
      <h1 className="text-2xl font-bold">{result.data.user.displayName ?? result.data.user.username}</h1>
      <CreatorAdminPanel locale={locale} creator={result.data} />
    </div>
  );
}
