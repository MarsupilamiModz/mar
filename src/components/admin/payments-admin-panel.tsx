"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { updateAdminPaymentSettings, testStripeConnection } from "@/actions/admin/payments";
import type { PaymentSettings } from "@/lib/payments/settings";
import { useAppToast } from "@/hooks/use-app-toast";

export function PaymentsAdminPanel({ settings, transactions }: {
  settings: PaymentSettings;
  transactions: { id: string; amount: number | null; currency: string | null; status: string | null; type: string; created: number }[];
}) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Payment providers</h3>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await updateAdminPaymentSettings({
                stripeEnabled: fd.get("stripeEnabled") === "on",
                paypalEnabled: fd.get("paypalEnabled") === "on",
                applePayEnabled: fd.get("applePayEnabled") === "on",
                googlePayEnabled: fd.get("googlePayEnabled") === "on",
                currency: fd.get("currency") as string,
                taxPercent: Number(fd.get("taxPercent") || 0),
                stripePublishableKey: (fd.get("stripePublishableKey") as string) || undefined,
                paypalClientId: (fd.get("paypalClientId") as string) || undefined,
              });
              if (r.success) appToast.saved();
              else appToast.error(r.error);
            });
          }}
        >
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="stripeEnabled" defaultChecked={settings.stripeEnabled} /> Stripe</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="paypalEnabled" defaultChecked={settings.paypalEnabled} /> PayPal (manual verification)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="applePayEnabled" defaultChecked={settings.applePayEnabled} /> Apple Pay (via Stripe)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="googlePayEnabled" defaultChecked={settings.googlePayEnabled} /> Google Pay (via Stripe)</label>
          <Input name="currency" defaultValue={settings.currency} placeholder="Currency" />
          <Input name="taxPercent" type="number" defaultValue={settings.taxPercent} placeholder="Tax %" />
          <Input name="stripePublishableKey" defaultValue={settings.stripePublishableKey ?? ""} placeholder="Stripe publishable key" className="sm:col-span-2" />
          <Input name="paypalClientId" defaultValue={settings.paypalClientId ?? ""} placeholder="PayPal client ID" className="sm:col-span-2" />
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <Button type="submit" variant="neon" disabled={pending}>Save settings</Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await testStripeConnection();
                  if (r.success) appToast.saved();
                  else appToast.error(r.error);
                })
              }
            >
              Test Stripe
            </Button>
          </div>
        </form>
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant={settings.stripeSecretKeySet ? "premium" : "outline"}>Secret key {settings.stripeSecretKeySet ? "set" : "missing"}</Badge>
          <Badge variant={settings.stripeWebhookSecretSet ? "premium" : "outline"}>Webhook {settings.stripeWebhookSecretSet ? "set" : "missing"}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Stripe secret/webhook keys are configured via environment variables on Vercel for security.</p>
      </Card>

      <Card className="glass p-6">
        <h3 className="font-semibold mb-4">Recent Stripe checkouts</h3>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent sessions.</p>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex flex-wrap justify-between gap-2 text-sm border-b border-border/30 py-2">
                <span className="font-mono text-xs">{tx.id.slice(0, 20)}…</span>
                <span>{tx.type}</span>
                <span>{tx.amount != null ? `${(tx.amount / 100).toFixed(2)} ${tx.currency?.toUpperCase()}` : "—"}</span>
                <Badge variant="outline">{tx.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
