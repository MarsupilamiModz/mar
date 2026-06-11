import { setRequestLocale } from "next-intl/server";
import { requireAuth } from "@/lib/auth";
import { getMyPartnerApplication } from "@/actions/applications";
import { PartnerApplicationForm } from "@/components/applications/partner-application-form";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";

export default async function BecomePartnerPage({
  params: { locale },
}: {
  params: { locale: Locale };
}) {
  setRequestLocale(locale);
  const user = await requireAuth(`/${locale}/login`);
  const existing = await getMyPartnerApplication(user.id);

  if (existing && existing.status !== "REJECTED") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="glass p-6">
          <Badge className="mb-3">{existing.status.replace("_", " ")}</Badge>
          <h1 className="text-2xl font-bold">Partner application</h1>
          <p className="text-muted-foreground mt-2">
            Submitted {new Date(existing.createdAt).toLocaleDateString()}.
            {existing.adminNotes && ` Note: ${existing.adminNotes}`}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-6">Become a Partner</h1>
      <PartnerApplicationForm userEmail={user.email} username={user.username} />
    </div>
  );
}
