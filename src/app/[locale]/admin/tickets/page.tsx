import { getTicketsAdmin, getTicketDashboardStats } from "@/actions/tickets";
import { AdminTicketsPageClient } from "@/components/admin/admin-tickets-page-client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { TicketQueue } from "@/lib/ticket-queues";
import type { Locale } from "@/i18n/config";

const VALID_QUEUES = new Set<TicketQueue>([
  "all",
  "open",
  "pending",
  "escalated",
  "unassigned",
  "mine",
  "waiting_user",
  "solved",
  "closed",
]);

export default async function AdminTicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string; queue?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  const queueParam = sp.queue as TicketQueue | undefined;
  const queue: TicketQueue =
    queueParam && VALID_QUEUES.has(queueParam) ? queueParam : "all";

  const [result, statsResult, staffUsers] = await Promise.all([
    getTicketsAdmin({
      page: Number(sp.page) || 1,
      queue,
      currentUserId: user?.id,
    }),
    getTicketDashboardStats(),
    prisma.user.findMany({
      where: {
        role: { in: ["OWNER", "ADMIN", "MODERATOR", "SUPPORT"] },
        deletedAt: null,
      },
      select: { id: true, username: true },
    }),
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
    <AdminTicketsPageClient
      locale={locale}
      currentUserId={user!.id}
      initialTickets={data.tickets}
      initialPages={data.pages}
      initialPage={data.page}
      initialQueue={queue}
      stats={stats}
      staffUsers={staffUsers}
    />
  );
}
