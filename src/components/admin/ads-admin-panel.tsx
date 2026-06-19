"use client";

import { useState, useTransition } from "react";
import { safeToLocaleString } from "@/lib/i18n/safe-locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAppToast } from "@/hooks/use-app-toast";
import {
  saveAdminAdSettings,
  saveAdminSiteVerification,
  saveAdminHeadScripts,
  toggleAdPlacement,
} from "@/actions/admin/ads";
import type { AdFormat, AdProviderType } from "@prisma/client";
import type { AdProviderSettings } from "@/lib/ads";
import type { AdSenseReadinessReport } from "@/lib/ads-readiness";
import type { SiteVerificationSettings } from "@/lib/site-verification";
import type { HeadScriptsSettings } from "@/lib/head-scripts";
import { DEFAULT_ADSENSE_CLIENT_ID } from "@/lib/adsense-config";

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
    readiness: AdSenseReadinessReport;
    verification: SiteVerificationSettings;
    headScripts: HeadScriptsSettings;
  };
};

type Tab =
  | "status"
  | "adsense"
  | "microsoft"
  | "verification"
  | "analytics"
  | "roles"
  | "placements";

export function AdsAdminPanel({ data }: Props) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState(data.settings);
  const [verification, setVerification] = useState(data.verification);
  const [headScripts, setHeadScripts] = useState(data.headScripts);
  const [tab, setTab] = useState<Tab>("status");

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
            ["status", "AdSense Status"],
            ["adsense", "Google AdSense"],
            ["microsoft", "Microsoft Ads"],
            ["verification", "Verification"],
            ["analytics", "Analytics"],
            ["roles", "Role visibility"],
            ["placements", "Placements"],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} variant={tab === id ? "neon" : "outline"} size="sm" onClick={() => setTab(id)}>
            {label}
          </Button>
        ))}
      </div>

      {tab === "status" && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">AdSense readiness</h3>
          <p className="text-xs text-muted-foreground">
            Publisher: {data.readiness.publisherId || DEFAULT_ADSENSE_CLIENT_ID}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {data.readiness.checks.map((check) => (
              <div
                key={check.id}
                className="rounded-lg border border-border/40 p-3 flex items-start justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-medium">{check.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{check.detail}</p>
                </div>
                <Badge variant={check.ok ? "premium" : "destructive"}>{check.ok ? "✓" : "✗"}</Badge>
              </div>
            ))}
          </div>
          {data.readiness.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {data.readiness.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            ads.txt: <a className="underline" href="/ads.txt" target="_blank" rel="noreferrer">/ads.txt</a>
          </p>
        </Card>
      )}

      {tab === "analytics" && (
        <Card className="glass p-6 space-y-3">
          <h3 className="font-semibold">Analytics</h3>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="glass p-4">
              <p className="text-xs text-muted-foreground">Impressions</p>
              <p className="text-2xl font-bold">{safeToLocaleString(data.totalImpressions)}</p>
            </Card>
            <Card className="glass p-4">
              <p className="text-xs text-muted-foreground">Clicks</p>
              <p className="text-2xl font-bold">{safeToLocaleString(data.totalClicks)}</p>
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
          <p className="text-xs text-muted-foreground">
            Connect Google Analytics via Branding → Head Scripts or Verification meta tags.
          </p>
        </Card>
      )}

      {tab === "verification" && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">Site verification</h3>
          <Input
            placeholder="Google Search Console verification code"
            value={verification.googleSiteVerification ?? ""}
            onChange={(e) => setVerification((v) => ({ ...v, googleSiteVerification: e.target.value }))}
          />
          <Input
            placeholder="Google AdSense verification meta (optional)"
            value={verification.googleAdsenseVerification ?? ""}
            onChange={(e) => setVerification((v) => ({ ...v, googleAdsenseVerification: e.target.value }))}
          />
          <Input
            placeholder="Bing Webmaster verification code"
            value={verification.bingSiteVerification ?? ""}
            onChange={(e) => setVerification((v) => ({ ...v, bingSiteVerification: e.target.value }))}
          />
          <Button
            variant="neon"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveAdminSiteVerification(verification);
                if (r.success) appToast.saved("Verification saved");
                else appToast.error(r.error);
              })
            }
          >
            Save verification tags
          </Button>

          <hr className="border-border/40" />
          <h4 className="font-medium text-sm">Head scripts (Analytics / tracking)</h4>
          <p className="text-xs text-muted-foreground">
            Injected via next/script — no duplicate AdSense loader. Manage full list under Branding → Head Scripts.
          </p>
          <Textarea
            placeholder="Optional inline script snippet (without &lt;script&gt; tags)"
            rows={4}
            value={headScripts.scriptSnippets[0]?.html ?? ""}
            onChange={(e) =>
              setHeadScripts((h) => ({
                ...h,
                scriptSnippets: [
                  {
                    id: "custom-analytics",
                    label: "Custom Analytics",
                    html: e.target.value,
                    enabled: Boolean(e.target.value.trim()),
                    placement: "body",
                  },
                ],
              }))
            }
          />
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await saveAdminHeadScripts(headScripts);
                if (r.success) appToast.saved("Head scripts saved");
                else appToast.error(r.error);
              })
            }
          >
            Save head scripts
          </Button>
        </Card>
      )}

      {tab === "adsense" && (
        <Card className="glass p-6 space-y-4">
          <h3 className="font-semibold">Google AdSense</h3>
          <label className="flex items-center justify-between gap-4 text-sm">
            Global verification script (all pages)
            <Switch
              checked={settings.adsenseGlobalScriptEnabled !== false}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, adsenseGlobalScriptEnabled: v }))}
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            Google Consent Mode v2
            <Switch
              checked={settings.consentModeEnabled !== false}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, consentModeEnabled: v }))}
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm">
            Enable ad slots
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
          <Button variant="neon" disabled={pending} onClick={save}>
            Save AdSense settings
          </Button>
        </Card>
      )}

      {tab === "microsoft" && (
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

      {tab === "placements" && (
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

      {(tab === "placements") && (
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

      {(tab === "placements") && (
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
