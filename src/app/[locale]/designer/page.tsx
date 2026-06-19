import Link from "next/link";
import { safeToLocaleString } from "@/lib/i18n/safe-locale";
import { getTranslations } from "next-intl/server";
import { getDesignerDashboard } from "@/actions/designer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

export default async function DesignerOverviewPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const t = await getTranslations("designer");
  const result = await getDesignerDashboard();
  const data = result.success
    ? result.data
    : { uploads: [], orders: [], totalEarnings: 0, totalDownloads: 0, profile: null };

  const stats = [
    { label: t("totalDownloads"), value: safeToLocaleString(data.totalDownloads) },
    { label: t("totalEarnings"), value: `$${data.totalEarnings.toFixed(2)}` },
    { label: t("openOrders"), value: data.orders.filter((o) => o.status !== "COMPLETED").length },
    { label: t("uploads"), value: data.uploads.length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
      <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("uploads")}</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${locale}/designer/uploads`}>{t("manageAsset")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.uploads.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("emptyUploads")}</p>
            ) : (
              data.uploads.slice(0, 5).map((m) => (
                <div key={m.id} className="flex justify-between text-sm">
                  <span className="line-clamp-1">{m.title}</span>
                  <Badge variant="outline">{m.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">{t("orders")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("emptyOrders")}</p>
            ) : (
              data.orders.slice(0, 5).map((o) => (
                <Link
                  key={o.id}
                  href={`/${locale}/dashboard/orders/${o.id}`}
                  className="flex justify-between text-sm hover:text-neon-purple"
                >
                  <span className="line-clamp-1">{o.title}</span>
                  <Badge variant="outline">{o.status}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
