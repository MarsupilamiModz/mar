import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { getPremiumBillingData } from "@/lib/billing";
import { getUserMembershipTier } from "@/lib/membership";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PremiumManagementCenter } from "@/components/membership/premium-management-center";
import type { Locale } from "@/i18n/config";

export default async function PremiumSubscriptionPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const user = await requireAuth(`/${locale}/login`);

  const [billing, tier] = await Promise.all([
    getPremiumBillingData(user.id, user.email),
    getUserMembershipTier(user.id),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Premium</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your membership, billing, and invoices
        </p>
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Current plan
            {tier ? <Badge variant="premium">{tier.name}</Badge> : <Badge variant="outline">Free</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PremiumManagementCenter
            locale={locale}
            membership={billing.membership}
            subscription={
              billing.subscription
                ? {
                    status: billing.subscription.status,
                    currentPeriodEnd: billing.subscription.currentPeriodEnd,
                    cancelAtPeriodEnd: billing.subscription.cancelAtPeriodEnd,
                    interval: billing.subscription.interval,
                  }
                : null
            }
            currentPlan={billing.currentPlan}
            purchases={billing.purchases}
            invoices={billing.invoices}
            hasStripeSubscription={billing.hasStripeSubscription}
          />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Your benefits</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• Premium mod downloads and exclusive content</p>
          <p>• Ad-free browsing across the marketplace</p>
          <p>• Discord premium role (link Discord in settings)</p>
          <p>• Early access to beta releases (Premium Max)</p>
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href={`/${locale}/premium`}>Compare plans</Link>
      </Button>
    </div>
  );
}
