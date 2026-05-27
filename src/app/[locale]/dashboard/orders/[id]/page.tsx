"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { getOrderDetail, sendOrderMessage } from "@/actions/orders";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClientOrderPaymentPanel } from "@/components/orders/client-order-payment-panel";
import { UserIdentity } from "@/components/user/user-identity";
import { toast } from "@/hooks/use-toast";

type Order = {
  id: string;
  title: string;
  status: string;
  invoiceNumber: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
  finalAmountCents: number | null;
  paymentNote: string | null;
  deliveryFileName: string | null;
  deliveryFileKey: string | null;
  messages: {
    id: string;
    content: string;
    sender: { username: string; displayName: string | null };
  }[];
};

export default function OrderDetailPage() {
  const params = useParams();
  const locale = params.locale as string;
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [content, setContent] = useState("");
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => {
      const r = await getOrderDetail(orderId);
      if (r.success) setOrder(r.data as unknown as Order);
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!order) return <p className="text-muted-foreground">Loading...</p>;

  return (
    <div className="max-w-2xl">
      <Link href={`/${locale}/dashboard/orders`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back
      </Link>
      <div className="mt-4 flex items-center gap-2">
        <h1 className="text-2xl font-bold">{order.title}</h1>
        <Badge variant="outline">{order.status}</Badge>
      </div>

      <ClientOrderPaymentPanel order={order} locale={locale} />

      <div className="mt-6 space-y-3">
        {order.messages.map((m) => (
          <Card key={m.id} className="glass p-4">
            <div className="mb-1">
              <UserIdentity username={m.sender.username} displayName={m.sender.displayName} size="sm" />
            </div>
            <p className="text-sm whitespace-pre-wrap">{m.content}</p>
          </Card>
        ))}
      </div>
      <Card className="glass mt-6 p-4 space-y-3">
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Reply..." rows={3} />
        <Button
          variant="neon"
          disabled={pending || !content.trim()}
          onClick={() =>
            startTransition(async () => {
              const r = await sendOrderMessage(orderId, content);
              if (r.success) {
                setContent("");
                load();
                toast({ title: "Message sent" });
              }
            })
          }
        >
          Send
        </Button>
      </Card>
    </div>
  );
}
