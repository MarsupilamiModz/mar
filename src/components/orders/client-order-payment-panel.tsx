"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCreditsFromCents } from "@/lib/credits";
import { formatPaymentReference } from "@/lib/invoices";
import { startOrderStripePayment, payOrderWithCredits } from "@/actions/orders";
import { useAppToast } from "@/hooks/use-app-toast";

type ClientOrder = {
  id: string;
  invoiceNumber: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
  finalAmountCents: number | null;
  paymentNote: string | null;
  deliveryFileName: string | null;
  deliveryFileKey: string | null;
};

export function ClientOrderPaymentPanel({ order, locale }: { order: ClientOrder; locale: string }) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();

  if (order.paymentStatus === "UNPAID" && !order.finalAmountCents) return null;

  return (
    <Card className="glass p-5 space-y-4 mt-6 border-neon-purple/20">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Payment</h3>
        {order.invoiceNumber && <Badge variant="outline">{order.invoiceNumber}</Badge>}
        <Badge variant={order.paymentStatus === "PAID" ? "premium" : "outline"}>{order.paymentStatus}</Badge>
      </div>

      {order.invoiceNumber && (
        <p className="text-sm text-muted-foreground">{formatPaymentReference(order.invoiceNumber)}</p>
      )}

      {order.paymentNote && <p className="text-sm">{order.paymentNote}</p>}

      {order.finalAmountCents != null && order.paymentStatus !== "PAID" && (
        <>
          <p className="text-2xl font-bold text-gradient">
            {formatCreditsFromCents(order.finalAmountCents, locale)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="neon"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await startOrderStripePayment(
                    order.id,
                    locale,
                    typeof window !== "undefined" ? window.location.origin : undefined
                  );
                  if (!r.success) {
                    appToast.error(r.error);
                    return;
                  }
                  if (r.data.url) window.location.href = r.data.url;
                  else appToast.error("Checkout failed: Stripe did not return a payment URL");
                })
              }
            >
              Pay with card
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await payOrderWithCredits(order.id);
                  if (r.success) {
                    appToast.saved();
                    window.location.reload();
                  } else appToast.error(r.error);
                })
              }
            >
              Pay with Credits
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Bank transfer & PayPal: use invoice reference above and contact support after payment.
          </p>
        </>
      )}

      {order.paymentStatus === "PAID" && order.deliveryFileName && order.deliveryFileKey && (
        <Button variant="neon" asChild>
          <a href={`/api/assets/${encodeURIComponent(order.deliveryFileKey)}`} download={order.deliveryFileName}>
            Download {order.deliveryFileName}
          </a>
        </Button>
      )}
    </Card>
  );
}
