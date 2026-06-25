import { requireAdmin } from "@/lib/auth";
import { getAdminBrandingCenter } from "@/actions/admin/branding";
import { BrandingCenterPanel } from "@/components/admin/branding-center-panel";
import { AuthBrandingPanel } from "@/components/admin/auth-branding-panel";

export default async function AdminBrandingPage() {
  await requireAdmin();
  const result = await getAdminBrandingCenter();
  if (!result.success) return <p className="text-destructive">{result.error}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Branding & Content Center</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Logo, favicon, header, footer, multilingual page content, and SEO — no code changes required.
      </p>
      <div className="mt-8 space-y-10">
        <BrandingCenterPanel initial={result.data} />
        <div>
          <h2 className="text-xl font-bold mb-4">Login page</h2>
          <AuthBrandingPanel initial={result.data.authBranding} />
        </div>
      </div>
    </div>
  );
}
