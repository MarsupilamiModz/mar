"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function SubscriptionActions({
  locale,
  hasSubscription,
}: {
  locale: string;
  hasSubscription: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast({ title: "Portal unavailable", description: data.error, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {hasSubscription && (
        <Button variant="neon" onClick={openPortal} disabled={loading}>
          {loading ? "Loading..." : "Manage billing & invoices"}
        </Button>
      )}
      <Button variant="outline" asChild>
        <a href={`/${locale}/premium`}>{hasSubscription ? "Change plan" : "Upgrade"}</a>
      </Button>
    </div>
  );
}
