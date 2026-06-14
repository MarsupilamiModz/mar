"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  saveMembershipPlan,
  savePremiumPageSettings,
  deleteMembershipPlan,
  reorderMembershipPlans,
} from "@/actions/admin/memberships";
import { MembershipPlanPreview } from "@/components/admin/membership-plan-preview";
import type { MembershipPlanData, MembershipPerks, PremiumPageSettings, PlanCardStyle } from "@/lib/membership";
import { formatPlanPrice } from "@/lib/membership";
import { parseLines, safeFormOptional, safeFormString, safeStripePriceId } from "@/lib/safe-string";
import { SLUG_AUTO_GENERATED_MESSAGE } from "@/lib/slug";

const DEFAULT_PERKS: MembershipPerks = {
  adFree: false,
  exclusiveMods: false,
  creatorContent: false,
  betaAccess: false,
  discordPerks: false,
  earlyAccess: false,
  prioritySupport: false,
};

type Props = {
  plans: MembershipPlanData[];
  pageSettings: PremiumPageSettings;
  locale: string;
};

export function MembershipsAdminPanel({ plans: initial, pageSettings: initialPage, locale }: Props) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [plans, setPlans] = useState(initial);
  const [pageSettings, setPageSettings] = useState(initialPage);
  const [editing, setEditing] = useState<MembershipPlanData | null>(null);
  const [creating, setCreating] = useState(false);
  const [perks, setPerks] = useState<MembershipPerks>(DEFAULT_PERKS);
  const [cardStyle, setCardStyle] = useState<PlanCardStyle>({});
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const openEdit = (plan: MembershipPlanData) => {
    setCreating(false);
    setEditing(plan);
    setPerks({ ...DEFAULT_PERKS, ...plan.perks });
    setCardStyle(plan.cardStyle ?? { accentColor: plan.perks.accentColor ?? undefined });
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setPerks({ ...DEFAULT_PERKS, adFree: true });
    setCardStyle({});
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex == null || dragIndex === targetIndex) return;
    const next = [...plans];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setPlans(next);
    setDragIndex(null);
    startTransition(async () => {
      const r = await reorderMembershipPlans(next.map((p) => p.id));
      if (r.success) router.refresh();
    });
  };

  const movePlan = (index: number, dir: -1 | 1) => {
    const next = [...plans];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPlans(next);
    startTransition(async () => {
      const r = await reorderMembershipPlans(next.map((p) => p.id));
      if (r.success) {
        appToast.saved();
        router.refresh();
      } else appToast.error(r.error);
    });
  };

  const PlanForm = ({
    plan,
    isNew,
  }: {
    plan?: MembershipPlanData;
    isNew?: boolean;
  }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const downloadLimitRaw = safeFormOptional(fd, "downloadLimit");
        const storageRaw = safeFormOptional(fd, "storageLimitMb");
        const feeRaw = safeFormOptional(fd, "marketplaceFeeBps");

        const nextPerks: MembershipPerks = {
          ...perks,
          downloadLimit: downloadLimitRaw ? Number(downloadLimitRaw) : null,
          storageLimitMb: storageRaw ? Number(storageRaw) : null,
          marketplaceFeeBps: feeRaw ? Number(feeRaw) : undefined,
          customBadge: safeFormOptional(fd, "customBadge") ?? null,
          accentColor: safeFormOptional(fd, "accentColor") ?? null,
        };

        startTransition(async () => {
          const r = await saveMembershipPlan({
            id: plan?.id,
            slug: isNew ? safeFormOptional(fd, "slug") : safeFormString(fd, "slug"),
            name: safeFormString(fd, "name"),
            description: safeFormOptional(fd, "description"),
            priceCents: Math.round(Number(fd.get("price")) * 100),
            currency: safeFormOptional(fd, "currency") || "EUR",
            billingType: "ONE_TIME",
            stripePriceId: safeStripePriceId(fd.get("stripePriceId")) ?? undefined,
            features: parseLines(fd.get("features")),
            perks: nextPerks,
            badgeSlug: (fd.get("badgeSlug") as string) || undefined,
            sortOrder: plan?.sortOrder ?? plans.length,
            isActive: fd.get("isActive") === "on",
            isFeatured: fd.get("isFeatured") === "on",
            originalPriceCents: fd.get("originalPrice") ? Math.round(Number(fd.get("originalPrice")) * 100) : null,
            saleDiscountPercent: fd.get("saleDiscount") ? Number(fd.get("saleDiscount")) : null,
            saleEndsAt: (fd.get("saleEndsAt") as string) || null,
            iconKey: (fd.get("iconKey") as string) || null,
            cardStyle: {
              ...cardStyle,
              accentColor: (fd.get("accentColor") as string) || cardStyle.accentColor,
              ctaText: (fd.get("ctaText") as string) || undefined,
              iconKey: (fd.get("iconKey") as string) || undefined,
              borderGlow: fd.get("borderGlow") === "on",
            },
          });
          if (r.success) {
            appToast.saved(isNew ? SLUG_AUTO_GENERATED_MESSAGE : undefined);
            setEditing(null);
            setCreating(false);
            router.refresh();
          } else appToast.error(r.error);
        });
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Slug</label>
          <Input
            name="slug"
            defaultValue={plan?.slug}
            disabled={!isNew}
            className="mt-1 font-mono"
            placeholder={isNew ? "auto-generated from plan name" : undefined}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Badge slug</label>
          <Input name="badgeSlug" defaultValue={plan?.badgeSlug ?? ""} className="mt-1" />
        </div>
      </div>
      <Input name="name" defaultValue={plan?.name} placeholder="Plan name" required />
      <Textarea name="description" defaultValue={plan?.description ?? ""} rows={2} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium">Price (EUR)</label>
          <Input name="price" type="number" step="0.01" defaultValue={plan ? (plan.priceCents / 100).toFixed(2) : "9.99"} required className="mt-1" />
        </div>
        <div>
          <label className="text-sm font-medium">Currency</label>
          <Input name="currency" defaultValue={plan?.currency ?? "EUR"} className="mt-1 w-24" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 rounded-lg border border-border/40 p-4">
        <p className="sm:col-span-3 text-sm font-medium">Limited offer / sale</p>
        <Input name="originalPrice" type="number" step="0.01" placeholder="Original price" defaultValue={plan?.originalPriceCents ? plan.originalPriceCents / 100 : ""} />
        <Input name="saleDiscount" type="number" placeholder="Discount %" defaultValue={plan?.saleDiscountPercent ?? ""} />
        <Input name="saleEndsAt" type="datetime-local" defaultValue={plan?.saleEndsAt ? new Date(plan.saleEndsAt).toISOString().slice(0, 16) : ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 rounded-lg border border-border/40 p-4">
        <p className="sm:col-span-2 text-sm font-medium">Card styling</p>
        <Input name="iconKey" placeholder="Icon emoji" defaultValue={plan?.iconKey ?? "👑"} />
        <Input name="ctaText" placeholder="CTA button text" defaultValue={plan?.cardStyle?.ctaText ?? ""} />
        <label className="flex gap-2 text-sm sm:col-span-2"><input type="checkbox" name="borderGlow" defaultChecked={plan?.cardStyle?.borderGlow ?? true} /> Neon border glow</label>
      </div>
      <div>
        <label className="text-sm font-medium">Stripe one-time Price ID</label>
        <Input name="stripePriceId" placeholder="price_..." defaultValue={plan?.stripePriceId ?? ""} className="mt-1 font-mono text-xs" />
      </div>
      <Textarea name="features" defaultValue={plan?.features.join("\n") ?? ""} rows={5} placeholder="One feature per line" />

      <div className="rounded-lg border border-border/40 p-4 space-y-3">
        <p className="text-sm font-medium">Perks & limits</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input name="downloadLimit" type="number" placeholder="Download limit (empty = unlimited)" defaultValue={plan?.perks.downloadLimit ?? ""} />
          <Input name="storageLimitMb" type="number" placeholder="Storage MB" defaultValue={plan?.perks.storageLimitMb ?? ""} />
          <Input name="marketplaceFeeBps" type="number" placeholder="Marketplace fee (bps)" defaultValue={plan?.perks.marketplaceFeeBps ?? ""} />
          <Input name="customBadge" placeholder="Custom badge ID" defaultValue={plan?.perks.customBadge ?? ""} />
          <Input name="accentColor" type="color" defaultValue={plan?.perks.accentColor ?? "#a855f7"} className="h-10" />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          {(
            [
              ["adFree", "Ad-free"],
              ["exclusiveMods", "Exclusive mods"],
              ["creatorContent", "Creator content"],
              ["betaAccess", "Beta access"],
              ["earlyAccess", "Early access"],
              ["discordPerks", "Discord perks"],
              ["prioritySupport", "Priority support"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <Switch checked={!!perks[key]} onCheckedChange={(v) => setPerks((p) => ({ ...p, [key]: v }))} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isActive" defaultChecked={plan?.isActive ?? true} /> Active
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isFeatured" defaultChecked={plan?.isFeatured ?? false} /> Featured
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="neon" disabled={pending}>{isNew ? "Create plan" : "Save plan"}</Button>
        <Button type="button" variant="ghost" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-8">
      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Premium Page Content</h3>
        <Input value={pageSettings.heroTitle} onChange={(e) => setPageSettings((p) => ({ ...p, heroTitle: e.target.value }))} />
        <Textarea value={pageSettings.heroSubtitle} onChange={(e) => setPageSettings((p) => ({ ...p, heroSubtitle: e.target.value }))} rows={2} />
        <Input value={pageSettings.ctaText} onChange={(e) => setPageSettings((p) => ({ ...p, ctaText: e.target.value }))} />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={pageSettings.showComparison} onCheckedChange={(v) => setPageSettings((p) => ({ ...p, showComparison: v }))} />
          Show plan comparison on premium page
        </label>
        <Button variant="neon" disabled={pending} onClick={() => startTransition(async () => {
          const r = await savePremiumPageSettings(pageSettings);
          if (r.success) appToast.saved();
          else appToast.error(r.error);
        })}>Save page content</Button>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Lifetime membership plans</h3>
        <Button variant="outline" size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New plan</Button>
      </div>

      {(creating || editing) && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass p-6">
            <h3 className="font-semibold mb-4">{creating ? "Create plan" : `Edit ${editing?.name}`}</h3>
            <PlanForm plan={editing ?? undefined} isNew={creating} />
          </Card>
          <div>
            <p className="text-sm text-muted-foreground mb-3">Live preview</p>
            <MembershipPlanPreview
              locale={locale}
              plan={{
                ...(editing ?? { slug: "preview", name: "Preview Plan", priceCents: 999, currency: "EUR", features: [], isFeatured: false }),
                perks,
                cardStyle,
                saleDiscountPercent: editing?.saleDiscountPercent ?? null,
                saleEndsAt: editing?.saleEndsAt ?? null,
                originalPriceCents: editing?.originalPriceCents ?? null,
              }}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan, index) => (
          <Card
            key={plan.id}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            className={`glass p-5 space-y-3 cursor-grab active:cursor-grabbing ${dragIndex === index ? "opacity-50" : ""}`}
            style={{ borderColor: plan.perks.accentColor ? `${plan.perks.accentColor}40` : undefined }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold">{plan.name}</h4>
                <p className="text-2xl font-bold" style={{ color: plan.perks.accentColor ?? undefined }}>
                  {formatPlanPrice(plan.priceCents, plan.currency, locale)}
                </p>
                <p className="text-xs text-muted-foreground">Lifetime · one-time</p>
              </div>
              <div className="flex flex-col gap-1">
                {plan.isFeatured && <Badge variant="premium">Featured</Badge>}
                {!plan.isActive && <Badge variant="outline">Inactive</Badge>}
              </div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {plan.features.slice(0, 4).map((f) => <li key={f}>• {f}</li>)}
            </ul>
            <p className="text-xs font-mono text-muted-foreground truncate">{plan.stripePriceId ?? "No Stripe price"}</p>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => openEdit(plan)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => movePlan(index, -1)} disabled={index === 0}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => movePlan(index, 1)} disabled={index === plans.length - 1}><ArrowDown className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => startTransition(async () => {
                if (!confirm(`Delete ${plan.name}?`)) return;
                const r = await deleteMembershipPlan(plan.id);
                if (r.success) { appToast.saved(); router.refresh(); }
                else appToast.error(r.error);
              })}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
