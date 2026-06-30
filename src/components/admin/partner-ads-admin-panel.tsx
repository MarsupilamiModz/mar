"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { saveHostingPartner, deleteHostingPartner } from "@/actions/admin/partner-ads";
import { formatNumber } from "@/lib/format-locale";

type Partner = {
  id: string;
  name: string;
  description: string | null;
  affiliateUrl: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  totalClicks: number;
  isGlobal: boolean;
};

type Analytics = {
  clicksToday: number;
  clicks7d: number;
  clicks30d: number;
};

export function PartnerAdsAdminPanel({
  partners,
  analytics,
}: {
  partners: Partner[];
  analytics: Analytics;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    affiliateUrl: "",
    websiteUrl: "",
    bannerUrl: "",
  });

  const save = () => {
    startTransition(async () => {
      const r = await saveHostingPartner({
        id: form.id || undefined,
        name: form.name,
        description: form.description,
        affiliateUrl: form.affiliateUrl,
        websiteUrl: form.websiteUrl || undefined,
        logoUrl: form.bannerUrl || undefined,
        isGlobal: partners.length === 0,
      });
      if (r.success) {
        toast({ title: "Partner gespeichert" });
        setForm({ id: "", name: "", description: "", affiliateUrl: "", websiteUrl: "", bannerUrl: "" });
        router.refresh();
      } else toast({ title: r.error, variant: "destructive" });
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Klicks heute" value={analytics.clicksToday} />
        <Stat label="Klicks 7 Tage" value={analytics.clicks7d} />
        <Stat label="Klicks 30 Tage" value={analytics.clicks30d} />
      </div>

      <Card className="card-surface">
        <CardHeader>
          <CardTitle>Hosting Partner</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Partner Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Affiliate Link" value={form.affiliateUrl} onChange={(e) => setForm((f) => ({ ...f, affiliateUrl: e.target.value }))} />
          <Input placeholder="Normaler Link (Website)" value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} />
          <Input placeholder="Banner URL oder Logo URL" value={form.bannerUrl} onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))} />
          <Textarea placeholder="Beschreibung" className="sm:col-span-2" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <Button variant="neon" disabled={pending || !form.name || !form.affiliateUrl} onClick={save}>
            Speichern
          </Button>
        </CardContent>
      </Card>

      {partners.map((p) => (
        <Card key={p.id} className="card-surface p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{p.name}{p.isGlobal ? " · Global" : ""}</p>
            <p className="text-xs text-muted-foreground truncate max-w-md">{p.affiliateUrl}</p>
            <p className="text-xs text-muted-foreground">{formatNumber(p.totalClicks)} Klicks</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setForm({ id: p.id, name: p.name, description: p.description ?? "", affiliateUrl: p.affiliateUrl, websiteUrl: p.websiteUrl ?? "", bannerUrl: p.logoUrl ?? "" })}>Bearbeiten</Button>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => startTransition(async () => { await deleteHostingPartner(p.id); router.refresh(); })}>Löschen</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="card-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{formatNumber(value)}</p>
    </Card>
  );
}
