"use client";

import { useState } from "react";
import { getIntlLocale } from "@/lib/i18n/safe-locale";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCreditsFromCents } from "@/lib/credits";

type Purchase = {
  id: string;
  amountCents: number;
  stripePaymentId: string | null;
  createdAt: Date;
  plan: { name: string; slug: string };
};

export function MembershipActions({
  locale,
  purchases,
}: {
  locale: string;
  purchases: Purchase[];
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function openReceipt(paymentId: string) {
    setLoadingId(paymentId);
    try {
      const res = await fetch(`/api/stripe/receipt?paymentIntent=${paymentId}`);
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="neon" asChild>
          <Link href={`/${locale}/premium`}>Upgrade membership</Link>
        </Button>
      </div>

      {purchases.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Payment history</p>
          {purchases.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/40 p-3 text-sm">
              <div>
                <p className="font-medium">{p.plan.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatCreditsFromCents(p.amountCents, locale)} · {new Date(p.createdAt).toLocaleDateString(getIntlLocale(locale))}
                </p>
              </div>
              {p.stripePaymentId && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingId === p.stripePaymentId}
                  onClick={() => openReceipt(p.stripePaymentId!)}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Receipt
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
