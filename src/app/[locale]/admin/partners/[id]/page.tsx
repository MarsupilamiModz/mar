import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPartnerAdmin } from "@/actions/admin/partners";
import { PartnerAdminPanel } from "@/components/admin/partner-admin-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminPartnerDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const result = await getPartnerAdmin(id);
  if (!result.success) notFound();

  return (
    <div className="space-y-6">
      <Link href={`/${locale}/admin/partners`} className="text-sm text-muted-foreground hover:text-foreground">
        ← {t("partnerManagement")}
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{result.data.user.displayName ?? result.data.user.username}</h1>
        <Link href={`/${locale}/partners/${result.data.slug}`} className="text-sm text-neon-blue hover:underline">
          {t("viewPublicProfile")}
        </Link>
      </div>
      <PartnerAdminPanel locale={locale} partner={result.data} />
    </div>
  );
}
