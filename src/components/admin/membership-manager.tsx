"use client";

import { useState, useTransition } from "react";
import { getIntlLocale } from "@/lib/i18n/safe-locale";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  adminAssignMembership,
  adminCancelMembership,
  adminExtendMembership,
  adminResumeMembership,
  adminSetMembershipTier,
} from "@/actions/admin/user-membership";
import { formatMoneyFromCents } from "@/lib/currency";
import type { MembershipTier } from "@prisma/client";

type MembershipState = {
  membershipType: MembershipTier;
  status: string;
  planSlug: string | null;
  renewalDate: Date | null;
  cancelDate: Date | null;
  isLifetime: boolean;
  stripeSubscriptionId: string | null;
};

type BillingRow = {
  id: string;
  amountCents: number;
  createdAt: Date;
  stripePaymentId: string | null;
  plan: { name: string };
};

const TIERS: MembershipTier[] = ["FREE", "PREMIUM_LITE", "PREMIUM", "PREMIUM_MAX"];

export function MembershipManager({
  userId,
  locale,
  state,
  plans,
  billingHistory,
}: {
  userId: string;
  locale: string;
  state: MembershipState;
  plans: { id: string; name: string; slug: string; priceCents: number }[];
  billingHistory: BillingRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [selectedPlan, setSelectedPlan] = useState("");

  function run(action: () => Promise<{ success: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const r = await action();
      if (r.success) toast({ title: msg });
      else toast({ title: r.error ?? "Failed", variant: "destructive" });
    });
  }

  const statusColor =
    state.status === "ACTIVE" ? "default" : state.status === "CANCELED" ? "destructive" : "secondary";

  return (
    <Card className="glass lg:col-span-2">
      <CardHeader>
        <CardTitle>Membership Manager</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Current plan</p>
            <p className="font-medium">{state.planSlug ?? state.membershipType}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={statusColor}>{state.status}</Badge>
            {state.isLifetime && <Badge variant="outline" className="ml-1">Lifetime</Badge>}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Renewal date</p>
            <p className="text-sm">
              {state.renewalDate ? new Date(state.renewalDate).toLocaleDateString(getIntlLocale(locale)) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cancel date</p>
            <p className="text-sm">
              {state.cancelDate ? new Date(state.cancelDate).toLocaleDateString(getIntlLocale(locale)) : "—"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-border/30 pt-4">
          <select
            className="h-9 rounded-md border border-input bg-background/50 px-2 text-sm"
            value={selectedPlan}
            onChange={(e) => setSelectedPlan(e.target.value)}
          >
            <option value="">Select plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatMoneyFromCents(p.priceCents, locale)}/mo)
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            disabled={pending || !selectedPlan}
            onClick={() => run(() => adminAssignMembership(userId, selectedPlan), "Membership assigned")}
          >
            Assign / Upgrade
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => adminExtendMembership(userId, 30), "Extended 30 days")}
          >
            Extend 30 days
          </Button>
          {state.status === "CANCELED" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => adminResumeMembership(userId), "Membership resumed")}
            >
              Resume
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run(() => adminCancelMembership(userId), "Membership canceled")}
            >
              Cancel
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {TIERS.map((tier) => (
            <Button
              key={tier}
              size="sm"
              variant={state.membershipType === tier ? "default" : "ghost"}
              disabled={pending}
              onClick={() => run(() => adminSetMembershipTier(userId, tier), `Set to ${tier}`)}
            >
              {tier.replace("_", " ")}
            </Button>
          ))}
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Billing history</p>
          {billingHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">No billing records</p>
          ) : (
            <ul className="space-y-2 text-sm max-h-48 overflow-y-auto">
              {billingHistory.map((row) => (
                <li key={row.id} className="flex justify-between border-b border-border/20 pb-2">
                  <span>{row.plan.name}</span>
                  <span className="text-muted-foreground">
                    {formatMoneyFromCents(row.amountCents, locale)} ·{" "}
                    {new Date(row.createdAt).toLocaleDateString(getIntlLocale(locale))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
