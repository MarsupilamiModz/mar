"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createReferralLink,
  toggleReferralLink,
  updateReferralLink,
} from "@/actions/admin/referrals";
import { buildReferralRegisterUrl } from "@/lib/referral-url";
import type { getAdminReferrals } from "@/actions/admin/referrals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppToast } from "@/hooks/use-app-toast";
import { formatDateTime } from "@/lib/format-locale";
import { MembershipTier } from "@prisma/client";

type ReferralData = Extract<
  Awaited<ReturnType<typeof getAdminReferrals>>,
  { success: true }
>["data"];

export function ReferralsAdminPanel({ data, locale }: { data: ReferralData; locale: string }) {
  const router = useRouter();
  const appToast = useAppToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground uppercase">Clicks</p>
          <p className="text-2xl font-bold tabular-nums">{data.totals.clicks}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground uppercase">Registrations</p>
          <p className="text-2xl font-bold tabular-nums">{data.totals.registrations}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground uppercase">Premium grants</p>
          <p className="text-2xl font-bold tabular-nums">{data.totals.signups}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground uppercase">Conversion</p>
          <p className="text-2xl font-bold tabular-nums">{data.conversionRate}%</p>
        </Card>
      </div>

      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Create referral link</h3>
        <form
          ref={formRef}
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const r = await createReferralLink({
                code: fd.get("code") as string,
                name: fd.get("name") as string,
                premiumType: (fd.get("premiumType") as MembershipTier) || "PREMIUM",
                premiumDays: Number(fd.get("premiumDays") || 3),
                maxUses: fd.get("maxUses") ? Number(fd.get("maxUses")) : null,
                trackingEnabled: fd.get("trackingEnabled") === "on",
              });
              if (r.success) {
                appToast.saved();
                formRef.current?.reset();
                router.refresh();
              } else appToast.error(r.error);
            });
          }}
        >
          <Input name="code" placeholder="Code (e.g. DISCORD2025)" required />
          <Input name="name" placeholder="Campaign name" required />
          <Input name="premiumDays" type="number" defaultValue={3} min={1} placeholder="Premium days" />
          <Input name="maxUses" type="number" min={1} placeholder="Max uses (optional)" />
          <select
            name="premiumType"
            defaultValue="PREMIUM"
            className="h-10 rounded-md border border-input bg-background/50 px-3 text-sm"
          >
            <option value="PREMIUM_LITE">Premium Lite</option>
            <option value="PREMIUM">Premium</option>
            <option value="PREMIUM_MAX">Premium Max</option>
          </select>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="trackingEnabled" defaultChecked /> Enable click tracking
          </label>
          <Button type="submit" variant="neon" disabled={pending} className="sm:col-span-2">
            Create link
          </Button>
        </form>
      </Card>

      <Card className="glass p-6">
        <h3 className="font-semibold mb-4">Referral links</h3>
        <div className="space-y-3">
          {data.links.map((link) => (
            <div key={link.id} className="rounded-lg border border-border/40 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{link.name}</p>
                  <p className="font-mono text-sm text-neon-purple">{link.code}</p>
                </div>
                <Badge variant={link.active ? "premium" : "outline"}>
                  {link.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground break-all">
                {buildReferralRegisterUrl(locale, link.code)}
              </p>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{link.premiumDays}d {link.premiumType}</span>
                <span>{link.clickCount} clicks</span>
                <span>{link.currentUses} uses</span>
                {link.maxUses != null && <span>max {link.maxUses}</span>}
                {link.expiresAt && <span>expires {formatDateTime(link.expiresAt, locale)}</span>}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await toggleReferralLink(link.id, !link.active);
                      if (r.success) router.refresh();
                      else appToast.error(r.error);
                    })
                  }
                >
                  {link.active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    const days = prompt("Premium days", String(link.premiumDays));
                    if (!days) return;
                    startTransition(async () => {
                      const r = await updateReferralLink(link.id, { premiumDays: Number(days) });
                      if (r.success) router.refresh();
                      else appToast.error(r.error);
                    });
                  }}
                >
                  Edit days
                </Button>
              </div>
            </div>
          ))}
          {data.links.length === 0 && (
            <p className="text-sm text-muted-foreground">No referral links yet.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
