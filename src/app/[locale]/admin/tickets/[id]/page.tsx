import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTicketActivity, getTicketDetail } from "@/actions/tickets";
import { TicketThread } from "@/components/tickets/ticket-thread";
import { TicketAdminPanel } from "@/components/admin/ticket-admin-panel";
import { TicketActivityTimeline } from "@/components/admin/ticket-activity-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { formatDisplayName } from "@/lib/display-name";
import type { Locale } from "@/i18n/config";

function parseTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string");
}

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;

  await requireStaff();
  const [result, activityResult, staffUsers] = await Promise.all([
    getTicketDetail(id),
    getTicketActivity(id),
    prisma.user.findMany({
      where: {
        role: { in: ["OWNER", "ADMIN", "MODERATOR", "SUPPORT"] },
        deletedAt: null,
      },
      select: { id: true, username: true, displayName: true },
    }),
  ]);
  if (!result.success) notFound();

  const { ticket } = result.data;
  const activities = activityResult.success ? activityResult.data : [];

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
            department={ticket.department}
            staffUsers={staffUsers}
            watchers={ticket.watchers?.map((w) => ({
              userId: w.userId,
              username: w.user.username,
            })) ?? []}
            tags={parseTags(ticket.tags)}
            slaResponseDueAt={ticket.slaResponseDueAt}
            slaResolveDueAt={ticket.slaResolveDueAt}
            firstResponseAt={ticket.firstResponseAt}
          />
          <Card className="glass">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketActivityTimeline activities={activities} />
            </CardContent>
          </Card>
          <div className="glass rounded-xl p-4 text-sm">
            <p className="text-muted-foreground">Submitted by</p>
            <p className="font-medium">{formatDisplayName(ticket.user)}</p>
            <p className="text-muted-foreground mt-2">{ticket.user.email}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
