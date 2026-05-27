import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listPartners } from "@/actions/admin/partners";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDisplayName } from "@/lib/display-name";
import type { Locale } from "@/i18n/config";

export default async function AdminPartnersPage({ params: { locale } }: { params: { locale: Locale } }) {
  setRequestLocale(locale);
  const t = await getTranslations("ecosystem");
  const result = await listPartners();
  const partners = result.success ? result.data.partners : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("partnerManagement")}</h1>
        <Button variant="neon" size="sm" asChild>
          <Link href={`/${locale}/admin/partners/new`}>Create Partner</Link>
        </Button>
      </div>
      <div className="space-y-2">
        {partners.map((p) => (
          <Card key={p.id} className="glass p-4 flex flex-wrap justify-between items-center gap-3">
            <div>
              <p className="font-medium">{formatDisplayName(p.user)}</p>
              <p className="text-xs text-muted-foreground">/{p.slug} · {p.affiliateCode ?? "—"}</p>
            </div>
            <div className="flex items-center gap-2">
              {p.isVerified && <Badge variant="premium">{t("verified")}</Badge>}
              {p.isBanned && <Badge variant="destructive">{t("banned")}</Badge>}
              <Button variant="outline" size="sm" asChild>
                <Link href={`/${locale}/admin/partners/${p.id}`}>{t("manage")}</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
