import { getOwnerTranslationCenter } from "@/actions/admin/translation-center";
import { TranslationCenterPanel } from "@/components/admin/translation-center-panel";
import { requireOwner } from "@/lib/auth";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function OwnerTranslationCenterPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireOwner();

  const result = await getOwnerTranslationCenter();
  if (!result.success) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        {result.error}
      </div>
    );
  }

  return (
    <TranslationCenterPanel
      queue={result.data.queue}
      cache={result.data.cache}
      missing={result.data.missing}
      audit={result.data.audit}
    />
  );
}
