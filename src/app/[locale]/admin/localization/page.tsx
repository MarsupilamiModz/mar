import { requireAdmin } from "@/lib/auth";
import { getAdminTranslations } from "@/actions/admin/localization";
import { LocalizationAdminPanel } from "@/components/admin/localization-admin-panel";
import { TranslationsAdminPanel } from "@/components/admin/translations-admin-panel";

export default async function AdminLocalizationPage() {
  await requireAdmin();
  const result = await getAdminTranslations();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Localization</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        AI translation queue, static message editor, export/import, and runtime English fallback.
      </p>
      <div className="mt-8">
        <LocalizationAdminPanel jobs={result.data} />
      </div>
      <TranslationsAdminPanel />
    </div>
  );
}
