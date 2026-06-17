import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getTicketDetail } from "@/actions/tickets";
import { TicketThread } from "@/components/tickets/ticket-thread";
import type { Locale } from "@/i18n/config";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;

  await requireAuth(`/${locale}/login`);
  const result = await getTicketDetail(id);
  if (!result.success) notFound();

  const { ticket } = result.data;

  return (
    <div className="max-w-3xl">
      <Link
        href={`/${locale}/dashboard/support`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to support
      </Link>
      <TicketThread
        ticket={ticket}
        isStaff={false}
        canReply={ticket.status !== "CLOSED"}
      />
    </div>
  );
}
