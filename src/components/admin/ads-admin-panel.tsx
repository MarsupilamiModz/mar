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

const ROLE_LEVELS = [
  "GUEST",
  "USER",
  "premium-lite",
  "premium",
  "premium-max",
  "PREMIUM",
  "CREATOR",
  "PARTNER",
  "MODERATOR",
  "ADMIN",
  "OWNER",
] as const;

const PLACEMENT_PAGES = [
  { key: "homepage", label: "Homepage" },
  { key: "listing", label: "Marketplace" },
  { key: "mod-detail", label: "Mod / Sound pages" },
  { key: "dashboard", label: "Dashboard" },
  { key: "sidebar", label: "Sidebar" },
  { key: "footer", label: "Footer" },
  { key: "search", label: "Search" },
  { key: "creator", label: "Creator pages" },
  { key: "category", label: "Collections" },
] as const;

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
  const [tab, setTab] = useState<"overview" | "adsense" | "microsoft" | "roles" | "placements">("overview");

  const rpm =
    data.totalImpressions > 0
      ? ((data.totalClicks / data.totalImpressions) * 1000).toFixed(2)
      : "—";

  const save = () =>
    startTransition(async () => {
      const r = await saveAdminAdSettings(settings);
      if (r.success) appToast.saved();
      else appToast.error(r.error);
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["adsense", "Google AdSense"],
            ["microsoft", "Microsoft Ads"],
            ["roles", "Role visibility"],
            ["placements", "Placements"],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} variant={tab === id ? "neon" : "outline"} size="sm" onClick={() => setTab(id)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-4">
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
          <Card className="glass p-4">
            <p className="text-xs text-muted-foreground">RPM (proxy)</p>
            <p className="text-2xl font-bold">{rpm}</p>
          </Card>
        </div>
      )}

      {(tab === "overview" || tab === "adsense") && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">Google AdSense</h3>
          <label className="flex items-center justify-between gap-4 text-sm">
            Enable AdSense
            <Switch
              checked={settings.adsenseEnabled ?? false}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, adsenseEnabled: v }))}
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            Auto Ads
            <Switch
              checked={settings.adsenseAutoAds ?? false}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, adsenseAutoAds: v }))}
            />
          </label>
          <Input
            placeholder="Publisher ID (ca-pub-...)"
            value={settings.adsenseClientId ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, adsenseClientId: e.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {PLACEMENT_PAGES.map((p) => (
              <Input
                key={p.key}
                placeholder={`Slot ID — ${p.label}`}
                value={settings.adsenseSlotIds?.[p.key] ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    adsenseSlotIds: { ...(s.adsenseSlotIds ?? {}), [p.key]: e.target.value },
                  }))
                }
              />
            ))}
          </div>
          {tab === "adsense" && (
            <Button variant="neon" disabled={pending} onClick={save}>
              Save AdSense settings
            </Button>
          )}
        </Card>
      )}

      {(tab === "overview" || tab === "microsoft") && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">Microsoft Advertising</h3>
          <label className="flex items-center justify-between gap-4 text-sm">
            Enable Microsoft Ads
            <Switch
              checked={settings.microsoftEnabled ?? false}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, microsoftEnabled: v }))}
            />
          </label>
          <Input
            placeholder="Account ID"
            value={settings.microsoftAccountId ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, microsoftAccountId: e.target.value }))}
          />
          <Input
            placeholder="UET Tracking ID"
            value={settings.microsoftTrackingId ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, microsoftTrackingId: e.target.value }))}
          />
          <Input
            placeholder="Conversion ID"
            value={settings.microsoftConversionId ?? ""}
            onChange={(e) => setSettings((s) => ({ ...s, microsoftConversionId: e.target.value }))}
          />
          {tab === "microsoft" && (
            <Button variant="neon" disabled={pending} onClick={save}>
              Save Microsoft settings
            </Button>
          )}
        </Card>
      )}

      {tab === "overview" && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">Multi-network manager</h3>
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
          <p className="text-xs text-muted-foreground">
            Provider priority: {(settings.adProviderPriority ?? ["ADSENSE", "MICROSOFT"]).join(" → ")}
          </p>
          <Button variant="neon" disabled={pending} onClick={save}>
            Save all settings
          </Button>
        </Card>
      )}

      {tab === "roles" && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">Role-based ad control</h3>
          <p className="text-xs text-muted-foreground">
            full = all placements · reduced = fewer ads · none = ad-free
          </p>
          <div className="space-y-3">
            {ROLE_LEVELS.map((role) => (
              <div key={role} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-28 font-medium">{role}</span>
                {(["full", "reduced", "none"] as const).map((level) => (
                  <label key={level} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`role-${role}`}
                      checked={(settings.roleAdLevels?.[role] ?? "full") === level}
                      onChange={() =>
                        setSettings((s) => ({
                          ...s,
                          roleAdLevels: { ...(s.roleAdLevels ?? {}), [role]: level },
                        }))
                      }
                    />
                    {level}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <Button variant="neon" disabled={pending} onClick={save}>
            Save role settings
          </Button>
        </Card>
      )}

      {(tab === "overview" || tab === "placements") && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">Page placement controls</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {PLACEMENT_PAGES.map((p) => (
              <label key={p.key} className="flex items-center justify-between gap-4 text-sm rounded-lg border border-border/40 p-3">
                {p.label}
                <Switch
                  checked={settings.placementEnabled?.[p.key] !== false}
                  onCheckedChange={(v) =>
                    setSettings((s) => ({
                      ...s,
                      placementEnabled: { ...(s.placementEnabled ?? {}), [p.key]: v },
                    }))
                  }
                />
              </label>
            ))}
          </div>
          {tab === "placements" && (
            <Button variant="neon" disabled={pending} onClick={save}>
              Save placement toggles
            </Button>
          )}
        </Card>
      )}

      {(tab === "overview" || tab === "placements") && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">Ad slot inventory</h3>
          <div className="space-y-2">
            {data.placements.map((ad) => (
              <div key={ad.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 p-3 text-sm">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium">{ad.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ad.location} · {ad.format} · {ad.provider}
                  </p>
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
      )}
    </div>
  );
}
