import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { CreateTicketForm } from "@/components/tickets/create-ticket-form";
import type { Locale } from "@/i18n/config";

export default async function NewTicketPage({ params: { locale } }: { params: { locale: Locale } }) {
  await requireAuth(`/${locale}/login`);

  return (
    <div className="max-w-xl">
      <Link
        href={`/${locale}/dashboard/support`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="text-2xl font-bold">New Support Ticket</h1>
      <p className="mt-1 text-sm text-muted-foreground mb-6">
        We typically respond within 24–48 hours.
      </p>
      <CreateTicketForm locale={locale} />
    </div>
  );
}
