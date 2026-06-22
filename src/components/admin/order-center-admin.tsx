"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getAdminOrders,
  updateOrderStatus,
} from "@/actions/orders";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ORDER_STATUS_LABELS } from "@/lib/shop-enterprise";
import type { OrderStatus } from "@prisma/client";

type OrderRow = {
  id: string;
  title: string;
  status: OrderStatus;
  orderType: string;
  createdAt: Date;
  client: { username: string };
  assignee: { username: string } | null;
  _count: { messages: number };
};

const STATUS_FILTERS: (OrderStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "PAID",
  "IN_REVIEW",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_FOR_CUSTOMER",
  "REVISION_REQUESTED",
  "COMPLETED",
  "DELIVERED",
];

export function OrderCenterAdmin({
  initialOrders,
  locale,
  analytics,
}: {
  initialOrders: OrderRow[];
  locale: string;
  analytics: {
    revenueTodayCents: number;
    revenueMonthCents: number;
    ordersToday: number;
    pendingOrders: number;
    completionRate: number;
  } | null;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = orders.filter((o) => {
    if (filter !== "ALL" && o.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      o.title.toLowerCase().includes(q) ||
      o.client.username.toLowerCase().includes(q) ||
      o.orderType.toLowerCase().includes(q)
    );
  });

  function reload(status?: string) {
    startTransition(async () => {
      const r = await getAdminOrders({ status: status === "ALL" ? undefined : status });
      if (r.success) setOrders(r.data.orders as OrderRow[]);
    });
  }

  return (
    <div className="space-y-6">
      {analytics && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Card className="glass p-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-xl font-bold">{analytics.pendingOrders}</p></Card>
          <Card className="glass p-4"><p className="text-xs text-muted-foreground">Today</p><p className="text-xl font-bold">{analytics.ordersToday}</p></Card>
          <Card className="glass p-4"><p className="text-xs text-muted-foreground">Completion</p><p className="text-xl font-bold">{analytics.completionRate}%</p></Card>
          <Card className="glass p-4"><p className="text-xs text-muted-foreground">Revenue (month)</p><p className="text-xl font-bold">€{(analytics.revenueMonthCents / 100).toFixed(2)}</p></Card>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "neon" : "outline"}
            onClick={() => {
              setFilter(s);
              if (s !== "ALL") reload(s);
              else reload();
            }}
          >
            {s === "ALL" ? "All" : ORDER_STATUS_LABELS[s]}
          </Button>
        ))}
      </div>

      <Input placeholder="Search orders…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground">No orders match</Card>
        ) : (
          filtered.map((o) => (
            <Card key={o.id} className="glass p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/${locale}/admin/orders/${o.id}`} className="font-medium hover:text-neon-purple">
                    {o.title}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-1">
                    @{o.client.username}
                    {o.assignee ? ` · assigned: @${o.assignee.username}` : ""}
                    · {o.orderType} · {o._count.messages} messages
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                  <select
                    className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                    value={o.status}
                    disabled={pending}
                    onChange={(e) =>
                      startTransition(async () => {
                        await updateOrderStatus(o.id, e.target.value as OrderStatus);
                        reload(filter === "ALL" ? undefined : filter);
                        router.refresh();
                      })
                    }
                  >
                    {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
