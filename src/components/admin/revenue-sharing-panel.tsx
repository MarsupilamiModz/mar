"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveAdminRevenueShareSettings } from "@/actions/admin/revenue-sharing";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppToast } from "@/hooks/use-app-toast";
import { bpsToPercent, type RevenueShareSettings } from "@/lib/revenue-sharing";
import { formatCents } from "@/lib/affiliate";

type Dashboard = {
  settings: RevenueShareSettings;
  revenueTodayCents: number;
  revenue30dCents: number;
  pendingPayoutCents: number;
  pendingPayoutCount: number;
  openCommissionCents: number;
  openCommissionCount: number;
};

export function RevenueSharingPanel({ data }: { data: Dashboard }) {
  const router = useRouter();
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    creator: String(data.settings.creatorShareBps / 100),
    designer: String(data.settings.designerShareBps / 100),
    partner: String(data.settings.partnerShareBps / 100),
    platform: String(data.settings.platformShareBps / 100),
  });

  const total =
    Number(form.creator || 0) +
    Number(form.designer || 0) +
    Number(form.partner || 0) +
    Number(form.platform || 0);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (Math.abs(total - 100) > 0.01) {
      appToast.error("Shares must total 100%");
      return;
    }
    startTransition(async () => {
      const r = await saveAdminRevenueShareSettings({
        creatorShareBps: Math.round(Number(form.creator) * 100),
        designerShareBps: Math.round(Number(form.designer) * 100),
        partnerShareBps: Math.round(Number(form.partner) * 100),
        platformShareBps: Math.round(Number(form.platform) * 100),
      });
      if (r.success) {
        appToast.saved();
        router.refresh();
      } else appToast.error(r.error);
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Payout settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global revenue split for mod sales. Per-creator overrides remain in creator profiles.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass p-4">
          <p className="text-xs uppercase text-muted-foreground">Revenue today</p>
          <p className="text-2xl font-bold tabular-nums">{formatCents(data.revenueTodayCents)}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs uppercase text-muted-foreground">Revenue (30 days)</p>
          <p className="text-2xl font-bold tabular-nums">{formatCents(data.revenue30dCents)}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs uppercase text-muted-foreground">Open commissions</p>
          <p className="text-2xl font-bold tabular-nums">{formatCents(data.openCommissionCents)}</p>
          <p className="text-xs text-muted-foreground">{data.openCommissionCount} entries</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs uppercase text-muted-foreground">Pending payouts</p>
          <p className="text-2xl font-bold tabular-nums">{formatCents(data.pendingPayoutCents)}</p>
          <p className="text-xs text-muted-foreground">{data.pendingPayoutCount} payouts</p>
        </Card>
      </div>

      <Card className="glass p-6 max-w-xl">
        <h2 className="font-semibold mb-4">Global revenue split</h2>
        <form onSubmit={save} className="space-y-4">
          {(
            [
              ["creator", "Creator share (%)"],
              ["designer", "Designer share (%)"],
              ["partner", "Partner share (%)"],
              ["platform", "Platform share (%)"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className="text-sm font-medium">{label}</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-1"
              />
            </div>
          ))}
          <p className={`text-sm ${Math.abs(total - 100) < 0.01 ? "text-emerald-400" : "text-destructive"}`}>
            Total: {total.toFixed(1)}% (must equal 100%)
          </p>
          <p className="text-xs text-muted-foreground">
            Current: Creator {bpsToPercent(data.settings.creatorShareBps)}% · Designer{" "}
            {bpsToPercent(data.settings.designerShareBps)}% · Partner {bpsToPercent(data.settings.partnerShareBps)}%
            · Platform {bpsToPercent(data.settings.platformShareBps)}%
          </p>
          <Button type="submit" variant="neon" disabled={pending}>
            Save payout settings
          </Button>
        </form>
      </Card>
    </div>
  );
}
