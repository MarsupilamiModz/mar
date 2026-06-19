"use client";

import { TicketsTable } from "@/components/admin/tickets-table";
import { TicketDashboardWidgets } from "@/components/admin/ticket-dashboard-widgets";
import type { TicketQueue } from "@/lib/ticket-queues";
import type { TicketCategory, TicketDepartment, TicketPriority, TicketStatus } from "@prisma/client";

type TicketRow = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  department?: TicketDepartment;
  tags?: unknown;
  updatedAt: Date;
  slaResponseDueAt: Date | null;
  slaResolveDueAt: Date | null;
  firstResponseAt: Date | null;
  user: { username: string };
  assignee: { username: string } | null;
  _count: { messages: number };
};

export function AdminTicketsPageClient({
  locale,
  currentUserId,
  initialTickets,
  initialPages,
  initialPage,
  initialQueue,
  stats,
  staffUsers,
}: {
  locale: string;
  currentUserId: string;
  initialTickets: TicketRow[];
  initialPages: number;
  initialPage: number;
  initialQueue: TicketQueue;
  stats: Parameters<typeof TicketDashboardWidgets>[0]["stats"];
  staffUsers: { id: string; username: string }[];
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enterprise support dashboard — queues, SLA, assignments, and escalation
        </p>
      </div>
      <TicketDashboardWidgets stats={stats} locale={locale} />
      <TicketsTable
        locale={locale}
        currentUserId={currentUserId}
        staffUsers={staffUsers}
        initialTickets={initialTickets}
        initialPages={initialPages}
        initialPage={initialPage}
        initialQueue={initialQueue}
      />
    </div>
  );
}
