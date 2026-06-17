"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoneyFromCents } from "@/lib/currency";
import { startModPurchaseCheckout } from "@/actions/shop";
import { useAppToast } from "@/hooks/use-app-toast";

export function ModPurchaseButton({
  modId,
  priceCents,
  owned,
  locale,
}: {
  modId: string;
  priceCents: number;
  owned: boolean;
  locale: string;
}) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (owned) {
    return (
      <p className="text-xs text-neon-blue text-center mt-2">You own this mod</p>
    );
  }

  return (
    <Button
      variant="outline"
      className="w-full mt-2 border-neon-purple/40"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await startModPurchaseCheckout(
            modId,
            locale,
            typeof window !== "undefined" ? window.location.origin : undefined
          );
          if (r.success && r.data.url) {
            window.location.href = r.data.url;
          } else if (!r.success && r.error === "Unauthorized") {
            window.location.href = `/${locale}/login`;
          } else if (!r.success) {
            appToast.error(r.error);
          } else {
            router.refresh();
          }
        })
      }
    >
      <CreditCard className="h-4 w-4 mr-1.5" />
      Buy {formatMoneyFromCents(priceCents, locale)}
    </Button>
  );
}
