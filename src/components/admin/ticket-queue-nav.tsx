"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { TICKET_QUEUE_LABELS, type TicketQueue } from "@/lib/ticket-queues";

const QUEUES: TicketQueue[] = [
  "all",
  "open",
  "pending",
  "escalated",
  "unassigned",
  "mine",
  "waiting_user",
  "solved",
  "closed",
];

export function TicketQueueNav({
  locale: _locale,
  active,
  onChange,
}: {
  locale: string;
  active: TicketQueue;
  onChange: (queue: TicketQueue) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-border/40 pb-3">
      {QUEUES.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onChange(q)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            active === q
              ? "bg-neon-purple/20 text-neon-purple"
              : "text-muted-foreground hover:bg-accent/20 hover:text-foreground"
          )}
        >
          {TICKET_QUEUE_LABELS[q]}
        </button>
      ))}
    </div>
  );
}

export function TicketQueueLink({
  locale,
  queue,
  value,
  accent,
  label,
}: {
  locale: string;
  queue: TicketQueue;
  value: string | number;
  accent?: string;
  label?: string;
}) {
  return (
    <Link
      href={`/${locale}/admin/tickets?queue=${queue}`}
      className="block rounded-lg transition-opacity hover:opacity-90"
    >
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
      <p className={cn("text-2xl font-bold", accent)}>{value}</p>
    </Link>
  );
}
