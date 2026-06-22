"use client";

import { useMemo } from "react";
import { Crown, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPlanPrice, getEffectivePlanPrice, getSaleTimeRemaining, type MembershipPlanData } from "@/lib/membership-pricing";

const PLAN_ICONS: Record<string, string> = {
  "premium-lite": "⚡",
  premium: "👑",
  "premium-max": "💎",
};

export function MembershipPlanPreview({
  plan,
  locale,
}: {
  plan: Partial<MembershipPlanData> & { name: string; priceCents: number; currency: string; features: string[] };
  locale: string;
}) {
  const fullPlan = plan as MembershipPlanData;
  const pricing = useMemo(() => getEffectivePlanPrice(fullPlan), [fullPlan]);
  const timeLeft = getSaleTimeRemaining(fullPlan);
  const accent = plan.cardStyle?.accentColor ?? plan.perks?.accentColor ?? "#a855f7";
  const icon = plan.iconKey ?? plan.cardStyle?.iconKey ?? PLAN_ICONS[plan.slug ?? ""] ?? "👑";

  return (
    <Card
      className="glass p-5 flex flex-col max-w-xs mx-auto"
      style={{
        borderColor: `${accent}50`,
        background: plan.cardStyle?.gradient ?? undefined,
        boxShadow: plan.cardStyle?.borderGlow ? `0 0 30px ${accent}30` : undefined,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-2xl">{icon}</span>
          <h4 className="font-semibold mt-1">{plan.name}</h4>
          <div className="flex items-baseline gap-2 mt-1">
            <p className="text-2xl font-bold" style={{ color: accent }}>
              {formatPlanPrice(pricing.priceCents, plan.currency, locale)}
            </p>
            {pricing.onSale && pricing.originalCents && (
              <p className="text-sm line-through text-muted-foreground">
                {formatPlanPrice(pricing.originalCents, plan.currency, locale)}
              </p>
            )}
          </div>
          {pricing.onSale && (
            <Badge variant="premium" className="mt-1">-{pricing.discountPercent}%</Badge>
          )}
        </div>
        {plan.isFeatured && <Crown className="h-5 w-5 text-neon-purple" />}
      </div>
      {timeLeft != null && timeLeft > 0 && (
        <p className="text-xs text-amber-400 mb-2">Sale ends in {Math.ceil(timeLeft / 3600000)}h</p>
      )}
      <ul className="space-y-1 flex-1">
        {plan.features.slice(0, 4).map((f) => (
          <li key={f} className="flex gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3 w-3 shrink-0 text-neon-blue" /> {f}
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-lg py-2 text-center text-sm font-medium" style={{ background: `${accent}20`, color: accent }}>
        {plan.cardStyle?.ctaText ?? "Buy lifetime access"}
      </div>
    </Card>
  );
}
