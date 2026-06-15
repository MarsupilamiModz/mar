"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Crown, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPlanPrice, getEffectivePlanPrice, getSaleTimeRemaining, type MembershipPlanData } from "@/lib/membership";
import type { PremiumPageSettings } from "@/lib/membership";
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
  | "saleEndsAt"
  | "cardStyle"
  | "iconKey"
> & { cta?: string };

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
          const pricing = getEffectivePlanPrice(plan as MembershipPlanData);
          const saleEnds = getSaleTimeRemaining(plan as MembershipPlanData);
          const icon = plan.iconKey ?? plan.cardStyle?.iconKey ?? "👑";

          return (
            <Card
              key={plan.id}
              className={`glass p-6 flex flex-col ${plan.isFeatured ? "border-neon-purple/50 shadow-[0_0_30px_-8px_rgba(168,85,247,0.35)]" : ""}`}
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
                  <p className="text-xs text-muted-foreground mt-1">Lifetime · one-time payment</p>
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
