import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getUserOrders } from "@/actions/orders";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";

export default async function OrdersPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requireAuth(`/${locale}/login`);
  const result = await getUserOrders();
  const orders = result.success ? result.data : [];

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Custom Orders</h1>
        <Button variant="neon" size="sm" asChild>
          <Link href={`/${locale}/custom-orders`}>
            <Plus className="h-4 w-4 mr-1" /> New order
          </Link>
        </Button>
      </div>
      <div className="mt-8 space-y-3">
        {orders.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground">No orders yet</Card>
        ) : (
          orders.map((o) => (
            <Link key={o.id} href={`/${locale}/dashboard/orders/${o.id}`}>
              <Card className="glass p-4 hover:border-neon-purple/40">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{o.title}</p>
                    <p className="text-xs text-muted-foreground">{o.orderType} · {o._count.messages} messages</p>
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
