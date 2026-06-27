import { getDiscordImportCenterData } from "@/actions/admin/discord-import";
import { requireOwner } from "@/lib/auth";
import { DiscordImportCenter } from "@/components/admin/discord-import-center";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function DiscordImportPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  await requireOwner();

  const result = await getDiscordImportCenterData();
  if (!result.success) {
    return (
      <div className="container py-8">
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
          {result.error}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <DiscordImportCenter locale={locale} data={result.data} />
    </div>
  );
}
