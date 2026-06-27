"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { saveCreatorHostingSettings } from "@/actions/creator/hosting";

type Props = {
  profile: {
    hostingAffiliateLink: string | null;
    hostingDescription: string | null;
    hostingBannerUrl: string | null;
    hostingPartnerEnabled: boolean;
  };
  platformSettings: {
    allowCreatorLinks: boolean;
    creatorOnlyGlobal: boolean;
    revenueShareEnabled: boolean;
    creatorHostingShareBps: number;
    platformHostingShareBps: number;
  };
};

export function CreatorHostingPanel({ profile, platformSettings }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    hostingAffiliateLink: profile.hostingAffiliateLink ?? "",
    hostingDescription: profile.hostingDescription ?? "",
    hostingBannerUrl: profile.hostingBannerUrl ?? "",
    hostingPartnerEnabled: profile.hostingPartnerEnabled,
  });

  if (platformSettings.creatorOnlyGlobal) {
    return (
      <Card className="glass">
        <CardContent className="py-8 text-sm text-muted-foreground">
          Die Plattform nutzt ausschließlich globale Hosting-Partner. Eigene Links sind deaktiviert.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Hosting Partner</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!platformSettings.allowCreatorLinks ? (
          <p className="text-sm text-destructive">Creator Hosting Links sind derzeit deaktiviert.</p>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={form.hostingPartnerEnabled}
            onCheckedChange={(v) => setForm((f) => ({ ...f, hostingPartnerEnabled: v }))}
          />
          Eigener Hosting Partner aktiv
        </label>
        <Input
          placeholder="Affiliate Link"
          value={form.hostingAffiliateLink}
          onChange={(e) => setForm((f) => ({ ...f, hostingAffiliateLink: e.target.value }))}
        />
        <Input
          placeholder="Banner URL"
          value={form.hostingBannerUrl}
          onChange={(e) => setForm((f) => ({ ...f, hostingBannerUrl: e.target.value }))}
        />
        <Textarea
          placeholder="Beschreibung für Modpack-Seiten"
          value={form.hostingDescription}
          onChange={(e) => setForm((f) => ({ ...f, hostingDescription: e.target.value }))}
        />
        {platformSettings.revenueShareEnabled ? (
          <p className="text-xs text-muted-foreground">
            Revenue Share: Creator {(platformSettings.creatorHostingShareBps / 100).toFixed(0)}% · Plattform{" "}
            {(platformSettings.platformHostingShareBps / 100).toFixed(0)}%
          </p>
        ) : null}
        <Button
          variant="neon"
          disabled={pending || !platformSettings.allowCreatorLinks}
          onClick={() =>
            startTransition(async () => {
              const r = await saveCreatorHostingSettings(form);
              if (r.success) {
                toast({ title: "Gespeichert" });
                router.refresh();
              } else toast({ title: r.error, variant: "destructive" });
            })
          }
        >
          Speichern
        </Button>
      </CardContent>
    </Card>
  );
}
