import { requireAdmin } from "@/lib/auth";
import { getAdminBranding } from "@/actions/admin/branding";
import { BrandingAdminPanel } from "@/components/admin/branding-admin-panel";

export default async function AdminBrandingPage() {
  await requireAdmin();
  const result = await getAdminBranding();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Branding Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">Logo, favicon, SEO, and site identity.</p>
      <div className="mt-8">
        <BrandingAdminPanel initial={result.data} />
      </div>
    </div>
  );
}
