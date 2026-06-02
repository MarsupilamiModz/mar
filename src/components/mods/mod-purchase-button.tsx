"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCreditsFromCents } from "@/lib/credits";
import { purchaseModWithCredits } from "@/actions/shop";
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
          const r = await purchaseModWithCredits(modId);
          if (r.success) {
            appToast.saved();
            router.refresh();
          } else if (r.error === "Unauthorized") {
            window.location.href = `/${locale}/login`;
          } else {
            appToast.error(r.error);
          }
        })
      }
    >
      <Coins className="h-4 w-4 mr-1.5" />
      Buy {formatCreditsFromCents(priceCents, locale)}
    </Button>
  );
}
