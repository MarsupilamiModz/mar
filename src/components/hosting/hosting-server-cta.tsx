"use client";

import { useState, useTransition } from "react";
import { Rocket, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ResolvedHostingPartner } from "@/lib/hosting/resolve";

type Props = {
  partner: ResolvedHostingPartner;
  modId?: string;
  collectionId?: string;
  gameId?: string;
  variant?: "inline" | "sidebar";
};

export function HostingServerCta({
  partner,
  modId,
  collectionId,
  gameId,
  variant = "inline",
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const trackClick = () => {
    void fetch("/api/hosting/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerId: partner.partnerId,
        modId,
        collectionId,
        gameId,
        context: variant === "sidebar" ? "SIDEBAR" : "CTA",
      }),
    });
  };

  const startServer = () => {
    setError(null);
    startTransition(async () => {
      trackClick();
      try {
        const res = await fetch("/api/hosting/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modId, collectionId }),
        });
        const data = (await res.json()) as { redirectUrl?: string; error?: string };
        if (!res.ok || !data.redirectUrl) {
          setError(data.error ?? "Could not start server");
          return;
        }
        window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
      } catch {
        window.open(partner.affiliateUrl, "_blank", "noopener,noreferrer");
      }
    });
  };

  const openAffiliate = () => {
    trackClick();
    window.open(partner.affiliateUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Card className={`glass border-neon-purple/20 ${variant === "sidebar" ? "" : "mt-6"}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Rocket className="h-5 w-5 text-neon-purple" />
          Passenden Server mieten
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {partner.description ? (
          <p className="text-sm text-muted-foreground">{partner.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Starte einen Gameserver, der zu diesem Modpack passt — bereit für Installation und Spiel.
          </p>
        )}
        {partner.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={partner.logoUrl} alt={partner.name} className="h-8 object-contain" />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="neon" disabled={pending} onClick={startServer}>
            🚀 Server für dieses Modpack starten
          </Button>
          <Button variant="outline" size="sm" disabled={pending} onClick={openAffiliate}>
            <ExternalLink className="h-4 w-4 mr-1" />
            {partner.name}
          </Button>
        </div>
        {partner.oneClickEnabled ? (
          <p className="text-xs text-muted-foreground">One-Click Install verfügbar</p>
        ) : null}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
