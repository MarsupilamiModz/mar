import { requireAdmin } from "@/lib/auth";
import { getAdminMembershipPlans, getPremiumPageAdminSettings } from "@/actions/admin/memberships";
import { MembershipsAdminPanel } from "@/components/admin/memberships-admin-panel";
import type { Locale } from "@/i18n/config";

export default async function AdminMembershipsPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requireAdmin();
  const [plansResult, pageResult] = await Promise.all([
    getAdminMembershipPlans(),
    getPremiumPageAdminSettings(),
  ]);
  if (!plansResult.success || !pageResult.success) {
    return <p className="text-destructive">Failed to load membership data</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Membership Pricing Management</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Dynamic pricing, sales, card styling, perks, and premium page content with live preview.
      </p>
      <div className="mt-8">
        <MembershipsAdminPanel
          plans={plansResult.data}
          pageSettings={pageResult.data}
          locale={locale}
        />
      </div>
    </div>
  );
}
