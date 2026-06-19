"use client";

import Link from "next/link";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { useState, useTransition } from "react";
import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import { getTicketsAdmin } from "@/actions/tickets";
import { formatDisplayName } from "@/lib/display-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/ticket-labels";

type TicketRow = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  updatedAt: Date;
  slaResponseDueAt: Date | null;
  slaResolveDueAt: Date | null;
  firstResponseAt: Date | null;
  user: { username: string };
  assignee: { username: string } | null;
  _count: { messages: number };
};

export function TicketsTable({
  locale,
  initialTickets,
  initialPages,
  initialPage,
}: {
  locale: string;
  initialTickets: TicketRow[];
  initialPages: number;
  initialPage: number;
}) {
  const [pending, startTransition] = useTransition();
  const [tickets, setTickets] = useState(initialTickets);
  const [pages, setPages] = useState(initialPages);
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  function refresh(p = page) {
    startTransition(async () => {
      const result = await getTicketsAdmin({
        page: p,
        search: search || undefined,
        status: status !== "all" ? (status as TicketStatus) : undefined,
        category: category !== "all" ? (category as TicketCategory) : undefined,
      });
      if (result.success) {
        setTickets(result.data.tickets as TicketRow[]);
        setPages(result.data.pages);
        setPage(result.data.page);
      }
    });
  }

  const priorityColor = (p: TicketPriority) =>
    p === "CRITICAL" || p === "URGENT"
      ? "destructive"
      : p === "HIGH"
        ? "premium"
        : "outline";

  function isSlaOverdue(t: TicketRow) {
    const now = Date.now();
    if (!t.firstResponseAt && t.slaResponseDueAt && new Date(t.slaResponseDueAt).getTime() < now) {
      return true;
    }
    if (
      t.status !== "CLOSED" &&
      t.status !== "RESOLVED" &&
      t.slaResolveDueAt &&
      new Date(t.slaResolveDueAt).getTime() < now
    ) {
      return true;
    }
    return false;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{TICKET_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[]).map((c) => (
              <SelectItem key={c} value={c}>{TICKET_CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="neon" onClick={() => refresh(1)} disabled={pending}>Filter</Button>
      </div>

      <div className="glass rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link href={`/${locale}/admin/tickets/${t.id}`} className="hover:text-neon-purple">
                      <p className="font-medium">{t.ticketNumber}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{t.subject}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{formatDisplayName({ username: t.user.username })}</TableCell>
                  <TableCell className="text-sm">{TICKET_CATEGORY_LABELS[t.category]}</TableCell>
                  <TableCell>
                    <Badge variant={priorityColor(t.priority) as "outline"}>
                      {TICKET_PRIORITY_LABELS[t.priority]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant="outline">{TICKET_STATUS_LABELS[t.status]}</Badge>
                      {isSlaOverdue(t) && (
                        <Badge variant="destructive" className="text-[10px]">SLA overdue</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {safeToLocaleDateString(new Date(t.updatedAt))}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
            <Button key={p} variant={p === page ? "neon" : "outline"} size="sm" onClick={() => refresh(p)} disabled={pending}>
              {p}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
