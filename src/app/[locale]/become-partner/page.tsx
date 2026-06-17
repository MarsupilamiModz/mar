import { setRequestLocale } from "next-intl/server";
import { requireAuth } from "@/lib/auth";
import { getMyPartnerApplication } from "@/actions/applications";
import { getPartnerFormFields } from "@/lib/partner-form-config";
import { PartnerApplicationForm } from "@/components/applications/partner-application-form";
import { PartnerApplicationStatus } from "@/components/applications/partner-application-status";
import type { Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function BecomePartnerPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale);
  const user = await requireAuth(`/${locale}/become-partner`);
  const [existing, fields] = await Promise.all([
    getMyPartnerApplication(user.id),
    getPartnerFormFields(),
  ]);

  if (existing && existing.status === "APPROVED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        <PartnerApplicationStatus application={existing} />
        <p className="text-sm text-muted-foreground">
          Your partner application was approved. Visit your partner dashboard to manage your profile.
        </p>
      </div>
    );
  }

  if (existing && ["PENDING", "UNDER_REVIEW"].includes(existing.status)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        <h1 className="text-3xl font-bold">Become a Partner</h1>
        <PartnerApplicationStatus application={existing} />
      </div>
    );
  }

  if (existing && (existing.status === "NEEDS_CHANGES" || existing.status === "REJECTED")) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-6">
        <h1 className="text-3xl font-bold">Become a Partner</h1>
        <PartnerApplicationStatus application={existing} />
        <PartnerApplicationForm
          fields={fields}
          userEmail={user.email}
          username={user.username}
          applicationId={existing.id}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Become a Partner</h1>
      <PartnerApplicationForm fields={fields} userEmail={user.email} username={user.username} />
    </div>
  );
}
