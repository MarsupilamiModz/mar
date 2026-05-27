import { getAdminMembershipPurchases } from "@/actions/admin/memberships";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatCents } from "@/lib/affiliate";
import type { Locale } from "@/i18n/config";

export default async function AdminMembershipPurchasesPage({ params: { locale } }: { params: { locale: Locale } }) {
  const result = await getAdminMembershipPurchases();
  const { purchases, totalRevenueCents, total } = result.success
    ? result.data
    : { purchases: [], totalRevenueCents: 0, total: 0 };

  return (
    <div>
      <h1 className="text-2xl font-bold">Membership Purchases</h1>
      <p className="mt-1 text-sm text-muted-foreground">Lifetime one-time membership payments via Stripe</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total purchases</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-neon-purple">{formatCents(totalRevenueCents, locale)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass mt-8">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-muted-foreground">
                  <th className="p-4">User</th>
                  <th className="p-4">Plan</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Date</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                      No membership purchases yet
                    </td>
                  </tr>
                ) : (
                  purchases.map((p) => (
                    <tr key={p.id} className="border-b border-border/30">
                      <td className="p-4">
                        <Link href={`/${locale}/admin/users/${p.user.id}`} className="text-neon-purple hover:underline">
                          @{p.user.username}
                        </Link>
                        <p className="text-xs text-muted-foreground">{p.user.email}</p>
                      </td>
                      <td className="p-4">
                        <Badge variant="premium">{p.plan.name}</Badge>
                      </td>
                      <td className="p-4">{formatCents(p.amountCents, locale)}</td>
                      <td className="p-4 text-muted-foreground">
                        {new Date(p.createdAt).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
