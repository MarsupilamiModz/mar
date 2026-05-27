import Link from "next/link";
import { getAdminOrders } from "@/actions/orders";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/i18n/config";

export default async function AdminOrdersPage({ params: { locale } }: { params: { locale: Locale } }) {
  const result = await getAdminOrders();
  const orders = result.success ? result.data : [];

  return (
    <div>
      <h1 className="text-2xl font-bold">Custom Orders</h1>
      <p className="mt-1 text-sm text-muted-foreground">Commission and custom work requests</p>

      <div className="mt-8 space-y-3">
        {orders.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground">No orders</Card>
        ) : (
          orders.map((o) => (
            <Link key={o.id} href={`/${locale}/admin/orders/${o.id}`}>
              <Card className="glass p-4 hover:border-neon-purple/40">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-medium">{o.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      @{o.client.username} · {o.orderType} · {o._count.messages} messages
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
