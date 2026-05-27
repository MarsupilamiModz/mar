import { getTranslations, setRequestLocale } from "next-intl/server";
import NewPartnerForm from "./new-partner-form";
import type { Locale } from "@/i18n/config";

export default async function NewPartnerPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Create Partner</h1>
      <NewPartnerForm locale={locale} />
    </div>
  );
}
