import { requireAuth } from "@/lib/auth";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getUserCommissionSummary } from "@/lib/analytics/ecosystem";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCents } from "@/lib/affiliate";
import type { Locale } from "@/i18n/config";

export default async function PartnerPayoutsPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const user = await requireAuth();
  const summary = await getUserCommissionSummary(user.id);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{t("pendingPayout")}</p>
          <p className="text-2xl font-bold">{formatCents(summary.pendingCents, locale)}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">{t("commission")}</p>
          <p className="text-2xl font-bold">{formatCents(summary.paidCents, locale)}</p>
        </Card>
      </div>
      {summary.payouts.map((p) => (
        <Card key={p.id} className="glass p-4 flex justify-between">
          <span>{formatCents(p.amountCents, locale)}</span>
          <Badge variant="outline">{p.status}</Badge>
        </Card>
      ))}
    </div>
  );
}
