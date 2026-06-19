"use client";

import Link from "next/link";
import { safeToLocaleDateString } from "@/lib/i18n/safe-locale";
import { useState, useTransition } from "react";
import { TicketCategory, TicketDepartment, TicketPriority, TicketStatus } from "@prisma/client";
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
  TICKET_DEPARTMENT_LABELS,
  TICKET_DEPARTMENTS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
} from "@/lib/ticket-labels";
import { TicketQueueNav } from "@/components/admin/ticket-queue-nav";
import { TicketSlaTimer } from "@/components/admin/ticket-sla-timer";
import type { TicketQueue } from "@/lib/ticket-queues";
import { getSlaTimerState } from "@/lib/sla";

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

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string");
  return [];
}

export function TicketsTable({
  locale,
  currentUserId,
  staffUsers,
  initialTickets,
  initialPages,
  initialPage,
  initialQueue = "all",
}: {
  locale: string;
  currentUserId: string;
  staffUsers: { id: string; username: string }[];
  initialTickets: TicketRow[];
  initialPages: number;
  initialPage: number;
  initialQueue?: TicketQueue;
}) {
  const [pending, startTransition] = useTransition();
  const [tickets, setTickets] = useState(initialTickets);
  const [pages, setPages] = useState(initialPages);
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState<TicketQueue>(initialQueue);
  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [department, setDepartment] = useState<string>("all");
  const [assigneeId, setAssigneeId] = useState<string>("all");

  function refresh(p = page, q = queue) {
    startTransition(async () => {
      const result = await getTicketsAdmin({
        page: p,
        search: search || undefined,
        queue: q,
        currentUserId,
        status: status !== "all" ? (status as TicketStatus) : undefined,
        category: category !== "all" ? (category as TicketCategory) : undefined,
        priority: priority !== "all" ? (priority as TicketPriority) : undefined,
        department: department !== "all" ? (department as TicketDepartment) : undefined,
        assigneeId: assigneeId !== "all" ? assigneeId : undefined,
      });
      if (result.success) {
        setTickets(result.data.tickets as TicketRow[]);
        setPages(result.data.pages);
        setPage(result.data.page);
      }
    });
  }

  function selectQueue(q: TicketQueue) {
    setQueue(q);
    refresh(1, q);
  }

  const priorityColor = (p: TicketPriority) =>
    p === "CRITICAL" || p === "URGENT"
      ? "destructive"
      : p === "HIGH"
        ? "premium"
        : "outline";

  function slaSummary(t: TicketRow) {
    const resolved = t.status === "RESOLVED" || t.status === "CLOSED";
    const response = getSlaTimerState(t.slaResponseDueAt, !!t.firstResponseAt, resolved);
    const resolve = getSlaTimerState(t.slaResolveDueAt, false, resolved);
    if (response?.variant === "overdue" || resolve?.variant === "overdue") return "overdue";
    if (response?.variant === "warning" || resolve?.variant === "warning") return "warning";
    return "ok";
  }

  return (
    <div className="space-y-4">
      <TicketQueueNav locale={locale} active={queue} onChange={selectQueue} />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{TICKET_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priority</SelectItem>
            {(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map((p) => (
              <SelectItem key={p} value={p}>{TICKET_PRIORITY_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {TICKET_DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>{TICKET_DEPARTMENT_LABELS[d]}</SelectItem>
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
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            <SelectItem value={currentUserId}>Assigned to me</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {staffUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>@{u.username}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="neon" onClick={() => refresh(1)} disabled={pending}>Filter</Button>
      </div>

      <div className="glass rounded-xl border border-border/50 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>SLA</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : (
              tickets.map((t) => {
                const tags = parseTags(t.tags);
                const resolved = t.status === "RESOLVED" || t.status === "CLOSED";
                const slaState = slaSummary(t);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link href={`/${locale}/admin/tickets/${t.id}`} className="hover:text-neon-purple">
                        <p className="font-medium">{t.ticketNumber}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{t.subject}</p>
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-[10px] px-1 py-0">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{formatDisplayName({ username: t.user.username })}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.assignee ? `@${t.assignee.username}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityColor(t.priority) as "outline"}>
                        {TICKET_PRIORITY_LABELS[t.priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{TICKET_STATUS_LABELS[t.status]}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 min-w-[100px]">
                        <TicketSlaTimer
                          dueAt={t.slaResponseDueAt}
                          met={!!t.firstResponseAt}
                          resolved={resolved}
                          label="Response"
                        />
                        <TicketSlaTimer
                          dueAt={t.slaResolveDueAt}
                          met={false}
                          resolved={resolved}
                          label="Resolve"
                        />
                        {slaState === "overdue" && (
                          <Badge variant="destructive" className="text-[10px]">Breached</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {safeToLocaleDateString(new Date(t.updatedAt))}
                    </TableCell>
                  </TableRow>
                );
              })
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
