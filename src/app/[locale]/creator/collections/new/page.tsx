import { setRequestLocale } from "next-intl/server";
import { requireAuth } from "@/lib/auth";
import { CollectionCreateForm } from "@/components/creator/collection-editor";
import type { Locale } from "@/i18n/config";

export default async function NewCollectionPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  await requireAuth(`/${locale}/login`);
  return <CollectionCreateForm locale={locale} />;
}
