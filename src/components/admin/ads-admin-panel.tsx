"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  saveAdminAdSettings,
  toggleAdPlacement,
} from "@/actions/admin/ads";
import type { AdFormat, AdProviderType } from "@prisma/client";
import type { AdProviderSettings } from "@/lib/ads";

type Props = {
  data: {
    settings: AdProviderSettings;
    placements: Array<{
      id: string;
      slug: string;
      name: string;
      location: string;
      format: AdFormat;
      provider: AdProviderType;
      isEnabled: boolean;
      impressions: number;
      clicks: number;
    }>;
    providers: Array<{ type: AdProviderType; name: string; isEnabled: boolean; config: unknown }>;
    totalImpressions: number;
    totalClicks: number;
  };
};

export function AdsAdminPanel({ data }: Props) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState(data.settings);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Impressions</p>
          <p className="text-2xl font-bold">{data.totalImpressions.toLocaleString()}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">Clicks</p>
          <p className="text-2xl font-bold">{data.totalClicks.toLocaleString()}</p>
        </Card>
        <Card className="glass p-4">
          <p className="text-xs text-muted-foreground">CTR</p>
          <p className="text-2xl font-bold">
            {data.totalImpressions > 0
              ? `${((data.totalClicks / data.totalImpressions) * 100).toFixed(2)}%`
              : "—"}
          </p>
        </Card>
      </div>

      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Global Ad Settings</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex items-center justify-between gap-4 text-sm">
            Enable ads globally
            <Switch
              checked={settings.globalAdsEnabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, globalAdsEnabled: v }))}
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            Popup ads
            <Switch
              checked={settings.popupAdsEnabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, popupAdsEnabled: v }))}
            />
          </label>
        </div>
        <Input
          placeholder="AdSense Client ID (ca-pub-...)"
          value={settings.adsenseClientId ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, adsenseClientId: e.target.value }))}
        />
        <Input
          placeholder="NitroPay Site ID"
          value={settings.nitropayId ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, nitropayId: e.target.value }))}
        />
        <Input
          placeholder="Ezoic Site ID"
          value={settings.ezoicId ?? ""}
          onChange={(e) => setSettings((s) => ({ ...s, ezoicId: e.target.value }))}
        />
        <Button
          variant="neon"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveAdminAdSettings(settings);
              if (r.success) appToast.saved();
              else appToast.error(r.error);
            })
          }
        >
          Save provider settings
        </Button>
      </Card>

      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Ad Placements</h3>
        <div className="space-y-2">
          {data.placements.map((ad) => (
            <div key={ad.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 p-3 text-sm">
              <div className="flex-1 min-w-[200px]">
                <p className="font-medium">{ad.name}</p>
                <p className="text-xs text-muted-foreground">{ad.location} · {ad.format}</p>
              </div>
              <Badge variant="outline">{ad.impressions} views</Badge>
              <Badge variant="outline">{ad.clicks} clicks</Badge>
              <Switch
                checked={ad.isEnabled}
                onCheckedChange={(v) =>
                  startTransition(async () => {
                    await toggleAdPlacement(ad.id, v);
                  })
                }
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
