import { getTicketsAdmin } from "@/actions/tickets";
import { TicketsTable } from "@/components/admin/tickets-table";
import type { Locale } from "@/i18n/config";

export default async function AdminTicketsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: Locale };
  searchParams: { page?: string };
}) {
  const result = await getTicketsAdmin({ page: Number(searchParams.page) || 1 });
  const data = result.success
    ? result.data
    : { tickets: [], pages: 0, page: 1 };

  return (
    <div>
      <h1 className="text-2xl font-bold">Support Tickets</h1>
      <p className="mt-1 text-sm text-muted-foreground">Manage and respond to user support requests</p>
      <div className="mt-8">
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
