"use client";

import { useTransition } from "react";
import { TicketDepartment, TicketPriority, TicketStatus } from "@prisma/client";
import {
  assignTicket,
  claimTicket,
  escalateTicket,
  transferTicketDepartment,
  addTicketWatcher,
  updateTicketPriority,
  updateTicketStatus,
} from "@/actions/tickets";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { TICKET_DEPARTMENT_LABELS, TICKET_DEPARTMENTS, TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/lib/ticket-labels";

export function TicketAdminPanel({
  ticketId,
  status,
  priority,
  assigneeId,
  department,
  staffUsers,
  watcherIds = [],
  slaResponseDueAt,
  slaResolveDueAt,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  department: TicketDepartment;
  staffUsers: { id: string; username: string }[];
  watcherIds?: string[];
  slaResponseDueAt?: Date | null;
  slaResolveDueAt?: Date | null;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ success: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const r = await action();
      if (r.success) {
        toast({ title: msg });
        window.location.reload();
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-sm">Admin Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(slaResponseDueAt || slaResolveDueAt) && (
          <div className="rounded-lg border border-border/40 bg-background/30 p-3 text-xs space-y-1">
            <p className="font-medium text-muted-foreground">SLA</p>
            {slaResponseDueAt && (
              <p>Response due: {new Date(slaResponseDueAt).toLocaleString()}</p>
            )}
            {slaResolveDueAt && (
              <p>Resolve due: {new Date(slaResolveDueAt).toLocaleString()}</p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => claimTicket(ticketId), "Ticket claimed")}
          >
            Claim ticket
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => escalateTicket(ticketId), "Ticket escalated")}
          >
            Escalate
          </Button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select
            value={status}
            onValueChange={(v) => run(() => updateTicketStatus(ticketId, v as TicketStatus), "Status updated")}
            disabled={pending}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{TICKET_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Priority</label>
          <Select
            value={priority}
            onValueChange={(v) => run(() => updateTicketPriority(ticketId, v as TicketPriority), "Priority updated")}
            disabled={pending}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map((p) => (
                <SelectItem key={p} value={p}>{TICKET_PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Department</label>
          <Select
            value={department}
            onValueChange={(v) =>
              run(() => transferTicketDepartment(ticketId, v as TicketDepartment), "Department updated")
            }
            disabled={pending}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>{TICKET_DEPARTMENT_LABELS[d]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Watchers</label>
          <Select
            value=""
            onValueChange={(v) => {
              if (!v || watcherIds.includes(v)) return;
              run(() => addTicketWatcher(ticketId, v), "Watcher added");
            }}
            disabled={pending}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Add watcher…" />
            </SelectTrigger>
            <SelectContent>
              {staffUsers
                .filter((u) => !watcherIds.includes(u.id))
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>@{u.username}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          {watcherIds.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{watcherIds.length} watcher(s)</p>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Assignee</label>
          <Select
            value={assigneeId ?? "unassigned"}
            onValueChange={(v) =>
              run(() => assignTicket(ticketId, v === "unassigned" ? null : v), "Assignee updated")
            }
            disabled={pending}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {staffUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>@{u.username}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
