"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Crown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPlanPrice, getEffectivePlanPrice, getSaleTimeRemaining, type MembershipPlanData } from "@/lib/membership-pricing";
import { isPlanSoldOut, planRemainingStock } from "@/lib/membership-stock";
import type { PremiumPageSettings } from "@/lib/membership-pricing";
import { useAppToast } from "@/hooks/use-app-toast";

type Plan = Pick<
  MembershipPlanData,
  | "id"
  | "slug"
  | "name"
  | "description"
  | "priceCents"
  | "currency"
  | "features"
  | "isFeatured"
  | "perks"
  | "originalPriceCents"
  | "saleDiscountPercent"
  | "cardStyle"
  | "iconKey"
  | "billingType"
  | "planKind"
  | "stockLimit"
  | "soldCount"
  | "interval"
> & { cta?: string; saleEndsAt: string | null };

function planForPricing(plan: Plan): MembershipPlanData {
  return {
    ...(plan as MembershipPlanData),
    saleEndsAt: plan.saleEndsAt ? new Date(plan.saleEndsAt) : null,
  };
}

type Props = {
  locale: string;
  plans: Plan[];
  pageSettings: PremiumPageSettings;
  isLoggedIn: boolean;
  currentPlanSlug: string | null;
};

export function PremiumPlansClient({ locale, plans, pageSettings, isLoggedIn, currentPlanSlug }: Props) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  const currentPlan = plans.find((p) => p.slug === currentPlanSlug);
  const currentSort = plans.findIndex((p) => p.slug === currentPlanSlug);

  async function purchase(planSlug: string) {
    if (!isLoggedIn) {
      window.location.href = `/${locale}/login?redirect=/${locale}/premium`;
      return;
    }
    setLoadingSlug(planSlug);
    startTransition(async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            planSlug,
            locale,
            clientOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
          }),
        });

        let data: { url?: string; error?: string; code?: string } = {};
        try {
          data = await res.json();
        } catch {
          appToast.error(`Checkout failed: server returned invalid response (${res.status})`);
          return;
        }

        if (res.ok && data.url) {
          window.location.href = data.url;
          return;
        }

        appToast.error(data.error ?? `Checkout failed (${res.status})`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        appToast.error(
          msg.includes("fetch") || msg.includes("Failed")
            ? "Checkout failed: could not reach payment server. Check your connection and try again."
            : `Checkout failed: ${msg}`
        );
      } finally {
        setLoadingSlug(null);
      }
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <Crown className="mx-auto h-14 w-14 text-neon-purple mb-6" />
        <h1 className="text-4xl font-bold tracking-tight text-gradient">{pageSettings.heroTitle}</h1>
        <p className="mt-4 text-muted-foreground max-w-2xl mx-auto leading-relaxed">{pageSettings.heroSubtitle}</p>
        {currentPlan && (
          <Badge variant="premium" className="mt-4">Your plan: {currentPlan.name}</Badge>
        )}
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {plans.map((plan, index) => {
          const isCurrent = currentPlanSlug === plan.slug;
          const isOwnedHigher = currentSort >= 0 && index < currentSort;
          const accent = plan.cardStyle?.accentColor ?? plan.perks?.accentColor ?? "#a855f7";
          const pricing = getEffectivePlanPrice(planForPricing(plan));
          const saleEnds = getSaleTimeRemaining(planForPricing(plan));
          const icon = plan.iconKey ?? plan.cardStyle?.iconKey ?? "👑";
          const remaining = planRemainingStock(plan);
          const soldOut = isPlanSoldOut(plan);
          const isLifetime = plan.billingType === "ONE_TIME" || plan.planKind === "LIFETIME";
          const billingLabel = isLifetime
            ? "One-time · lifetime access"
            : "Billed monthly · cancel anytime";

          return (
            <Card
              key={plan.id}
              className={`card-surface p-6 flex flex-col transition-shadow duration-150 hover:shadow-md ${plan.isFeatured ? "border-neon-purple/40 ring-1 ring-neon-purple/20" : ""}`}
              style={{ borderColor: `${accent}40`, boxShadow: plan.cardStyle?.borderGlow ? `0 0 24px ${accent}25` : undefined }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-2xl mb-1 block">{icon}</span>
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl font-bold" style={{ color: accent }}>
                      {formatPlanPrice(pricing.priceCents, plan.currency, locale)}
                    </p>
                    {pricing.onSale && pricing.originalCents && (
                      <p className="text-sm line-through text-muted-foreground">
                        {formatPlanPrice(pricing.originalCents, plan.currency, locale)}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{billingLabel}</p>
                  {remaining != null && (
                    <p className="text-xs text-amber-400/90 mt-1">
                      {soldOut ? "Sold out" : `${remaining} remaining`}
                    </p>
                  )}
                  {plan.planKind !== "STANDARD" && (
                    <Badge variant="outline" className="mt-2 text-[10px] uppercase tracking-wide">
                      {plan.planKind.replace("_", " ")}
                    </Badge>
                  )}
                  {pricing.onSale && (
                    <span className="inline-block mt-1 text-xs rounded-full bg-amber-500/20 text-amber-400 px-2 py-0.5">
                      -{pricing.discountPercent}% limited offer
                    </span>
                  )}
                  {saleEnds != null && saleEnds > 0 && (
                    <p className="text-xs text-amber-400 mt-1">Ends in {Math.ceil(saleEnds / 3600000)}h</p>
                  )}
                </div>
                {plan.isFeatured && <Badge variant="premium">Popular</Badge>}
              </div>
              {plan.description && <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>}
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-neon-blue shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button variant="outline" disabled className="w-full">Current plan</Button>
              ) : isOwnedHigher ? (
                <Button variant="outline" disabled className="w-full">Included in your plan</Button>
              ) : soldOut ? (
                <Button variant="outline" disabled className="w-full">Sold out</Button>
              ) : (
                <Button
                  variant={plan.isFeatured ? "neon" : "outline"}
                  className="w-full"
                  disabled={pending && loadingSlug === plan.slug}
                  onClick={() => purchase(plan.slug)}
                >
                  {pending && loadingSlug === plan.slug ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : currentPlan ? (
                    `Upgrade to ${plan.name}`
                  ) : (
                    plan.cta ?? pageSettings.ctaText
                  )}
                </Button>
              )}
            </Card>
          );
        })}
      </div>

      {!isLoggedIn && (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href={`/${locale}/login`} className="text-neon-purple hover:underline">Sign in</Link> to purchase
        </p>
      )}
    </div>
  );
}
