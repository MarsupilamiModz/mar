"use client";

import { useState, useTransition } from "react";
import { TicketDepartment, TicketPriority, TicketStatus } from "@prisma/client";
import {
  assignTicket,
  claimTicket,
  escalateTicket,
  transferTicketDepartment,
  addTicketWatcher,
  removeTicketWatcher,
  updateTicketPriority,
  updateTicketStatus,
  addTicketTags,
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { TICKET_DEPARTMENT_LABELS, TICKET_DEPARTMENTS, TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/lib/ticket-labels";
import { TicketSlaTimer } from "@/components/admin/ticket-sla-timer";

export function TicketAdminPanel({
  ticketId,
  status,
  priority,
  assigneeId,
  department,
  staffUsers,
  watchers = [],
  tags = [],
  slaResponseDueAt,
  slaResolveDueAt,
  firstResponseAt,
}: {
  ticketId: string;
  status: TicketStatus;
  priority: TicketPriority;
  assigneeId: string | null;
  department: TicketDepartment;
  staffUsers: { id: string; username: string }[];
  watchers?: { userId: string; username: string }[];
  tags?: string[];
  slaResponseDueAt?: Date | null;
  slaResolveDueAt?: Date | null;
  firstResponseAt?: Date | null;
}) {
  const [pending, startTransition] = useTransition();
  const [tagInput, setTagInput] = useState("");
  const [localTags, setLocalTags] = useState(tags);
  const resolved = status === "RESOLVED" || status === "CLOSED";

  function run(action: () => Promise<{ success: boolean; error?: string }>, msg: string) {
    startTransition(async () => {
      const r = await action();
      if (r.success) {
        toast({ title: msg });
        window.location.reload();
      } else toast({ title: "Error", description: r.error, variant: "destructive" });
    });
  }

  function saveTags(next: string[]) {
    setLocalTags(next);
    run(() => addTicketTags(ticketId, next), "Tags updated");
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (!t || localTags.includes(t)) return;
    saveTags([...localTags, t]);
    setTagInput("");
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-sm">Admin Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(slaResponseDueAt || slaResolveDueAt) && (
          <div className="rounded-lg border border-border/40 bg-background/30 p-3 grid grid-cols-2 gap-3">
            <TicketSlaTimer
              dueAt={slaResponseDueAt}
              met={!!firstResponseAt}
              resolved={resolved}
              label="Response SLA"
            />
            <TicketSlaTimer
              dueAt={slaResolveDueAt}
              met={false}
              resolved={resolved}
              label="Resolve SLA"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => claimTicket(ticketId), "Ticket claimed")}>
            Claim
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => escalateTicket(ticketId), "Ticket escalated")}>
            Escalate
          </Button>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Tags</label>
          <div className="flex flex-wrap gap-1 mt-1 mb-2">
            {localTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  type="button"
                  className="ml-1 opacity-60 hover:opacity-100"
                  onClick={() => saveTags(localTags.filter((t) => t !== tag))}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag…"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
            />
            <Button type="button" size="sm" variant="outline" disabled={pending || !tagInput.trim()} onClick={addTag}>
              Add
            </Button>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={(v) => run(() => updateTicketStatus(ticketId, v as TicketStatus), "Status updated")} disabled={pending}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TICKET_STATUS_LABELS) as TicketStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{TICKET_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Priority</label>
          <Select value={priority} onValueChange={(v) => run(() => updateTicketPriority(ticketId, v as TicketPriority), "Priority updated")} disabled={pending}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(TICKET_PRIORITY_LABELS) as TicketPriority[]).map((p) => (
                <SelectItem key={p} value={p}>{TICKET_PRIORITY_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Department</label>
          <Select value={department} onValueChange={(v) => run(() => transferTicketDepartment(ticketId, v as TicketDepartment), "Department updated")} disabled={pending}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
              if (!v || watchers.some((w) => w.userId === v)) return;
              run(() => addTicketWatcher(ticketId, v), "Watcher added");
            }}
            disabled={pending}
          >
            <SelectTrigger className="mt-1"><SelectValue placeholder="Add watcher…" /></SelectTrigger>
            <SelectContent>
              {staffUsers
                .filter((u) => !watchers.some((w) => w.userId === u.id))
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>@{u.username}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          {watchers.length > 0 && (
            <ul className="mt-2 space-y-1">
              {watchers.map((w) => (
                <li key={w.userId} className="flex items-center justify-between text-xs">
                  <span>@{w.username}</span>
                  <button
                    type="button"
                    className="text-destructive hover:underline"
                    onClick={() => run(() => removeTicketWatcher(ticketId, w.userId), "Watcher removed")}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Assignee</label>
          <Select
            value={assigneeId ?? "unassigned"}
            onValueChange={(v) => run(() => assignTicket(ticketId, v === "unassigned" ? null : v), "Assignee updated")}
            disabled={pending}
          >
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
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
