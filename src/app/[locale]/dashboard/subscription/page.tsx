import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getUserMembershipTier, formatPlanPrice } from "@/lib/membership";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MembershipActions } from "@/components/membership/membership-actions";
import type { Locale } from "@/i18n/config";

export default async function MembershipPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;

  const user = await requireAuth(`/${locale}/login`);

  const [purchases, tier] = await Promise.all([
    prisma.membershipPurchase.findMany({
      where: { userId: user.id },
      include: { plan: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getUserMembershipTier(user.id),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Membership</h1>
      <p className="text-sm text-muted-foreground">Lifetime access — no recurring billing.</p>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Current membership
            {tier ? <Badge variant="premium">{tier.name}</Badge> : <Badge variant="outline">Free</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!tier ? (
            <p className="text-sm text-muted-foreground">You don&apos;t have a lifetime membership yet.</p>
          ) : (
            <div className="text-sm space-y-1">
              <p className="font-medium">{tier.name}</p>
              <p className="text-muted-foreground">
                {formatPlanPrice(tier.priceCents, tier.currency, locale)} · lifetime access
              </p>
              <ul className="mt-2 space-y-1">
                {tier.features.map((f) => (
                  <li key={f} className="text-xs text-muted-foreground">• {f}</li>
                ))}
              </ul>
            </div>
          )}
          <MembershipActions locale={locale} purchases={purchases} />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Your benefits</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Premium mod downloads and exclusive content</p>
          <p>• Ad-free browsing across the marketplace</p>
          <p>• Discord premium role (link Discord in settings)</p>
          <p>• Early access to beta releases (Premium Max)</p>
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/${locale}/premium`}>Compare lifetime plans</Link>
      </Button>
    </div>
  );
}
