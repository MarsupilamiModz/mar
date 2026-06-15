"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCredits, formatCreditsFromCents } from "@/lib/credits";
import { startCreditPackCheckout, purchaseShopProductWithCredits } from "@/actions/shop";
import { effectiveCreditPrice } from "@/lib/shop";
import { useAppToast } from "@/hooks/use-app-toast";
import { SafeImage } from "@/components/ui/safe-image";

type ShopProduct = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  productType: string;
  creditPrice: number;
  priceCents: number;
  creditsAmount: number | null;
  thumbnailUrl: string | null;
  isFeatured: boolean;
  salePercent: number;
  mod?: { slug: string; title: string } | null;
  membershipPlan?: { slug: string; name: string } | null;
};

export function ShopClient({
  products,
  walletBalance,
  locale,
}: {
  products: ShopProduct[];
  walletBalance: number;
  locale: string;
}) {
  const appToast = useAppToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-8">
      <Card className="glass border-neon-purple/30 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Your balance</p>
          <p className="text-3xl font-bold text-gradient">{formatCredits(walletBalance, locale)}</p>
        </div>
        <Coins className="h-10 w-10 text-neon-purple opacity-80" />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => {
          const creditCost = effectiveCreditPrice(p);
          const isCreditPack = p.productType === "CREDIT_PACK";

          return (
            <Card
              key={p.id}
              className="glass overflow-hidden hover:border-neon-purple/40 transition-all duration-300 hover:-translate-y-0.5"
            >
              <div className="relative aspect-[16/9] bg-gradient-to-br from-neon-purple/20 to-neon-blue/10">
                {p.thumbnailUrl ? (
                  <SafeImage src={p.thumbnailUrl} alt="" fill className="object-cover" sizes="400px" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Coins className="h-12 w-12 text-neon-purple" />
                  </div>
                )}
                {p.isFeatured && (
                  <Badge variant="premium" className="absolute top-3 right-3">Featured</Badge>
                )}
                {p.salePercent > 0 && (
                  <Badge className="absolute top-3 left-3">-{p.salePercent}%</Badge>
                )}
              </div>
              <div className="p-5 space-y-3">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                {p.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>
                )}
                {isCreditPack && p.creditsAmount && (
                  <p className="text-2xl font-bold text-neon-blue">
                    {formatCredits(p.creditsAmount, locale)}
                  </p>
                )}
                {!isCreditPack && creditCost > 0 && (
                  <p className="text-xl font-bold text-gradient">{formatCredits(creditCost, locale)}</p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  {isCreditPack && (
                    <Button
                      variant="neon"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await startCreditPackCheckout(
                            p.id,
                            locale,
                            typeof window !== "undefined" ? window.location.origin : undefined
                          );
                          if (!r.success) {
                            appToast.error(r.error);
                            return;
                          }
                          if (r.data.url) window.location.href = r.data.url;
                          else appToast.error("Checkout failed: Stripe did not return a payment URL");
                        })
                      }
                    >
                      <CreditCard className="h-4 w-4 mr-1" />
                      {formatCreditsFromCents(p.priceCents, locale)}
                    </Button>
                  )}
                  {!isCreditPack && creditCost > 0 && (
                    <Button
                      variant="neon"
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const r = await purchaseShopProductWithCredits(p.id);
                          if (r.success) {
                            appToast.saved();
                            router.refresh();
                          } else appToast.error(r.error);
                        })
                      }
                    >
                      Buy with Credits
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
