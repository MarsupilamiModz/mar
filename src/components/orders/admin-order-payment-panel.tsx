"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCreditsFromCents } from "@/lib/credits";
import { formatPaymentReference } from "@/lib/invoices";
import {
  quoteCustomOrder,
  markOrderPaidManual,
  uploadOrderDelivery,
} from "@/actions/orders";
import { useAppToast } from "@/hooks/use-app-toast";

type AdminOrder = {
  id: string;
  title: string;
  status: string;
  invoiceNumber: string | null;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  paymentNote: string | null;
  quotedAmountCents: number | null;
  finalAmountCents: number | null;
  deliveryFileName: string | null;
};

export function AdminOrderPaymentPanel({
  order: initial,
  locale,
  onUpdated,
}: {
  order: AdminOrder;
  locale: string;
  onUpdated: () => void;
}) {
  const appToast = useAppToast();
  const [order, setOrder] = useState(initial);
  const [amount, setAmount] = useState(initial.finalAmountCents ?? 0);
  const [note, setNote] = useState(initial.paymentNote ?? "");
  const [reference, setReference] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Card className="glass p-5 space-y-4 mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Payment & delivery</h3>
        {order.invoiceNumber && <Badge variant="outline">{order.invoiceNumber}</Badge>}
        <Badge variant={order.paymentStatus === "PAID" ? "premium" : "outline"}>{order.paymentStatus}</Badge>
      </div>

      {order.invoiceNumber && (
        <p className="text-sm text-muted-foreground">
          Payment reason: {formatPaymentReference(order.invoiceNumber)}
        </p>
      )}

      {order.paymentStatus !== "PAID" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            type="number"
            step="100"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="Quote amount (Credits)"
          />
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Payment note for customer" rows={2} />
          <Button
            variant="neon"
            disabled={pending || amount <= 0}
            onClick={() =>
              startTransition(async () => {
                const r = await quoteCustomOrder(order.id, Math.round(amount), note);
                if (r.success) {
                  appToast.saved();
                  setOrder((o) => ({ ...o, ...r.data, paymentStatus: "AWAITING_PAYMENT", status: "QUOTED" }));
                  onUpdated();
                } else appToast.error(r.error);
              })
            }
          >
            Send quote ({formatCreditsFromCents(Math.round(amount), locale)})
          </Button>
        </div>
      )}

      {order.finalAmountCents != null && order.paymentStatus !== "PAID" && (
        <p className="text-sm">
          Customer owes: <strong>{formatCreditsFromCents(order.finalAmountCents, locale)}</strong>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Input placeholder="PayPal / bank reference" value={reference} onChange={(e) => setReference(e.target.value)} className="max-w-xs" />
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await markOrderPaidManual(order.id, "PAYPAL", reference || undefined);
              if (r.success) { appToast.saved(); onUpdated(); }
              else appToast.error(r.error);
            })
          }
        >
          Mark PayPal paid
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await markOrderPaidManual(order.id, "BANK_TRANSFER", reference || undefined);
              if (r.success) { appToast.saved(); onUpdated(); }
              else appToast.error(r.error);
            })
          }
        >
          Mark bank transfer paid
        </Button>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const r = await uploadOrderDelivery(order.id, fd);
            if (r.success) { appToast.uploaded(); onUpdated(); }
            else appToast.error(r.error);
          });
        }}
      >
        <Input type="file" name="file" required accept=".zip,.rar,.7z,.gfx,.rpf,image/*" />
        <Button type="submit" variant="outline" size="sm" disabled={pending}>Upload delivery files</Button>
      </form>

      {order.deliveryFileName && (
        <p className="text-sm text-neon-blue">Delivery ready: {order.deliveryFileName}</p>
      )}
    </Card>
  );
}
