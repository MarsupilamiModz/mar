import { setRequestLocale } from "next-intl/server";
import NewPartnerForm from "./new-partner-form";
import type { Locale } from "@/i18n/config";

export default async function NewPartnerPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  setRequestLocale(locale);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Create Partner</h1>
      <NewPartnerForm locale={locale} />
    </div>
  );
}
