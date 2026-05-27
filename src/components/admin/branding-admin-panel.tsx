"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useAppToast } from "@/hooks/use-app-toast";
import { saveAdminBranding, uploadBrandingAsset } from "@/actions/admin/branding";
import type { BrandingSettings } from "@/lib/branding";
import { SafeImage } from "@/components/ui/safe-image";

export function BrandingAdminPanel({ initial }: { initial: BrandingSettings }) {
  const appToast = useAppToast();
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState(initial);

  async function upload(type: string, file: File) {
    const fd = new FormData();
    fd.set("file", file);
    fd.set("type", type);
    startTransition(async () => {
      const r = await uploadBrandingAsset(fd);
      if (r.success) {
        appToast.uploaded();
        window.location.reload();
      } else appToast.error(r.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 max-w-4xl">
      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Site Identity</h3>
        <Input value={settings.siteTitle} onChange={(e) => setSettings((s) => ({ ...s, siteTitle: e.target.value }))} />
        <Input value={settings.siteTagline} onChange={(e) => setSettings((s) => ({ ...s, siteTagline: e.target.value }))} />
        <Textarea value={settings.footerText ?? ""} onChange={(e) => setSettings((s) => ({ ...s, footerText: e.target.value }))} rows={2} />
        <Input value={settings.ogTitle ?? ""} onChange={(e) => setSettings((s) => ({ ...s, ogTitle: e.target.value }))} placeholder="OpenGraph title" />
        <Textarea value={settings.ogDescription ?? ""} onChange={(e) => setSettings((s) => ({ ...s, ogDescription: e.target.value }))} placeholder="OpenGraph description" rows={2} />
        <Button
          variant="neon"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await saveAdminBranding(settings);
              if (r.success) appToast.saved();
              else appToast.error(r.error);
            })
          }
        >
          Save branding
        </Button>
      </Card>

      <Card className="glass p-6 space-y-4">
        <h3 className="font-semibold">Assets</h3>
        {[
          { type: "logo", label: "Logo", url: settings.logoUrl },
          { type: "favicon", label: "Favicon", url: settings.faviconUrl },
          { type: "mobile", label: "Mobile icon", url: settings.mobileIconUrl },
        ].map((asset) => (
          <div key={asset.type} className="flex items-center gap-4">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-border/40">
              <SafeImage src={asset.url} alt="" fill className="object-contain" sizes="48px" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{asset.label}</p>
              <Input
                type="file"
                accept="image/*"
                className="mt-1 text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(asset.type, f);
                }}
              />
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
