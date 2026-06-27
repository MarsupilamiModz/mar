"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  saveHostingPartner,
  deleteHostingPartner,
  setGameHostingPartner,
  savePartnerAdsSettings,
  saveHostingBanner,
  deleteHostingBanner,
} from "@/actions/admin/partner-ads";
import type { HostingPartnerSettings } from "@/lib/hosting/settings";
import type { HostingBannerSize } from "@prisma/client";
import { formatNumber } from "@/lib/format-locale";

type CenterData = Extract<
  Awaited<ReturnType<typeof import("@/actions/admin/partner-ads").getPartnerAdsCenterData>>,
  { success: true }
>["data"];

const BANNER_SIZES: HostingBannerSize[] = [
  "RECT_300x250",
  "LEADERBOARD_728x90",
  "BILLBOARD_970x250",
  "RESPONSIVE",
];

export function PartnerAdsAdminPanel({ data }: { data: CenterData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [settings, setSettings] = useState<HostingPartnerSettings>(data.settings);

  const [partnerForm, setPartnerForm] = useState({
    id: "",
    name: "",
    slug: "",
    affiliateUrl: "",
    websiteUrl: "",
    logoUrl: "",
    description: "",
    trackingId: "",
    apiProvider: "",
    isGlobal: false,
    isActive: true,
  });

  const [bannerForm, setBannerForm] = useState({
    partnerId: data.partners[0]?.id ?? "",
    size: "RESPONSIVE" as HostingBannerSize,
    imageUrl: "",
    targetUrl: "",
    gameId: "",
  });

  return (
    <Tabs defaultValue="partners" className="space-y-6">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="partners">Hosting Partner</TabsTrigger>
        <TabsTrigger value="banners">Banner Verwaltung</TabsTrigger>
        <TabsTrigger value="games">Spiel-Partner</TabsTrigger>
        <TabsTrigger value="settings">Einstellungen</TabsTrigger>
        <TabsTrigger value="stats">Klick Statistiken</TabsTrigger>
      </TabsList>

      <TabsContent value="partners" className="space-y-4">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Hosting Partner anlegen</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Name (z.B. Nitrado)" value={partnerForm.name} onChange={(e) => setPartnerForm((f) => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Affiliate Link" value={partnerForm.affiliateUrl} onChange={(e) => setPartnerForm((f) => ({ ...f, affiliateUrl: e.target.value }))} />
            <Input placeholder="Website" value={partnerForm.websiteUrl} onChange={(e) => setPartnerForm((f) => ({ ...f, websiteUrl: e.target.value }))} />
            <Input placeholder="Logo URL" value={partnerForm.logoUrl} onChange={(e) => setPartnerForm((f) => ({ ...f, logoUrl: e.target.value }))} />
            <Input placeholder="Tracking ID" value={partnerForm.trackingId} onChange={(e) => setPartnerForm((f) => ({ ...f, trackingId: e.target.value }))} />
            <Input placeholder="API Provider (NITRADO, ZAP, …)" value={partnerForm.apiProvider} onChange={(e) => setPartnerForm((f) => ({ ...f, apiProvider: e.target.value }))} />
            <Textarea placeholder="Beschreibung" className="sm:col-span-2" value={partnerForm.description} onChange={(e) => setPartnerForm((f) => ({ ...f, description: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={partnerForm.isGlobal} onCheckedChange={(v) => setPartnerForm((f) => ({ ...f, isGlobal: v }))} />
              Globaler Partner
            </label>
            <Button
              variant="neon"
              disabled={pending || !partnerForm.name || !partnerForm.affiliateUrl}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveHostingPartner(partnerForm);
                  if (r.success) {
                    toast({ title: "Partner gespeichert" });
                    setPartnerForm({ id: "", name: "", slug: "", affiliateUrl: "", websiteUrl: "", logoUrl: "", description: "", trackingId: "", apiProvider: "", isGlobal: false, isActive: true });
                    router.refresh();
                  } else toast({ title: r.error, variant: "destructive" });
                })
              }
            >
              Speichern
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {data.partners.map((p) => (
            <Card key={p.id} className="glass p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{p.name} {p.isGlobal ? "· Global" : ""}</p>
                <p className="text-xs text-muted-foreground truncate max-w-md">{p.affiliateUrl}</p>
                <p className="text-xs text-muted-foreground">{formatNumber(p.totalClicks)} Klicks</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPartnerForm({ id: p.id, name: p.name, slug: p.slug, affiliateUrl: p.affiliateUrl, websiteUrl: p.websiteUrl ?? "", logoUrl: p.logoUrl ?? "", description: p.description ?? "", trackingId: p.trackingId ?? "", apiProvider: p.apiProvider ?? "", isGlobal: p.isGlobal, isActive: p.isActive })}>
                  Bearbeiten
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await deleteHostingPartner(p.id);
                      if (r.success) { toast({ title: "Gelöscht" }); router.refresh(); }
                      else toast({ title: r.error, variant: "destructive" });
                    })
                  }
                >
                  Löschen
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="banners" className="space-y-4">
        <Card className="glass">
          <CardHeader><CardTitle>Banner hinzufügen</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Select value={bannerForm.partnerId} onValueChange={(v) => setBannerForm((f) => ({ ...f, partnerId: v }))}>
              <SelectTrigger><SelectValue placeholder="Partner" /></SelectTrigger>
              <SelectContent>
                {data.partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={bannerForm.size} onValueChange={(v) => setBannerForm((f) => ({ ...f, size: v as HostingBannerSize }))}>
              <SelectTrigger><SelectValue placeholder="Größe" /></SelectTrigger>
              <SelectContent>
                {BANNER_SIZES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Banner Bild-URL (R2: /banners/hosting/…)" className="sm:col-span-2" value={bannerForm.imageUrl} onChange={(e) => setBannerForm((f) => ({ ...f, imageUrl: e.target.value }))} />
            <Input placeholder="Ziel-URL (optional)" value={bannerForm.targetUrl} onChange={(e) => setBannerForm((f) => ({ ...f, targetUrl: e.target.value }))} />
            <Button
              variant="neon"
              disabled={pending || !bannerForm.partnerId || !bannerForm.imageUrl}
              onClick={() =>
                startTransition(async () => {
                  const r = await saveHostingBanner({
                    partnerId: bannerForm.partnerId,
                    size: bannerForm.size,
                    imageUrl: bannerForm.imageUrl,
                    targetUrl: bannerForm.targetUrl || null,
                    gameId: bannerForm.gameId || null,
                  });
                  if (r.success) { toast({ title: "Banner gespeichert" }); router.refresh(); }
                  else toast({ title: r.error, variant: "destructive" });
                })
              }
            >
              Banner speichern
            </Button>
          </CardContent>
        </Card>
        <div className="grid gap-2">
          {data.banners.map((b) => (
            <Card key={b.id} className="glass p-3 flex justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium">{b.partner.name} · {b.size}</p>
                <p className="text-xs text-muted-foreground truncate max-w-lg">{b.imageUrl}</p>
              </div>
              <Button size="sm" variant="destructive" disabled={pending} onClick={() => startTransition(async () => { await deleteHostingBanner(b.id); router.refresh(); })}>Löschen</Button>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="games" className="space-y-3">
        {data.games.map((g) => (
          <Card key={g.id} className="glass p-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">{g.name}</p>
            <Select
              value={g.hostingPartner?.partnerId ?? "none"}
              onValueChange={(v) =>
                startTransition(async () => {
                  const r = await setGameHostingPartner(g.id, v === "none" ? null : v);
                  if (r.success) router.refresh();
                })
              }
            >
              <SelectTrigger className="w-48"><SelectValue placeholder="Partner" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keiner</SelectItem>
                {data.partners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="settings">
        <Card className="glass">
          <CardHeader><CardTitle>Plattform-Einstellungen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-sm font-medium mb-1">Globaler Partner</p>
                <Select value={settings.globalPartnerId ?? "none"} onValueChange={(v) => setSettings((s) => ({ ...s, globalPartnerId: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keiner</SelectItem>
                    {data.partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm"><Switch checked={settings.useGlobalPartner} onCheckedChange={(v) => setSettings((s) => ({ ...s, useGlobalPartner: v }))} /> Globalen Partner verwenden</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={settings.allowCreatorLinks} onCheckedChange={(v) => setSettings((s) => ({ ...s, allowCreatorLinks: v }))} /> Creator eigene Links erlauben</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={settings.creatorOnlyGlobal} onCheckedChange={(v) => setSettings((s) => ({ ...s, creatorOnlyGlobal: v }))} /> Nur globale Partner</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={settings.revenueShareEnabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, revenueShareEnabled: v }))} /> Revenue Share aktivieren</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={settings.oneClickInstallEnabled} onCheckedChange={(v) => setSettings((s) => ({ ...s, oneClickInstallEnabled: v }))} /> One-Click Install API</label>
              </div>
              <Input type="number" placeholder="Creator Share BPS" value={settings.creatorHostingShareBps} onChange={(e) => setSettings((s) => ({ ...s, creatorHostingShareBps: Number(e.target.value) }))} />
              <Input type="number" placeholder="Platform Share BPS" value={settings.platformHostingShareBps} onChange={(e) => setSettings((s) => ({ ...s, platformHostingShareBps: Number(e.target.value) }))} />
            </div>
            <Button
              variant="neon"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await savePartnerAdsSettings(settings);
                  if (r.success) toast({ title: "Einstellungen gespeichert" });
                  else toast({ title: r.error, variant: "destructive" });
                })
              }
            >
              Speichern
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="stats">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Klicks heute" value={data.analytics.clicksToday} />
          <StatCard label="Klicks 7 Tage" value={data.analytics.clicks7d} />
          <StatCard label="Klicks 30 Tage" value={data.analytics.clicks30d} />
          <StatCard label="Conversions (30d)" value={data.analytics.conversions30d} />
        </div>
        <Card className="glass mt-4">
          <CardHeader><CardTitle>Top Partner (30 Tage)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.analytics.topPartners.map((p) => (
              <p key={p.partnerId}>{p.name}: {formatNumber(p.clicks)} Klicks</p>
            ))}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="glass p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{formatNumber(value)}</p>
    </Card>
  );
}
