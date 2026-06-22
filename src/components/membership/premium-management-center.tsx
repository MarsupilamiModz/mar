"use client";

import { useState } from "react";
import { getIntlLocale } from "@/lib/i18n/safe-locale";
import Link from "next/link";
import { ExternalLink, CreditCard, Calendar, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCreditsFromCents } from "@/lib/credits";
import { formatPlanPrice } from "@/lib/membership-pricing";
import type { UserMembershipStatus } from "@prisma/client";
import { toast } from "@/hooks/use-toast";

type Plan = {
  name: string;
  slug: string;
  priceCents: number;
  currency: string;
  interval: string | null;
  features: string[];
};

type Purchase = {
  id: string;
  amountCents: number;
  stripePaymentId: string | null;
  createdAt: Date;
  plan: { name: string; slug: string };
};

type Invoice = {
  id: string;
  number: string | null;
  status: string | null;
  amountDue: number;
  currency: string;
  created: Date;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

type Props = {
  locale: string;
  membership: {
    membershipType: string;
    status: UserMembershipStatus;
    planSlug: string | null;
    renewalDate: Date | null;
    cancelDate: Date | null;
    isLifetime: boolean;
    stripeSubscriptionId: string | null;
  };
  subscription: {
    status: string;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    interval: string;
  } | null;
  currentPlan: Plan | null;
  purchases: Purchase[];
  invoices: Invoice[];
  hasStripeSubscription: boolean;
};

export function PremiumManagementCenter({
  locale,
  membership,
  subscription,
  currentPlan,
  purchases,
  invoices,
  hasStripeSubscription,
}: Props) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState<string | null>(null);

  const isActive = membership.status === "ACTIVE" || membership.status === "TRIALING";
  const nextBilling = subscription?.currentPeriodEnd ?? membership.renewalDate;

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast({ title: "Portal unavailable", description: data.error, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  }

  async function openReceipt(paymentId: string) {
    setReceiptLoading(paymentId);
    try {
      const res = await fetch(`/api/stripe/receipt?paymentIntent=${paymentId}`);
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } finally {
      setReceiptLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {hasStripeSubscription || membership.stripeSubscriptionId ? (
          <Button variant="neon" onClick={openPortal} disabled={portalLoading}>
            <CreditCard className="h-4 w-4 mr-2" />
            {portalLoading ? "Loading..." : "Manage billing & payment"}
          </Button>
        ) : null}
        <Button variant="outline" asChild>
          <Link href={`/${locale}/premium`}>
            {currentPlan ? "Change plan" : "Upgrade membership"}
          </Link>
        </Button>
      </div>

      {nextBilling && !membership.isLifetime && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border border-border/40 p-3">
          <Calendar className="h-4 w-4 text-neon-purple" />
          <span>
            {subscription?.cancelAtPeriodEnd || membership.cancelDate
              ? `Access until ${new Date(nextBilling).toLocaleDateString(getIntlLocale(locale))}`
              : `Next billing: ${new Date(nextBilling).toLocaleDateString(getIntlLocale(locale))}`}
          </span>
        </div>
      )}

      {membership.isLifetime && (
        <p className="text-sm text-emerald-400 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Lifetime access — no recurring billing
        </p>
      )}

      {currentPlan && (
        <div className="rounded-lg border border-neon-purple/20 bg-neon-purple/5 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">{currentPlan.name}</p>
            <Badge variant={isActive ? "premium" : "outline"}>{membership.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatPlanPrice(currentPlan.priceCents, currentPlan.currency, locale)}
            {!membership.isLifetime && ` / ${subscription?.interval ?? currentPlan.interval ?? "month"}`}
          </p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {currentPlan.features.slice(0, 5).map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        </div>
      )}

      {invoices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Invoices</p>
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{inv.number ?? inv.id.slice(-8)}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(inv.created).toLocaleDateString(getIntlLocale(locale))} · {(inv.amountDue / 100).toFixed(2)}{" "}
                  {inv.currency.toUpperCase()}
                </p>
              </div>
              {(inv.hostedInvoiceUrl || inv.invoicePdf) && (
                <Button size="sm" variant="outline" asChild>
                  <a href={inv.hostedInvoiceUrl ?? inv.invoicePdf!} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Download
                  </a>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {purchases.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment history</p>
          {purchases.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{p.plan.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCreditsFromCents(p.amountCents, locale)} ·{" "}
                  {new Date(p.createdAt).toLocaleDateString(getIntlLocale(locale))}
                </p>
              </div>
              {p.stripePaymentId && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={receiptLoading === p.stripePaymentId}
                  onClick={() => openReceipt(p.stripePaymentId!)}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Receipt
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Upgrade, downgrade, cancel, reactivate, and update your payment method in the Stripe Customer Portal.
      </p>
    </div>
  );
}
