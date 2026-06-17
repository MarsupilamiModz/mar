import { requirePagePermission } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth";
import { listCollectionsAdmin } from "@/actions/admin/collections";
import { CollectionsAdminPanel } from "@/components/admin/collections-admin-panel";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function AdminCollectionsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  await requirePagePermission("settings.write");
  const user = await getCurrentUser();

  const result = await listCollectionsAdmin();
  const collections = result.success ? result.data.items : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collections & Modpacks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create, edit, feature, and moderate platform collections and modpacks
        </p>
      </div>
      <CollectionsAdminPanel
        collections={collections}
        locale={locale}
        adminUserId={user?.id ?? ""}
      />
    </div>
  );
}
