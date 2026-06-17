import { getTranslations, setRequestLocale } from "next-intl/server";
import NewCreatorForm from "./new-creator-form";
import type { Locale } from "@/i18n/config";

export default async function NewCreatorPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t("createCreator")}</h1>
      <NewCreatorForm locale={locale} />
    </div>
  );
}
