import { getAdminSiteBanners } from "@/actions/admin/banners";
import { BannersAdminPanel } from "@/components/admin/banners-admin-panel";
import { requirePagePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  await requirePagePermission("settings.write");

  const result = await getAdminSiteBanners();
  if (!result.success) {
    return <p className="text-destructive text-sm">{result.error}</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Banner Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global, game, category, mod, and partner banners with display frequency controls.
        </p>
      </div>
      <BannersAdminPanel banners={result.data} />
    </div>
  );
}
