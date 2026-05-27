import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTicketDetail } from "@/actions/tickets";
import { TicketThread } from "@/components/tickets/ticket-thread";
import { TicketAdminPanel } from "@/components/admin/ticket-admin-panel";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import type { Locale } from "@/i18n/config";

export default async function AdminTicketDetailPage({
  params: { locale, id },
}: {
  params: { locale: Locale; id: string };
}) {
  await requireStaff();
  const result = await getTicketDetail(id);
  if (!result.success) notFound();

  const { ticket } = result.data;
  const staffUsers = await prisma.user.findMany({
    where: { role: { in: ["OWNER", "ADMIN", "MODERATOR", "SUPPORT"] }, deletedAt: null },
    select: { id: true, username: true },
  });

  return (
    <div>
      <Link
        href={`/${locale}/admin/tickets`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TicketThread ticket={ticket} isStaff={true} canReply={true} />
        </div>
        <div className="space-y-4">
          <TicketAdminPanel
            ticketId={ticket.id}
            status={ticket.status}
            priority={ticket.priority}
            assigneeId={ticket.assignee?.id ?? null}
            staffUsers={staffUsers}
          />
          <div className="glass rounded-xl p-4 text-sm">
            <p className="text-muted-foreground">Submitted by</p>
            <p className="font-medium">@{ticket.user.username}</p>
            <p className="text-muted-foreground mt-2">{ticket.user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
