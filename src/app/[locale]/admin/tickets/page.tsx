import { getTicketsAdmin, getTicketDashboardStats } from "@/actions/tickets";
import { TicketsTable } from "@/components/admin/tickets-table";
import { TicketDashboardWidgets } from "@/components/admin/ticket-dashboard-widgets";
import type { Locale } from "@/i18n/config";

export default async function AdminTicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: { page?: string };
}) {
  const { locale } = await params;

  const [result, statsResult] = await Promise.all([
    getTicketsAdmin({ page: Number(searchParams.page) || 1 }),
    getTicketDashboardStats(),
  ]);
  const data = result.success
    ? result.data
    : { tickets: [], pages: 0, page: 1 };
  const stats = statsResult.success
    ? statsResult.data
    : {
        openTickets: 0,
        unassigned: 0,
        assigned: 0,
        slaViolations: 0,
        pendingResponses: 0,
        resolvedToday: 0,
        avgResponseMinutes: 0,
      };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enterprise support dashboard — assignment, SLA, and escalation</p>
      </div>
      <TicketDashboardWidgets stats={stats} />
      <div>
        <TicketsTable
          locale={locale}
          initialTickets={data.tickets}
          initialPages={data.pages}
          initialPage={data.page}
        />
      </div>
    </div>
  );
}
