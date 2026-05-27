import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { getTicketsForUser } from "@/actions/tickets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TICKET_STATUS_LABELS, TICKET_CATEGORY_LABELS } from "@/lib/ticket-labels";
import type { Locale } from "@/i18n/config";

export default async function SupportPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requireAuth(`/${locale}/login`);
  const result = await getTicketsForUser();
  const tickets = result.success ? result.data.tickets : [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-sm text-muted-foreground">Track your support requests</p>
        </div>
        <Button variant="neon" asChild>
          <Link href={`/${locale}/dashboard/support/new`}>
            <Plus className="h-4 w-4 mr-2" /> New Ticket
          </Link>
        </Button>
      </div>

      <div className="mt-8 space-y-3">
        {tickets.length === 0 ? (
          <Card className="glass p-12 text-center">
            <p className="text-muted-foreground">No support tickets yet.</p>
            <Button variant="neon" className="mt-4" asChild>
              <Link href={`/${locale}/dashboard/support/new`}>Create your first ticket</Link>
            </Button>
          </Card>
        ) : (
          tickets.map((t) => (
            <Link key={t.id} href={`/${locale}/dashboard/support/${t.id}`}>
              <Card className="glass p-4 hover:border-neon-purple/40 transition">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-neon-blue">{t.ticketNumber}</p>
                    <p className="font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {TICKET_CATEGORY_LABELS[t.category]} · {t._count.messages} messages
                    </p>
                  </div>
                  <Badge variant="outline">{TICKET_STATUS_LABELS[t.status]}</Badge>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
