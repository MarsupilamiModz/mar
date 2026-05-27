import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDesignerDashboard } from "@/actions/designer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";

export default async function DesignerOrdersPage({ params: { locale } }: { params: { locale: Locale } }) {
  const t = await getTranslations("designer");
  const result = await getDesignerDashboard();
  const orders = result.success ? result.data.orders : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("orders")}</h1>
      <div className="mt-8 space-y-3">
        {orders.length === 0 ? (
          <Card className="glass p-10 text-center text-muted-foreground">{t("emptyOrders")}</Card>
        ) : (
          orders.map((o) => (
            <Link key={o.id} href={`/${locale}/dashboard/orders/${o.id}`}>
              <Card className="glass p-4 hover:border-neon-purple/40 transition-colors">
                <div className="flex justify-between items-center gap-4">
                  <div>
                    <p className="font-medium">{o.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      @{o.client.username} · {o._count.messages} messages
                    </p>
                  </div>
                  <Badge variant="outline">{o.status}</Badge>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
