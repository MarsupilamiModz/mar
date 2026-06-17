import { requirePagePermission } from "@/lib/auth";
import {
  listCreatorApplicationsAdmin,
  listPartnerApplicationsAdmin,
  listCommissionRulesForApplications,
  getPartnerFormFieldsAdmin,
} from "@/actions/admin/applications";
import { ApplicationsAdminPanel } from "@/components/admin/applications-admin-panel";
import { PartnerFormBuilder } from "@/components/admin/partner-form-builder";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function AdminApplicationsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  await requirePagePermission("users.read");

  const [creators, partners, rules, formFields] = await Promise.all([
    listCreatorApplicationsAdmin(),
    listPartnerApplicationsAdmin(),
    listCommissionRulesForApplications(),
    getPartnerFormFieldsAdmin(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Applications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review creator and partner applications — partners are provisioned only on approval
        </p>
      </div>
      <PartnerFormBuilder initialFields={formFields.success ? formFields.data : []} />
      <ApplicationsAdminPanel
        creatorApps={creators.success ? creators.data : []}
        partnerApps={partners.success ? partners.data : []}
        commissionRules={rules.success ? rules.data : []}
      />
    </div>
  );
}
