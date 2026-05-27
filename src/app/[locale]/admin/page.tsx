import Link from "next/link";
import { getAdminAnalytics } from "@/actions/admin/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TICKET_STATUS_LABELS } from "@/lib/ticket-labels";
import type { Locale } from "@/i18n/config";

export default async function AdminOverviewPage({ params: { locale } }: { params: { locale: Locale } }) {
  const result = await getAdminAnalytics();
  const data = result.success
    ? result.data
    : {
        totalUsers: 0,
        premiumUsers: 0,
        activeSubscriptions: 0,
        bannedUsers: 0,
        openTickets: 0,
        revenue30d: 0,
        recentTickets: [],
        recentMods: [],
        recentPurchases: [],
        latestUsers: [],
      };

  const stats = [
    { label: "Total Users", value: data.totalUsers },
    { label: "Premium Users", value: data.premiumUsers },
    { label: "Active Subscriptions", value: data.activeSubscriptions },
    { label: "Open Tickets", value: data.openTickets },
    { label: "Banned Users", value: data.bannedUsers },
    { label: "Revenue (30d)", value: `$${data.revenue30d.toFixed(0)}` },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold">Admin Overview</h1>
      <p className="mt-1 text-sm text-muted-foreground">Platform analytics at a glance</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Tickets</CardTitle>
            <Link href={`/${locale}/admin/tickets`} className="text-xs text-neon-purple hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets</p>
            ) : (
              data.recentTickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/${locale}/admin/tickets/${t.id}`}
                  className="flex justify-between text-sm hover:text-neon-purple"
                >
                  <span className="line-clamp-1">{t.subject}</span>
                  <Badge variant="outline" className="shrink-0 ml-2">
                    {TICKET_STATUS_LABELS[t.status as keyof typeof TICKET_STATUS_LABELS]}
                  </Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Latest Users</CardTitle>
            <Link href={`/${locale}/admin/users`} className="text-xs text-neon-purple hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.latestUsers.map((u) => (
              <Link
                key={u.id}
                href={`/${locale}/admin/users/${u.id}`}
                className="flex justify-between text-sm hover:text-neon-purple"
              >
                <span>@{u.username}</span>
                <span className="text-muted-foreground">{u.role}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.recentMods.map((m) => (
              <div key={m.id} className="flex justify-between">
                <span className="line-clamp-1">{m.title}</span>
                <span className="text-muted-foreground shrink-0">@{m.author.username}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Recent Purchases</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {data.recentPurchases.map((p) => (
              <div key={p.id} className="flex justify-between">
                <span className="line-clamp-1">{p.mod.title}</span>
                <span className="text-muted-foreground">@${(p.amountCents / 100).toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
